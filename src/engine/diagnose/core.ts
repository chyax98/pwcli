import { managedEnsureDiagnosticsHooks } from "../session.js";
import { managedRunCode, maybeRawOutput, stateAccessPrelude } from "../shared.js";
import { managedWorkspaceProjection } from "../workspace.js";

export type SignalRecord = {
  kind: string;
  timestamp: string | null;
  summary: string;
  details: Record<string, unknown>;
};

export type RunEventRecord = Record<string, unknown>;
export type ProjectionField = {
  raw: string;
  sourcePath: string;
  targetPath: string;
};
export type DiagnosticsExportSection =
  | "all"
  | "workspace"
  | "console"
  | "network"
  | "errors"
  | "routes"
  | "bootstrap";

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? (value.filter((item) => item && typeof item === "object") as Record<string, unknown>[])
    : [];
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeSince(since?: string) {
  const value = since?.trim();
  if (!value) {
    return null;
  }
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw new Error(`INVALID_SINCE:${value}`);
  }
  return { raw: value, time };
}

export function timestampAtOrAfter(value: unknown, since?: { raw: string; time: number } | null) {
  if (!since) {
    return true;
  }
  const timestamp = asString(value);
  if (!timestamp) {
    return false;
  }
  const time = Date.parse(timestamp);
  return !Number.isNaN(time) && time >= since.time;
}

export function normalizeFieldList(fields?: string) {
  const value = fields?.trim();
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.indexOf("=");
      if (separatorIndex === -1) {
        return {
          raw: item,
          sourcePath: item,
          targetPath: item,
        };
      }
      const targetPath = item.slice(0, separatorIndex).trim();
      const sourcePath = item.slice(separatorIndex + 1).trim();
      if (!targetPath || !sourcePath) {
        throw new Error(`INVALID_FIELDS:${item}`);
      }
      return {
        raw: `${targetPath}=${sourcePath}`,
        sourcePath,
        targetPath,
      };
    });
}

export function pickFieldPath(record: Record<string, unknown>, path: string) {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = record;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setFieldPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) {
    return;
  }
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const next = current[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1) as string] = value;
}

export function projectRecord(record: Record<string, unknown>, fields: ProjectionField[]) {
  if (fields.length === 0) {
    return record;
  }
  const projected: Record<string, unknown> = {};
  for (const field of fields) {
    const value = pickFieldPath(record, field.sourcePath);
    if (value !== undefined) {
      setFieldPath(projected, field.targetPath, value);
    }
  }
  return projected;
}

export function recordContainsText(record: unknown, text?: string | null) {
  if (!text) {
    return true;
  }
  return String(JSON.stringify(record) ?? "").includes(text);
}

export function sortSignals(signals: SignalRecord[]) {
  return [...signals].sort((left, right) => {
    if (!left.timestamp && !right.timestamp) {
      return 0;
    }
    if (!left.timestamp) {
      return 1;
    }
    if (!right.timestamp) {
      return -1;
    }
    return right.timestamp.localeCompare(left.timestamp);
  });
}

export function limitSignals(signals: SignalRecord[], limit: number) {
  return sortSignals(signals).slice(0, Math.max(1, limit));
}

export function limitTail<T>(items: T[], limit: number | undefined) {
  if (!limit || limit <= 0) {
    return items;
  }
  return items.slice(-limit);
}

export function shellArg(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export const TRACKING_DOMAINS = [
  "google-analytics.com",
  "googletagmanager.com",
  "googlesyndication.com",
  "googleadservices.com",
  "adtrafficquality.google",
  "adservice.google.com",
  "doubleclick.net",
  "facebook.com/tr",
  "connect.facebook.net",
  "analytics.tiktok.com",
  "ads-twitter.com",
  "bat.bing.com",
  "clarity.ms",
  "hotjar.com",
  "segment.com",
  "mixpanel.com",
  "amplitude.com",
  "heapanalytics.com",
  "fullstory.com",
  "telemetry.mozilla.org",
  "intake-analytics.wikimedia.org",
  "sentry.io",
  "browser-intake-datadoghq.com",
  "stats.wp.com",
  "pixel.wp.com",
];

export function isThirdPartyUrl(url: string, pageOrigin?: string): boolean {
  if (!url) return false;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  if (
    TRACKING_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    )
  ) {
    return true;
  }
  if (pageOrigin) {
    try {
      const originHostname = new URL(pageOrigin).hostname;
      if (hostname !== originHostname) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

function isTrackingPixel(url: string | null): boolean {
  if (!url) return false;
  return isThirdPartyUrl(url);
}

const NOISY_NET_ERRORS = [
  "net::ERR_ABORTED",
  "net::ERR_NAME_NOT_RESOLVED",
  "net::ERR_CONNECTION_RESET",
];

function isNoisyNetworkFailure(record: Record<string, unknown>): boolean {
  const failureText = asString(record.failureText);
  if (!failureText) return false;
  return NOISY_NET_ERRORS.some((err) => failureText.includes(err));
}

function isResourceLoadNoise(text: string | null): boolean {
  if (!text) return false;
  if (/^Failed to load resource:.*\b(404|403|401)\b/.test(text)) return true;
  if (/^Failed to load resource:.*net::ERR_/.test(text)) return true;
  if (
    /violates the following Content Security Policy/.test(text) &&
    /adtrafficquality|googlesyndication|googleadservice|doubleclick|facebook\.com\/tr/.test(text)
  )
    return true;
  if (/^Loading the image 'data:image\/svg/.test(text)) return true;
  if (/Attestation check.*googleadservices\.com/.test(text)) return true;
  if (/TinyMCE editors are configured to be read-only/.test(text)) return true;
  return false;
}

function toConsoleSignal(record: Record<string, unknown>): SignalRecord {
  const level = asString(record.level) ?? "info";
  const text = asString(record.text) ?? "";
  return {
    kind: `console:${level}`,
    timestamp: asString(record.timestamp),
    summary: text,
    details: {
      level,
      text,
      pageId: asString(record.pageId),
      navigationId: asString(record.navigationId),
      location: asObject(record.location),
    },
  };
}

function toPageErrorSignal(record: Record<string, unknown>): SignalRecord {
  const text = asString(record.text) ?? "";
  return {
    kind: "pageerror",
    timestamp: asString(record.timestamp),
    summary: text,
    details: {
      text,
      pageId: asString(record.pageId),
      navigationId: asString(record.navigationId),
    },
  };
}

function toNetworkSignal(record: Record<string, unknown>): SignalRecord {
  const kind = asString(record.kind) ?? asString(record.event) ?? "network";
  const url = asString(record.url) ?? "";
  const method = asString(record.method) ?? null;
  const status = asNumber(record.status);
  const failureText = asString(record.failureText);
  const summary =
    kind === "requestfailed"
      ? `${method ? `${method} ` : ""}${url}${failureText ? ` -> ${failureText}` : ""}`
      : kind === "response"
        ? `${method ? `${method} ` : ""}${url}${status !== null ? ` -> ${status}` : ""}`
        : `${method ? `${method} ` : ""}${url}`;
  return {
    kind,
    timestamp: asString(record.timestamp),
    summary,
    details: {
      requestId: asString(record.requestId),
      method,
      url,
      status,
      resourceType: asString(record.resourceType),
      failureText,
      pageId: asString(record.pageId),
      navigationId: asString(record.navigationId),
    },
  };
}

function toFailureSignal(record: Record<string, unknown>): SignalRecord {
  const code = asString(record.code) ?? "COMMAND_FAILED";
  const message = asString(record.message) ?? "";
  return {
    kind: `failure:${code}`,
    timestamp: asString(record.timestamp),
    summary: message || code,
    details: record,
  };
}

export function buildSessionDigestFromExport(
  exported: { data: unknown; session?: unknown; page?: unknown },
  limit: number,
) {
  const data = asObject(exported.data);
  const workspace = asObject(data.workspace);
  const currentPage = asObject(data.currentPage ?? exported.page ?? workspace.page);
  const consoleRecords = asArray(data.console);
  const networkRecords = asArray(data.network);
  const pageErrors = asArray(data.errors);
  const routes = asArray(data.routes);
  const bootstrap = data.bootstrap ?? null;

  const consoleErrors = consoleRecords.filter((record) => {
    const level = asString(record.level);
    return level === "error";
  });
  const criticalConsoleErrors = consoleErrors.filter(
    (record) => !isResourceLoadNoise(asString(record.text)),
  );
  const consoleWarnings = consoleRecords.filter((record) => {
    const level = asString(record.level);
    return level === "warning" || level === "warn";
  });
  const failedRequests = networkRecords.filter(
    (record) => asString(record.kind) === "requestfailed",
  );
  const firstPartyFailedRequests = failedRequests.filter(
    (record) => !isTrackingPixel(asString(record.url)) && !isNoisyNetworkFailure(record),
  );
  const httpErrors = networkRecords.filter((record) => {
    if (asString(record.kind) !== "response") {
      return false;
    }
    const status = asNumber(record.status);
    return status !== null && status >= 400;
  });

  const topSignals = limitSignals(
    [
      ...pageErrors.map(toPageErrorSignal),
      ...criticalConsoleErrors.map(toConsoleSignal),
      ...consoleWarnings.map(toConsoleSignal),
      ...firstPartyFailedRequests.map(toNetworkSignal),
      ...httpErrors.map(toNetworkSignal),
    ],
    limit,
  );

  return {
    source: "session",
    summary: {
      pageCount: asNumber(workspace.pageCount) ?? 0,
      routeCount: routes.length,
      consoleErrorCount: consoleErrors.length,
      criticalConsoleErrorCount: criticalConsoleErrors.length,
      consoleWarningCount: consoleWarnings.length,
      pageErrorCount: pageErrors.length,
      failedRequestCount: failedRequests.length,
      firstPartyFailedRequestCount: firstPartyFailedRequests.length,
      httpErrorCount: httpErrors.length,
    },
    currentPage,
    topSignals,
    recent: {
      console: limitSignals(consoleRecords.map(toConsoleSignal), limit),
      network: limitSignals(networkRecords.map(toNetworkSignal), limit),
      pageErrors: limitSignals(pageErrors.map(toPageErrorSignal), limit),
    },
    routePreview: routes.slice(-Math.max(1, limit)),
    bootstrap,
    workspace,
  };
}

function eventTimestamp(event: RunEventRecord) {
  return asString(event.ts) ?? asString(event.timestamp);
}

function collectRunSignals(event: RunEventRecord): SignalRecord[] {
  const diagnosticsDelta = asObject(event.diagnosticsDelta);
  const pageError = asObject(diagnosticsDelta.lastPageError);
  const consoleRecord = asObject(diagnosticsDelta.lastConsole);
  const networkRecord = asObject(diagnosticsDelta.lastNetwork);
  const failure = asObject(event.failure);
  const failureSignal = asObject(event.failureSignal);
  const signals: SignalRecord[] = [];

  if (Object.keys(failure).length > 0) {
    signals.push(
      toFailureSignal({
        ...failure,
        timestamp: eventTimestamp(event),
      }),
    );
  }
  if (Object.keys(failureSignal).length > 0) {
    signals.push(
      toFailureSignal({
        ...failureSignal,
        timestamp: eventTimestamp(event),
      }),
    );
  }
  if (Object.keys(pageError).length > 0) {
    signals.push(toPageErrorSignal(pageError));
  }
  if (Object.keys(consoleRecord).length > 0) {
    signals.push(toConsoleSignal(consoleRecord));
  }
  if (Object.keys(networkRecord).length > 0) {
    signals.push(toNetworkSignal(networkRecord));
  }
  return signals;
}

export function buildRunDigest(runId: string, events: RunEventRecord[], limit: number) {
  const commandCount = events.length;
  const firstTimestamp = commandCount > 0 ? eventTimestamp(events[0]) : null;
  const lastTimestamp = commandCount > 0 ? eventTimestamp(events.at(-1) ?? {}) : null;
  const sessionName =
    events.map((event) => asString(event.sessionName)).find((value) => value !== null) ?? null;
  const commands = events
    .map((event) => asString(event.command))
    .filter((value): value is string => Boolean(value));

  const consoleDeltaTotal = events.reduce((sum, event) => {
    const value = asNumber(asObject(event.diagnosticsDelta).consoleDelta);
    return sum + (value ?? 0);
  }, 0);
  const networkDeltaTotal = events.reduce((sum, event) => {
    const value = asNumber(asObject(event.diagnosticsDelta).networkDelta);
    return sum + (value ?? 0);
  }, 0);
  const pageErrorDeltaTotal = events.reduce((sum, event) => {
    const value = asNumber(asObject(event.diagnosticsDelta).pageErrorDelta);
    return sum + (value ?? 0);
  }, 0);
  const failureCount = events.filter(
    (event) => Boolean(event.failed) || Object.keys(asObject(event.failure)).length > 0,
  ).length;
  const dialogPendingCount = events.filter(
    (event) =>
      event.modalPending === true ||
      asString(asObject(event.failureSignal).code) === "MODAL_STATE_BLOCKED",
  ).length;

  const topSignals = limitSignals(
    events.flatMap((event) => collectRunSignals(event)),
    limit,
  );
  const recentSteps = events.slice(-Math.max(1, limit)).map((event) => {
    const diagnosticsDelta = asObject(event.diagnosticsDelta);
    return {
      timestamp: eventTimestamp(event),
      command: asString(event.command),
      pageId: asString(event.pageId),
      navigationId: asString(event.navigationId),
      status: asString(event.status) ?? (event.failed ? "failed" : "ok"),
      failed: Boolean(event.failed),
      modalPending: event.modalPending === true,
      summary: {
        consoleDelta: asNumber(diagnosticsDelta.consoleDelta) ?? 0,
        networkDelta: asNumber(diagnosticsDelta.networkDelta) ?? 0,
        pageErrorDelta: asNumber(diagnosticsDelta.pageErrorDelta) ?? 0,
        failureCode: asString(asObject(event.failure).code),
        failureSignalCode: asString(asObject(event.failureSignal).code),
      },
    };
  });

  return {
    runId,
    sessionName,
    firstTimestamp,
    lastTimestamp,
    commandCount,
    commands,
    summary: {
      consoleDeltaTotal,
      networkDeltaTotal,
      pageErrorDeltaTotal,
      failureCount,
      dialogPendingCount,
      signalCount: topSignals.length,
    },
    topSignals,
    recentSteps,
  };
}

export function buildDiagnosticsAuditConclusion(input: {
  sessionName: string;
  latestRunId: string | null;
  limit: number;
  digestData: Record<string, unknown>;
  latestRunEvents: Record<string, unknown> | null;
}) {
  const digestData = asObject(input.digestData);
  const summary = asObject(digestData.summary);
  const topSignals = asArray(digestData.topSignals);
  const latestRunEvents = asObject(input.latestRunEvents ?? {});
  const events = asArray(latestRunEvents.events);
  const lastEvent = asObject(events.at(-1) ?? {});
  const pageErrorCount = asNumber(summary.pageErrorCount) ?? 0;
  const failedRequestCount =
    asNumber(summary.firstPartyFailedRequestCount) ?? asNumber(summary.failedRequestCount) ?? 0;
  const consoleErrorCount =
    asNumber(summary.criticalConsoleErrorCount) ?? asNumber(summary.consoleErrorCount) ?? 0;
  const httpErrorCount = asNumber(summary.httpErrorCount) ?? 0;
  const latestRunHasFailure = events.some(
    (event) => Boolean(event.failed) || Object.keys(asObject(event.failure)).length > 0,
  );
  const latestRunHasFailureSignal = events.some(
    (event) => Object.keys(asObject(event.failureSignal)).length > 0,
  );
  const latestRunFailureEvent =
    [...events].reverse().find((event) => {
      const candidate = asObject(event);
      return (
        Boolean(candidate.failed) ||
        Object.keys(asObject(candidate.failure)).length > 0 ||
        Object.keys(asObject(candidate.failureSignal)).length > 0
      );
    }) ?? null;
  const selectedRunEvent =
    latestRunHasFailure || latestRunHasFailureSignal ? asObject(latestRunFailureEvent ?? lastEvent) : null;
  const selectedFailure = asObject(selectedRunEvent?.failure);
  const selectedFailureSignal = asObject(selectedRunEvent?.failureSignal);
  const failureLikely =
    pageErrorCount > 0 ||
    failedRequestCount > 0 ||
    consoleErrorCount > 0 ||
    httpErrorCount > 0 ||
    latestRunHasFailure ||
    latestRunHasFailureSignal;
  // Prioritize error-level signals over warnings for failureKind/failureSummary
  const errorSignals = topSignals.filter((s) => {
    const kind = asString(s.kind) ?? "";
    return kind === "pageerror" || kind === "requestfailed" || kind === "console:error";
  });
  const representativeSignal = asObject(errorSignals[0] ?? topSignals[0] ?? {});
  const failureKind =
    asString(selectedFailure.code) ??
    asString(selectedFailureSignal.code) ??
    asString(representativeSignal.kind) ??
    null;
  const failureSummary =
    asString(selectedFailure.message) ??
    asString(selectedFailureSignal.message) ??
    asString(representativeSignal.summary) ??
    null;
  const latestRunId = input.latestRunId ?? asString(latestRunEvents.runId);
  const limit = Math.max(1, input.limit);
  const grepText = failureSummary ?? failureKind ?? "error";
  const runFailureNextSteps = selectedRunEvent && latestRunId
    ? [
        `run: pw diagnostics show --run ${shellArg(latestRunId)} --limit ${limit}`,
        `run: pw diagnostics grep --run ${shellArg(latestRunId)} --text ${shellArg(grepText)} --limit ${limit}`,
      ]
    : null;
  const sessionFailureNextSteps = [
    `run: pw diagnostics timeline --session ${shellArg(input.sessionName)} --limit ${limit}`,
    `run: pw diagnostics digest --session ${shellArg(input.sessionName)} --limit ${Math.min(limit, 10)}`,
    `run: pw diagnostics export --session ${shellArg(input.sessionName)} --out ./diag.json --limit ${limit}`,
  ];
  const failureNextSteps = runFailureNextSteps ?? sessionFailureNextSteps;
  const failedAt = failureLikely
    ? (asString(selectedRunEvent?.ts) ??
      asString(selectedRunEvent?.timestamp) ??
      asString(representativeSignal.timestamp) ??
      null)
    : null;
  const failedCommand = failureLikely ? (asString(selectedRunEvent?.command) ?? null) : null;

  return {
    status: failureLikely ? "failed_or_risky" : "no_strong_failure_signal",
    failedAt,
    failedCommand,
    failureKind,
    failureSummary,
    agentAction: failureLikely
      ? "continue_audit_and_localize_bug"
      : "continue_workflow_or_run_targeted_assertions",
    agentNextSteps: failureLikely
      ? [
          ...failureNextSteps,
          "derive root cause hypothesis",
          "propose and apply minimal fix",
          "re-run validation commands",
        ]
      : ["continue planned workflow", "verify expected business outcome with assertions"],
  };
}

export async function managedErrors(
  action: "recent" | "clear",
  options?: {
    sessionName?: string;
    text?: string;
    limit?: number;
    since?: string;
    current?: boolean;
  },
) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });

  let currentNavId: string | null = null;
  if (options?.current) {
    const { managedWorkspaceProjection } = await import("../workspace.js");
    const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
    currentNavId = projection.data?.workspace?.currentNavigationId ?? null;
  }

  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude()}
      state.pageErrorRecords = Array.isArray(state.pageErrorRecords) ? state.pageErrorRecords : [];
      const allErrors = state.pageErrorRecords;
      const clearedCount = Number.isInteger(state.pageErrorClearedCount) ? state.pageErrorClearedCount : 0;
      if (${JSON.stringify(action)} === 'clear') {
        state.pageErrorClearedCount = allErrors.length;
        return JSON.stringify({
          action: 'clear',
          cleared: true,
          totalErrors: allErrors.length,
          clearedCount: allErrors.length,
          visibleCount: 0,
          errors: [],
        });
      }
      const textFilter = ${JSON.stringify(options?.text ?? "")};
      const sinceFilter = ${JSON.stringify(options?.since ?? "")};
      const sinceTime = sinceFilter ? Date.parse(sinceFilter) : NaN;
      const currentNavId = ${JSON.stringify(currentNavId)};
      const limit = ${JSON.stringify(options?.limit ?? 20)};
      const visible = allErrors.slice(clearedCount).map((error, index) => ({
        index: clearedCount + index + 1,
        ...error,
      }));
      const errors = visible
        .filter(error => {
          if (!Number.isNaN(sinceTime)) {
            const recordTime = Date.parse(String(error.timestamp || ''));
            if (Number.isNaN(recordTime) || recordTime < sinceTime)
              return false;
          }
          if (currentNavId && error.navigationId !== currentNavId)
            return false;
          return !textFilter || String(error.text || '').includes(textFilter);
        })
        .slice(-Math.max(0, Number(limit || 0) || 20));
      return JSON.stringify({
        action: 'recent',
        clearedCount,
        totalErrors: allErrors.length,
        visibleCount: visible.length,
        currentNavigation: currentNavId || undefined,
        errors,
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      action,
      summary: {
        total: Number(parsed.totalErrors ?? 0),
        visible: Number(parsed.visibleCount ?? 0),
        clearedCount: Number(parsed.clearedCount ?? 0),
        matched: Array.isArray(parsed.errors) ? parsed.errors.length : 0,
      },
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    },
  };
}

export async function managedObserveStatus(options?: { sessionName?: string }) {
  const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude({ readonly: true })}
      const clearedCount = Number.isInteger(state.pageErrorClearedCount) ? state.pageErrorClearedCount : 0;
      const visibleCount = Math.max(0, state.pageErrorRecords.length - clearedCount);
      const routes = Array.isArray(state.routes) ? state.routes : [];
      const trace = state.trace || { supported: true, active: false };
      const har = state.har || {
        supported: false,
        active: false,
        errorCode: 'UNSUPPORTED_HAR_CAPTURE',
        limitation: 'HAR start/stop is not a 1.0 recording path on an already-open managed BrowserContext. Use network/diagnostics/trace for evidence or har replay with a pre-recorded HAR.',
      };
      const bootstrap = state.bootstrap || {
        applied: false,
        initScriptCount: 0,
        headersApplied: false,
      };
      // Detect visible HTML modals/overlays that may block interactions.
      const visibleModals = await page.evaluate(() => {
        const selectors = [
          '[role="dialog"]',
          '[role="alertdialog"]',
          '[aria-modal="true"]',
          '.modal',
          '.ant-modal',
          '.el-dialog',
        ];
        return Array.from(document.querySelectorAll(selectors.join(',')))
          .filter(el => {
            if (!(el instanceof HTMLElement)) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
          .map(el => {
            const text = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
            return {
              role: el.getAttribute('role') || 'dialog',
              text: text.substring(0, 200),
            };
          })
          .filter(m => m.text);
      });

      return JSON.stringify({
        console: {
          total: state.consoleRecords.length,
          last: state.consoleRecords.at(-1) || null,
        },
        network: {
          total: state.networkRecords.length,
          requests: state.networkRecords.filter(record => record.event === 'request').length,
          responses: state.networkRecords.filter(record => record.event === 'response').length,
          failures: state.networkRecords.filter(record => record.event === 'requestfailed').length,
          last: state.networkRecords.at(-1) || null,
        },
        routes: {
          count: routes.length,
          items: routes,
        },
        pageErrors: {
          total: state.pageErrorRecords.length,
          clearedCount,
          visibleCount,
          last: state.pageErrorRecords.at(-1) || null,
        },
        modals: {
          count: visibleModals.length,
          items: visibleModals,
        },
        trace,
        har,
        bootstrap,
        stream: {
          supported: false,
          active: false,
          limitation: 'observe stream is not wired yet on the managed session substrate',
        },
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: projection.session,
    page: projection.page,
    data: {
      summary: {
        pageCount: projection.data.workspace?.pageCount ?? 0,
        currentUrl: projection.data.page?.url,
        currentPageId: projection.data.workspace?.currentPageId,
      },
      status: {
        page: projection.data.page,
        workspace: projection.data.workspace,
        dialogs: projection.data.dialogs,
        ...parsed,
      },
      workspace: projection.data.workspace,
      console: parsed.console,
      network: parsed.network,
      routes: parsed.routes,
      dialogs: projection.data.dialogs,
      pageErrors: parsed.pageErrors,
      modals: parsed.modals,
      trace: parsed.trace,
      har: parsed.har,
      bootstrap: parsed.bootstrap,
      stream: parsed.stream,
    },
  };
}

export async function managedConsole(
  level?: string,
  options?: {
    sessionName?: string;
    source?: string;
    text?: string;
    limit?: number;
    since?: string;
    current?: boolean;
  },
) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });

  // Get current navigation ID from workspace projection if --current is set.
  let currentNavId: string | null = null;
  if (options?.current) {
    const { managedWorkspaceProjection } = await import("../workspace.js");
    const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
    currentNavId = projection.data?.workspace?.currentNavigationId ?? null;
  }

  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude({ readonly: true })}
      const records = Array.isArray(state.consoleRecords) ? state.consoleRecords : [];
      const order = { error: 3, warning: 2, warn: 2, info: 1, log: 1, debug: 0 };
      const threshold = ${JSON.stringify(level ?? "info")};
      const thresholdRank = order[threshold] ?? 1;
      const sourceFilter = ${JSON.stringify(options?.source ?? "")};
      const textFilter = ${JSON.stringify(options?.text ?? "")};
      const sinceFilter = ${JSON.stringify(options?.since ?? "")};
      const sinceTime = sinceFilter ? Date.parse(sinceFilter) : NaN;
      const currentNavId = ${JSON.stringify(currentNavId)};
      const limit = ${JSON.stringify(options?.limit ?? 20)};
      const filtered = records.filter(record => {
        if ((order[record.level] ?? 1) < thresholdRank)
          return false;
        if (!Number.isNaN(sinceTime)) {
          const recordTime = Date.parse(String(record.timestamp || ''));
          if (Number.isNaN(recordTime) || recordTime < sinceTime)
            return false;
        }
        if (sourceFilter && String(record.source || '') !== sourceFilter)
          return false;
        if (textFilter && !String(record.text || '').includes(textFilter))
          return false;
        if (currentNavId && record.navigationId !== currentNavId)
          return false;
        return true;
      });
      return JSON.stringify({
        total: filtered.length,
        errors: filtered.filter(record => record.level === 'error').length,
        warnings: filtered.filter(record => record.level === 'warning' || record.level === 'warn').length,
        source: sourceFilter || null,
        currentNavigation: currentNavId || undefined,
        sample: filtered.slice(-Math.max(0, Number(limit || 0) || 20)),
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      summary: parsed,
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function managedNetwork(options?: {
  sessionName?: string;
  requestId?: string;
  method?: string;
  status?: string;
  resourceType?: string;
  text?: string;
  url?: string;
  kind?: "request" | "response" | "requestfailed" | "console-resource-error";
  limit?: number;
  since?: string;
  current?: boolean;
  includeBody?: boolean;
}) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });

  let currentNavId: string | null = null;
  if (options?.current) {
    const { managedWorkspaceProjection } = await import("../workspace.js");
    const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
    currentNavId = projection.data?.workspace?.currentNavigationId ?? null;
  }

  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude({ readonly: true })}
      const records = Array.isArray(state.networkRecords) ? state.networkRecords : [];
      const requestId = ${JSON.stringify(options?.requestId ?? "")};
      const methodFilter = ${JSON.stringify(options?.method?.toUpperCase() ?? "")};
      const statusFilter = ${JSON.stringify(options?.status ?? "")};
      const resourceTypeFilter = ${JSON.stringify(options?.resourceType ?? "")};
      const textFilter = ${JSON.stringify(options?.text ?? "")};
      const urlFilter = ${JSON.stringify(options?.url ?? "")};
      const kindFilter = ${JSON.stringify(options?.kind ?? "")};
      const sinceFilter = ${JSON.stringify(options?.since ?? "")};
      const sinceTime = sinceFilter ? Date.parse(sinceFilter) : NaN;
      const currentNavId = ${JSON.stringify(currentNavId)};
      const limit = ${JSON.stringify(options?.limit ?? 20)};
      const includeBody = ${JSON.stringify(options?.includeBody ?? false)};
      const mapRecord = (record) => {
        if (!includeBody) {
          const { requestBody, requestBodyTruncatedAt50k, responseBody, responseBodyTruncatedAt50k, ...rest } = record;
          return rest;
        }
        const { requestBodyTruncatedAt50k, responseBodyTruncatedAt50k, ...rest } = record;
        const mapped = { ...rest };
        if (record.requestBody !== undefined) {
          mapped.requestBody = record.requestBody;
          mapped.requestBodyTruncated = record.requestBodyTruncatedAt50k || false;
        }
        if (record.responseBody !== undefined) {
          mapped.responseBody = record.responseBody;
          mapped.responseBodyTruncated = record.responseBodyTruncatedAt50k || false;
        }
        return mapped;
      };
      const filtered = records.filter(record => {
        if (requestId && record.requestId !== requestId)
          return false;
        if (!Number.isNaN(sinceTime)) {
          const recordTime = Date.parse(String(record.timestamp || ''));
          if (Number.isNaN(recordTime) || recordTime < sinceTime)
            return false;
        }
        if (kindFilter && String(record.event || record.kind || '') !== kindFilter)
          return false;
        if (methodFilter && String(record.method || '').toUpperCase() !== methodFilter)
          return false;
        if (statusFilter && String(record.status ?? '') !== statusFilter)
          return false;
        if (resourceTypeFilter && String(record.resourceType || '') !== resourceTypeFilter)
          return false;
        if (urlFilter && !String(record.url || '').includes(urlFilter))
          return false;
        if (currentNavId && record.navigationId !== currentNavId)
          return false;
        if (textFilter) {
          const haystack = [
            record.url,
            record.failureText,
            record.method,
            record.resourceType,
            record.requestBodySnippet,
            record.responseBodySnippet,
          ]
            .filter(Boolean)
            .join(' ');
          if (!haystack.includes(textFilter))
            return false;
        }
        return true;
      });
      const sample = filtered.slice(-Math.max(0, Number(limit || 0) || 20)).map(mapRecord);
      const detailRaw = requestId ? filtered[filtered.length - 1] || null : null;
      const detail = detailRaw ? mapRecord(detailRaw) : null;
      return JSON.stringify({
        total: filtered.length,
        currentNavigation: currentNavId || undefined,
        sample,
        detail,
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      summary: parsed,
      ...(parsed.detail ? { detail: parsed.detail } : {}),
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function captureDiagnosticsBaseline(sessionName?: string) {
  const status = await managedObserveStatus({ sessionName });
  return {
    consoleTotal: status.data.console?.total ?? 0,
    networkTotal: status.data.network?.total ?? 0,
    pageErrorTotal: status.data.pageErrors?.total ?? 0,
  };
}

export async function buildDiagnosticsDelta(
  sessionName: string | undefined,
  before: { consoleTotal: number; networkTotal: number; pageErrorTotal: number },
) {
  const status = await managedObserveStatus({ sessionName });
  return {
    consoleDelta: Math.max(0, (status.data.console?.total ?? 0) - before.consoleTotal),
    networkDelta: Math.max(0, (status.data.network?.total ?? 0) - before.networkTotal),
    pageErrorDelta: Math.max(0, (status.data.pageErrors?.total ?? 0) - before.pageErrorTotal),
    lastConsole: status.data.console?.last ?? null,
    lastNetwork: status.data.network?.last ?? null,
    lastPageError: status.data.pageErrors?.last ?? null,
  };
}

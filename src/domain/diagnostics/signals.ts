import {
  type RunEventRecord,
  type SignalRecord,
  asArray,
  asNumber,
  asObject,
  asString,
  limitSignals,
  shellArg,
} from "./helpers.js";

const TRACKING_DOMAINS = [
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

function isTrackingPixel(url: string | null): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return TRACKING_DOMAINS.some((domain) => hostname === domain || hostname.endsWith("." + domain));
  } catch {
    return false;
  }
}

function isAbortedRequest(record: Record<string, unknown>): boolean {
  const failureText = asString(record.failureText);
  if (!failureText) return false;
  return failureText.includes("net::ERR_ABORTED");
}

function isResourceLoadNoise(text: string | null): boolean {
  if (!text) return false;
  if (/^Failed to load resource:.*\b(404|403|401)\b/.test(text)) return true;
  if (/violates the following Content Security Policy/.test(text) &&
      /adtrafficquality|googlesyndication|googleadservice|doubleclick|facebook\.com\/tr/.test(text)) return true;
  if (/^Loading the image 'data:image\/svg/.test(text)) return true;
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
    (record) => !isTrackingPixel(asString(record.url)) && !isAbortedRequest(record),
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
  const lastCommand = asString(lastEvent.command);
  const lastTs = asString(lastEvent.ts) ?? asString(lastEvent.timestamp);
  const lastFailure = asObject(lastEvent.failure);
  const lastFailureSignal = asObject(lastEvent.failureSignal);
  const pageErrorCount = asNumber(summary.pageErrorCount) ?? 0;
  const failedRequestCount = asNumber(summary.firstPartyFailedRequestCount) ?? asNumber(summary.failedRequestCount) ?? 0;
  const consoleErrorCount = asNumber(summary.criticalConsoleErrorCount) ?? asNumber(summary.consoleErrorCount) ?? 0;
  const httpErrorCount = asNumber(summary.httpErrorCount) ?? 0;
  const latestRunHasFailure = events.some(
    (event) => Boolean(event.failed) || Object.keys(asObject(event.failure)).length > 0,
  );
  const latestRunHasFailureSignal = events.some(
    (event) => Object.keys(asObject(event.failureSignal)).length > 0,
  );
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
    asString(lastFailure.code) ??
    asString(lastFailureSignal.code) ??
    asString(representativeSignal.kind) ??
    null;
  const failureSummary =
    asString(lastFailure.message) ??
    asString(lastFailureSignal.message) ??
    asString(representativeSignal.summary) ??
    null;
  const latestRunId = input.latestRunId ?? asString(latestRunEvents.runId);
  const limit = Math.max(1, input.limit);
  const grepText = failureSummary ?? failureKind ?? "error";
  const failureNextSteps = latestRunId
    ? [
        `run: pw diagnostics show --run ${shellArg(latestRunId)} --limit ${limit}`,
        `run: pw diagnostics grep --run ${shellArg(latestRunId)} --text ${shellArg(grepText)} --limit ${limit}`,
      ]
    : [
        `run: pw diagnostics digest --session ${shellArg(input.sessionName)} --limit ${Math.min(limit, 10)}`,
        `run: pw diagnostics export --session ${shellArg(input.sessionName)} --out ./diag.json --limit ${limit}`,
      ];

  return {
    status: failureLikely ? "failed_or_risky" : "no_strong_failure_signal",
    failedAt: lastTs,
    failedCommand: lastCommand,
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

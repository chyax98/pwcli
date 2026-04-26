import { listRunDirs, readRunEvents } from "../../infra/fs/run-artifacts.js";
import {
  managedConsole,
  managedDiagnosticsExport,
  managedErrors,
  managedHar,
  managedNetwork,
  managedObserveStatus,
  managedRoute,
  managedTrace,
} from "../../infra/playwright/runtime.js";

type SignalRecord = {
  kind: string;
  timestamp: string | null;
  summary: string;
  details: Record<string, unknown>;
};

type RunEventRecord = Record<string, unknown>;
type ProjectionField = {
  raw: string;
  sourcePath: string;
  targetPath: string;
};
type DiagnosticsExportSection =
  | "all"
  | "workspace"
  | "console"
  | "network"
  | "errors"
  | "routes"
  | "bootstrap";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? (value.filter((item) => item && typeof item === "object") as Record<string, unknown>[])
    : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeSince(since?: string) {
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

function timestampAtOrAfter(value: unknown, since?: { raw: string; time: number } | null) {
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

function normalizeFieldList(fields?: string) {
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

function pickFieldPath(record: Record<string, unknown>, path: string) {
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

function setFieldPath(target: Record<string, unknown>, path: string, value: unknown) {
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

function projectRecord(record: Record<string, unknown>, fields: ProjectionField[]) {
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

function recordContainsText(record: unknown, text?: string | null) {
  if (!text) {
    return true;
  }
  return String(JSON.stringify(record) ?? "").includes(text);
}

function sortSignals(signals: SignalRecord[]) {
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

function limitSignals(signals: SignalRecord[], limit: number) {
  return sortSignals(signals).slice(0, Math.max(1, limit));
}

function limitTail<T>(items: T[], limit: number | undefined) {
  if (!limit || limit <= 0) {
    return items;
  }
  return items.slice(-limit);
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

function buildSessionDigestFromExport(
  exported: Awaited<ReturnType<typeof managedDiagnosticsExport>>,
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
  const consoleWarnings = consoleRecords.filter((record) => {
    const level = asString(record.level);
    return level === "warning" || level === "warn";
  });
  const failedRequests = networkRecords.filter(
    (record) => asString(record.kind) === "requestfailed",
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
      ...consoleErrors.map(toConsoleSignal),
      ...consoleWarnings.map(toConsoleSignal),
      ...failedRequests.map(toNetworkSignal),
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
      consoleWarningCount: consoleWarnings.length,
      pageErrorCount: pageErrors.length,
      failedRequestCount: failedRequests.length,
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
  const signals: SignalRecord[] = [];

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

function buildRunDigest(runId: string, events: RunEventRecord[], limit: number) {
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
      summary: {
        consoleDelta: asNumber(diagnosticsDelta.consoleDelta) ?? 0,
        networkDelta: asNumber(diagnosticsDelta.networkDelta) ?? 0,
        pageErrorDelta: asNumber(diagnosticsDelta.pageErrorDelta) ?? 0,
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
      signalCount: topSignals.length,
    },
    topSignals,
    recentSteps,
  };
}

export async function managedDiagnosticsDigest(options: {
  sessionName?: string;
  runId?: string;
  limit?: number;
}) {
  const limit = Math.max(1, options.limit ?? 5);
  if (options.runId) {
    const events = await readRunEvents(options.runId);
    return {
      data: {
        source: "run",
        ...buildRunDigest(options.runId, events, limit),
      },
    };
  }

  const exported = await managedDiagnosticsExport({ sessionName: options.sessionName });
  return {
    session: exported.session,
    page: exported.page,
    data: buildSessionDigestFromExport(exported, limit),
  };
}

export async function listDiagnosticsRuns(options?: {
  limit?: number;
  sessionName?: string;
  since?: string;
}) {
  const runIds = await listRunDirs();
  const since = normalizeSince(options?.since);
  const sessionName = options?.sessionName?.trim() || null;
  const runs = await Promise.all(
    runIds.map(async (runId) => {
      const events = await readRunEvents(runId).catch(() => []);
      return buildRunDigest(runId, events, 3);
    }),
  );
  const ordered = [...runs].sort((left, right) => {
    if (!left.lastTimestamp && !right.lastTimestamp) {
      return right.runId.localeCompare(left.runId);
    }
    if (!left.lastTimestamp) {
      return 1;
    }
    if (!right.lastTimestamp) {
      return -1;
    }
    return right.lastTimestamp.localeCompare(left.lastTimestamp);
  });
  const filtered = ordered.filter((run) => {
    if (sessionName && run.sessionName !== sessionName) {
      return false;
    }
    return timestampAtOrAfter(run.lastTimestamp, since);
  });
  const limit = options?.limit ? Math.max(1, options.limit) : filtered.length;
  return filtered.slice(0, limit);
}

export async function managedDiagnosticsExportFiltered(options: {
  sessionName?: string;
  section?: DiagnosticsExportSection;
  limit?: number;
  fields?: string;
  since?: string;
  text?: string;
}) {
  const exported = await managedDiagnosticsExport({ sessionName: options.sessionName });
  const section = options.section ?? "all";
  const limit = options.limit && options.limit > 0 ? options.limit : undefined;
  const since = normalizeSince(options.since);
  const fields = normalizeFieldList(options.fields);
  const text = options.text?.trim() || null;
  const data = asObject(exported.data);
  const projectArray = (value: unknown, timestampField?: string) =>
    limitTail(
      asArray(value)
        .filter(
          (item) =>
            !timestampField || timestampAtOrAfter(pickFieldPath(item, timestampField), since),
        )
        .filter((item) => recordContainsText(item, text))
        .map((item) => projectRecord(item, fields)),
      limit,
    );

  const filteredData =
    section === "workspace"
      ? {
          session: data.session ?? null,
          workspace: data.workspace ?? null,
        }
      : section === "console"
        ? {
            session: data.session ?? null,
            console: projectArray(data.console, "timestamp"),
          }
        : section === "network"
          ? {
              session: data.session ?? null,
              network: projectArray(data.network, "timestamp"),
            }
          : section === "errors"
            ? {
                session: data.session ?? null,
                errors: projectArray(data.errors, "timestamp"),
              }
            : section === "routes"
              ? {
                  session: data.session ?? null,
                  routes: projectArray(data.routes, "addedAt"),
                }
              : section === "bootstrap"
                ? {
                    session: data.session ?? null,
                    bootstrap: data.bootstrap ?? null,
                  }
                : {
                    session: data.session ?? null,
                    workspace: data.workspace ?? null,
                    console: projectArray(data.console, "timestamp"),
                    network: projectArray(data.network, "timestamp"),
                    errors: projectArray(data.errors, "timestamp"),
                    routes: projectArray(data.routes, "addedAt"),
                    bootstrap: data.bootstrap ?? null,
                  };

  return {
    session: exported.session,
    page: exported.page,
    data: {
      section,
      limit: limit ?? null,
      since: since?.raw ?? null,
      text,
      fields: fields.length > 0 ? fields.map((field) => field.raw) : null,
      ...filteredData,
    },
  };
}

export async function readDiagnosticsRunView(options: {
  runId: string;
  command?: string;
  text?: string;
  limit?: number;
  since?: string;
  fields?: string;
}) {
  const events = await readRunEvents(options.runId);
  const command = options.command?.trim();
  const text = options.text?.trim();
  const since = normalizeSince(options.since);
  const fields = normalizeFieldList(options.fields);
  const filtered = events.filter((event) => {
    if (command && asString(event.command) !== command) {
      return false;
    }
    if (!timestampAtOrAfter(event.ts ?? event.timestamp, since)) {
      return false;
    }
    if (text && !JSON.stringify(event).includes(text)) {
      return false;
    }
    return true;
  });
  const limited = options.limit && options.limit > 0 ? filtered.slice(-options.limit) : filtered;
  return {
    runId: options.runId,
    command: command ?? null,
    text: text ?? null,
    since: since?.raw ?? null,
    fields: fields.length > 0 ? fields.map((field) => field.raw) : null,
    count: limited.length,
    total: filtered.length,
    events: fields.length > 0 ? limited.map((event) => projectRecord(event, fields)) : limited,
  };
}

export {
  managedConsole,
  managedDiagnosticsExport,
  managedErrors,
  managedHar,
  managedNetwork,
  managedObserveStatus,
  managedRoute,
  managedTrace,
};

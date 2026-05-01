import { listRunDirs, readRunEvents } from "../../infra/fs/run-artifacts.js";
import {
  type DiagnosticsExportSection,
  asArray,
  asObject,
  asString,
  limitTail,
  normalizeFieldList,
  normalizeSince,
  pickFieldPath,
  projectRecord,
  recordContainsText,
  timestampAtOrAfter,
} from "./helpers.js";
import {
  buildDiagnosticsAuditConclusion,
  buildRunDigest,
  buildSessionDigestFromExport,
} from "./signals.js";

export { buildDiagnosticsAuditConclusion, buildRunDigest } from "./signals.js";

type DiagnosticsExport = {
  session?: unknown;
  page?: unknown;
  data: unknown;
};

export function buildSessionDigest(
  exported: DiagnosticsExport,
  limit: number,
) {
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

export function applyDiagnosticsExportFilter(
  exported: DiagnosticsExport,
  options: {
    section?: DiagnosticsExportSection;
    limit?: number;
    fields?: string;
    since?: string;
    text?: string;
  },
) {
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

export async function buildSessionTimeline(options: {
  sessionName: string;
  limit?: number;
  since?: string;
  exported: DiagnosticsExport;
}) {
  const limit = options.limit && options.limit > 0 ? options.limit : 50;
  const since = normalizeSince(options.since);
  const data = asObject(options.exported.data);

  type TimelineEntry = {
    timestamp: string;
    kind: string;
    summary: string;
    details?: Record<string, unknown>;
  };

  const entries: TimelineEntry[] = [];

  // Console signals
  for (const item of asArray(data.console)) {
    const ts = asString((item as Record<string, unknown>).timestamp);
    if (!ts || !timestampAtOrAfter(ts, since)) continue;
    const record = item as Record<string, unknown>;
    const level = asString(record.level) ?? "info";
    const text = asString(record.text) ?? "";
    entries.push({
      timestamp: ts,
      kind: `console:${level}`,
      summary: text.length > 120 ? text.slice(0, 120) + "…" : text,
      details: record,
    });
  }

  // Network signals
  for (const item of asArray(data.network)) {
    const record = item as Record<string, unknown>;
    const ts = asString(record.timestamp);
    if (!ts || !timestampAtOrAfter(ts, since)) continue;
    const method = asString(record.method) ?? "GET";
    const url = asString(record.url) ?? "";
    const status = record.status;
    const failureText = asString(record.failureText);
    const shortUrl = url.length > 80 ? "…" + url.slice(-77) : url;
    const summary = failureText
      ? `${method} ${shortUrl} -> ${failureText}`
      : `${method} ${shortUrl} -> ${status ?? "?"}`;
    entries.push({
      timestamp: ts,
      kind: record.status ? "response" : record.failureText ? "requestfailed" : "request",
      summary,
      details: record,
    });
  }

  // Page errors
  for (const item of asArray(data.errors)) {
    const record = item as Record<string, unknown>;
    const ts = asString(record.timestamp);
    if (!ts || !timestampAtOrAfter(ts, since)) continue;
    const text = asString(record.text) ?? "";
    entries.push({
      timestamp: ts,
      kind: "pageerror",
      summary: text.length > 120 ? text.slice(0, 120) + "…" : text,
      details: record,
    });
  }

  // Run events (actions + failures)
  const runs = await listDiagnosticsRuns({
    sessionName: options.sessionName,
    limit: 10,
  });
  for (const run of runs) {
    const events = await readRunEvents(run.runId).catch(() => []);
    for (const event of events) {
      const ts = asString(event.ts ?? event.timestamp);
      if (!ts || !timestampAtOrAfter(ts, since)) continue;
      const command = asString(event.command) ?? "?";
      const failed = Boolean(event.failed);
      const failure = asObject(event.failure);
      const failureCode = asString(failure.code);
      const screenshotPath = asString(event.failureScreenshotPath);
      let kind: string;
      let summary: string;
      if (failed && failureCode) {
        kind = `failure:${failureCode}`;
        summary = asString(failure.message) ?? `${command} failed`;
      } else if (failed) {
        kind = `failure:${command}`;
        summary = `${command} failed`;
      } else {
        kind = `action:${command}`;
        const target = asObject(event.target);
        const ref = asString(target.ref);
        const selector = asString(target.selector);
        summary = ref ? `${command} ${ref}` : selector ? `${command} ${selector}` : command;
      }
      entries.push({
        timestamp: ts,
        kind,
        summary: summary.length > 120 ? summary.slice(0, 120) + "…" : summary,
        details: {
          runId: run.runId,
          command,
          failed,
          ...(failureCode ? { failureCode } : {}),
          ...(screenshotPath ? { screenshotPath } : {}),
        },
      });
    }
  }

  // Sort ascending by timestamp
  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Apply limit (take last N)
  const limited = entries.slice(-limit);

  return {
    count: limited.length,
    total: entries.length,
    entries: limited,
  };
}

export async function managedDiagnosticsBundle(options: {
  sessionName: string;
  limit?: number;
  exported: DiagnosticsExport;
}) {
  const limit = Math.max(1, options.limit ?? 20);
  const digest = buildSessionDigest(options.exported, Math.min(limit, 10));
  const runs = await listDiagnosticsRuns({
    sessionName: options.sessionName,
    limit: 1,
  });
  const latestRun = runs[0] ?? null;
  const latestRunView = latestRun
    ? await readDiagnosticsRunView({
        runId: latestRun.runId,
        limit,
      })
    : null;
  const auditConclusion = buildDiagnosticsAuditConclusion({
    sessionName: options.sessionName,
    latestRunId: latestRun?.runId ?? null,
    limit,
    digestData: asObject(digest.data),
    latestRunEvents: latestRunView,
  });

  return {
    session: options.exported.session,
    page: options.exported.page,
    data: {
      createdAt: new Date().toISOString(),
      sessionName: options.sessionName,
      limit,
      latestRunId: latestRun?.runId ?? null,
      auditConclusion,
      digest: digest.data,
      diagnostics: asObject(options.exported.data),
      latestRunEvents: latestRunView,
    },
  };
}

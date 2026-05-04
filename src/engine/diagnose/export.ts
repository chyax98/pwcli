import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { listRunDirs, readRunEvents } from "#store/artifacts.js";
import { managedRunCode, stateAccessPrelude } from "../shared.js";
import {
  asArray,
  asObject,
  asString,
  buildDiagnosticsAuditConclusion,
  buildRunDigest,
  buildSessionDigestFromExport,
  type DiagnosticsExportSection,
  isThirdPartyUrl,
  limitTail,
  managedObserveStatus,
  normalizeFieldList,
  normalizeSince,
  pickFieldPath,
  projectRecord,
  recordContainsText,
  timestampAtOrAfter,
} from "./core.js";

export async function managedDiagnosticsExport(options?: { sessionName?: string }) {
  const workspace = await managedObserveStatus({ sessionName: options?.sessionName });
  const records = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude({ readonly: true })}
      return JSON.stringify({
        console: Array.isArray(state.consoleRecords) ? state.consoleRecords : [],
        network: Array.isArray(state.networkRecords) ? state.networkRecords : [],
        errors: Array.isArray(state.pageErrorRecords) ? state.pageErrorRecords : [],
        routes: Array.isArray(state.routes) ? state.routes : [],
        bootstrap: state.bootstrap || null,
        sse: Array.isArray(state.sseRecords) ? state.sseRecords : [],
      });
    }`,
  });
  const parsed =
    typeof records.data.result === "object" && records.data.result ? records.data.result : {};

  return {
    session: workspace.session,
    page: workspace.page,
    data: {
      session: workspace.session?.name ?? options?.sessionName ?? null,
      workspace: workspace.data.workspace,
      console: Array.isArray(parsed.console) ? parsed.console : [],
      network: Array.isArray(parsed.network) ? parsed.network : [],
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      routes: Array.isArray(parsed.routes) ? parsed.routes : [],
      bootstrap: parsed.bootstrap ?? null,
      sse: Array.isArray(parsed.sse) ? parsed.sse : [],
    },
  };
}

export { buildDiagnosticsAuditConclusion, buildRunDigest } from "./core.js";

type DiagnosticsExport = {
  session?: unknown;
  page?: unknown;
  data: unknown;
};

export function buildSessionDigest(exported: DiagnosticsExport, limit: number) {
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

export async function writeDiagnosticsExportFile(outPath: string, data: unknown) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return outPath;
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

export async function readDiagnosticsRunDigest(options: { runId: string; limit?: number }) {
  return buildRunDigest(options.runId, await readRunEvents(options.runId), options.limit ?? 5);
}

type TimelineEntry = {
  timestamp: string;
  kind: string;
  summary: string;
  details?: Record<string, unknown>;
};

type EvidenceArtifactType =
  | "screenshot"
  | "pdf"
  | "trace"
  | "video"
  | "network"
  | "console"
  | "state"
  | "custom";

type EvidenceArtifact = {
  type: EvidenceArtifactType;
  path: string;
  sizeBytes?: number;
};

type EvidenceSummary = {
  status: "pass" | "fail" | "blocked";
  highSignalFindings: string[];
};

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function inferArtifactType(path: string, hint?: string | null): EvidenceArtifactType {
  const value = path.toLowerCase();
  const command = hint?.toLowerCase() ?? "";
  if (
    command.includes("screenshot") ||
    value.endsWith(".png") ||
    value.endsWith(".jpg") ||
    value.endsWith(".jpeg")
  )
    return "screenshot";
  if (command.includes("pdf") || value.endsWith(".pdf")) return "pdf";
  if (command.includes("trace") || value.endsWith(".zip")) return "trace";
  if (command.includes("video") || value.endsWith(".webm") || value.endsWith(".mp4"))
    return "video";
  if (command.includes("network") || value.endsWith(".har")) return "network";
  if (command.includes("console")) return "console";
  if (command.includes("state") || value.endsWith("state.json")) return "state";
  return "custom";
}

async function artifactWithSize(
  type: EvidenceArtifactType,
  path: string,
): Promise<EvidenceArtifact> {
  const size = await stat(path)
    .then((info) => info.size)
    .catch(() => undefined);
  return {
    type,
    path,
    ...(typeof size === "number" ? { sizeBytes: size } : {}),
  };
}

async function collectEvidenceArtifacts(events: Record<string, unknown>[]) {
  const candidates: Array<{ type: EvidenceArtifactType; path: string }> = [];
  const push = (type: EvidenceArtifactType, path: string | null) => {
    if (path) candidates.push({ type, path });
  };
  for (const event of events) {
    const command = asString(event.command);
    push(inferArtifactType(asString(event.path) ?? "", command), asString(event.path));
    push("screenshot", asString(event.failureScreenshotPath));
    push("trace", asString(event.traceArtifactPath));
    push("video", asString(event.videoPath));
    push("custom", asString(event.savedAs));
    push("custom", asString(event.artifactPath));
    push("custom", asString(event.outputPath));
  }
  const unique = new Map<string, EvidenceArtifactType>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.path)) unique.set(candidate.path, candidate.type);
  }
  return Promise.all([...unique.entries()].map(([path, type]) => artifactWithSize(type, path)));
}

function evidenceSummaryFromBundle(input: {
  auditConclusion: Record<string, unknown>;
  digestData: Record<string, unknown>;
  highSignalTimeline: TimelineEntry[];
  limit: number;
}): EvidenceSummary {
  const failureKind = asString(input.auditConclusion.failureKind);
  const status =
    failureKind === "MODAL_STATE_BLOCKED" ||
    input.highSignalTimeline.some((entry) => entry.kind === "failure:MODAL_STATE_BLOCKED")
      ? "blocked"
      : asString(input.auditConclusion.status) === "failed_or_risky"
        ? "fail"
        : "pass";
  const topSignals = asArray(input.digestData.topSignals);
  const findings = uniqueStrings([
    asString(input.auditConclusion.failureSummary),
    ...topSignals.map((signal) => asString(signal.summary)),
    ...input.highSignalTimeline.map((entry) => entry.summary),
  ]).slice(0, Math.max(1, input.limit));
  return {
    status,
    highSignalFindings: findings,
  };
}

function renderHandoffReport(input: {
  createdAt: string;
  sessionName: string;
  task?: string;
  commands: string[];
  runIds: string[];
  artifacts: EvidenceArtifact[];
  summary: EvidenceSummary;
  auditConclusion: Record<string, unknown>;
}) {
  const nextSteps = Array.isArray(input.auditConclusion.agentNextSteps)
    ? input.auditConclusion.agentNextSteps.map((step) => String(step)).filter(Boolean)
    : [];
  const lines = [
    "# pwcli Evidence Handoff",
    "",
    `- schemaVersion: 1.0`,
    `- createdAt: ${input.createdAt}`,
    `- session: ${input.sessionName}`,
    ...(input.task ? [`- task: ${input.task}`] : []),
    `- status: ${input.summary.status}`,
    "",
    "## High Signal Findings",
    ...(input.summary.highSignalFindings.length > 0
      ? input.summary.highSignalFindings.map((finding) => `- ${finding}`)
      : ["- 无强失败信号"]),
    "",
    "## Commands",
    ...(input.commands.length > 0
      ? input.commands.map((command) => `- ${command}`)
      : ["- 无 run command"]),
    "",
    "## Run IDs",
    ...(input.runIds.length > 0 ? input.runIds.map((runId) => `- ${runId}`) : ["- 无 run id"]),
    "",
    "## Artifacts",
    ...(input.artifacts.length > 0
      ? input.artifacts.map(
          (artifact) =>
            `- ${artifact.type}: ${artifact.path}${artifact.sizeBytes !== undefined ? ` (${artifact.sizeBytes} bytes)` : ""}`,
        )
      : ["- 无 artifact"]),
    "",
    "## Next Steps",
    ...(nextSteps.length > 0 ? nextSteps.map((step) => `- ${step}`) : ["- 无建议步骤"]),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function scoreTimelineEntry(entry: TimelineEntry, pageOrigin?: string): number {
  if (entry.kind.startsWith("failure:")) return 10;
  if (entry.kind.startsWith("action:")) return 8;
  if (entry.kind === "console:error") {
    const details = entry.details ?? {};
    const location = asObject(details.location);
    const locationUrl = asString(location.url);
    if (locationUrl && isThirdPartyUrl(locationUrl, pageOrigin)) return 2;
    return 7;
  }
  if (entry.kind === "pageerror") return 6;
  if (entry.kind === "requestfailed") {
    const details = entry.details ?? {};
    const url = asString(details.url);
    if (url && isThirdPartyUrl(url, pageOrigin)) return 1;
    return 5;
  }
  return 0;
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
      summary: text.length > 120 ? `${text.slice(0, 120)}…` : text,
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
    const shortUrl = url.length > 80 ? `…${url.slice(-77)}` : url;
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

  // SSE signals (errors only go into timeline as pageerror-class entries)
  for (const item of asArray(data.sse)) {
    const record = item as Record<string, unknown>;
    const ts = asString(record.timestamp);
    if (!ts || !timestampAtOrAfter(ts, since)) continue;
    if (record.eventType !== "__error") continue;
    const url = asString(record.url) ?? "";
    const shortUrl = url.length > 80 ? `…${url.slice(-77)}` : url;
    entries.push({
      timestamp: ts,
      kind: "pageerror",
      summary: `SSE error on ${shortUrl}`,
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
      summary: text.length > 120 ? `${text.slice(0, 120)}…` : text,
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
        summary: summary.length > 120 ? `${summary.slice(0, 120)}…` : summary,
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
  outDir?: string;
  task?: string;
}) {
  const limit = Math.max(1, options.limit ?? 20);
  const digest = buildSessionDigest(options.exported, Math.min(limit, 10));
  const bundleRuns = await listDiagnosticsRuns({
    sessionName: options.sessionName,
    limit: Math.max(limit, 10),
  });
  const latestRun = bundleRuns[0] ?? null;
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

  // Build a signal-dense timeline summary for the bundle
  const fullTimeline = await buildSessionTimeline({
    sessionName: options.sessionName,
    limit: 200,
    exported: options.exported,
  });
  const signalKinds = new Set(["pageerror", "requestfailed"]);
  const timelineSummary = fullTimeline.entries
    .filter(
      (e) =>
        e.kind.startsWith("action:") ||
        e.kind.startsWith("failure:") ||
        e.kind.startsWith("console:error") ||
        signalKinds.has(e.kind),
    )
    .slice(-limit);

  const digestData = asObject(digest.data);
  const currentPage = asObject(digestData.currentPage);
  const pageUrl = asString(currentPage.url) ?? undefined;
  const highSignalTimeline = fullTimeline.entries
    .filter((e) => scoreTimelineEntry(e, pageUrl) >= 5)
    .slice(-limit);
  const scopedRunEvents = (
    await Promise.all(bundleRuns.map((run) => readRunEvents(run.runId).catch(() => [])))
  ).flat();
  const runIds = bundleRuns.map((run) => run.runId);
  const commands = uniqueStrings(scopedRunEvents.map((event) => asString(event.command)));
  const artifacts = await collectEvidenceArtifacts(scopedRunEvents);
  const summary = evidenceSummaryFromBundle({
    auditConclusion,
    digestData,
    highSignalTimeline,
    limit,
  });
  const createdAt = new Date().toISOString();

  const result = {
    session: options.exported.session,
    page: options.exported.page,
    data: {
      schemaVersion: "1.0",
      session: options.sessionName,
      createdAt,
      ...(options.task?.trim() ? { task: options.task.trim() } : {}),
      commands,
      runIds,
      artifacts,
      summary,
      sessionName: options.sessionName,
      limit,
      latestRunId: latestRun?.runId ?? null,
      auditConclusion,
      digest: digest.data,
      diagnostics: asObject(options.exported.data),
      latestRunEvents: latestRunView,
      timeline: {
        count: timelineSummary.length,
        total: fullTimeline.total,
        entries: timelineSummary,
      },
      highSignalTimeline: {
        count: highSignalTimeline.length,
        total: fullTimeline.total,
        entries: highSignalTimeline,
      },
    },
  };

  if (options.outDir) {
    await mkdir(options.outDir, { recursive: true });
    await writeFile(
      join(options.outDir, "manifest.json"),
      `${JSON.stringify(result.data, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(options.outDir, "handoff.md"),
      renderHandoffReport({
        createdAt,
        sessionName: options.sessionName,
        task: options.task,
        commands,
        runIds,
        artifacts,
        summary,
        auditConclusion,
      }),
      "utf8",
    );
  }

  return result;
}

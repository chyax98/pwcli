type CommandResult = {
  session?: Record<string, unknown>;
  page?: Record<string, unknown>;
  diagnostics?: unknown[];
  data: Record<string, unknown>;
};

type CommandError = {
  code: string;
  message: string;
  retryable?: boolean;
  suggestions?: string[];
  details?: Record<string, unknown>;
};

type OutputMode = "text" | "json";

function outputMode(): OutputMode {
  const envMode = process.env.PWCLI_OUTPUT?.trim().toLowerCase();
  if (envMode === "json" || envMode === "text") {
    return envMode;
  }

  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    const mode = process.argv[outputIndex + 1]?.trim().toLowerCase();
    if (mode === "json" || mode === "text") {
      return mode;
    }
  }

  const outputPrefix = "--output=";
  const outputArg = process.argv.find((arg) => arg.startsWith(outputPrefix));
  const mode = outputArg?.slice(outputPrefix.length).trim().toLowerCase();
  if (mode === "json" || mode === "text") {
    return mode;
  }

  return "text";
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printText(value: string): void {
  process.stdout.write(value.endsWith("\n") ? value : `${value}\n`);
}

function commandEnvelope(command: string, result: CommandResult) {
  const data =
    result.session &&
    typeof result.session === "object" &&
    "name" in result.session &&
    typeof result.session.name === "string" &&
    !("resolvedSession" in result.data)
      ? {
          ...result.data,
          resolvedSession: result.session.name,
        }
      : result.data;

  return {
    ok: true,
    command,
    ...(result.session ? { session: result.session } : {}),
    ...(result.page ? { page: result.page } : {}),
    ...(result.diagnostics && result.diagnostics.length > 0
      ? { diagnostics: result.diagnostics }
      : {}),
    data,
  };
}

function errorEnvelope(command: string, error: CommandError) {
  return {
    ok: false,
    command,
    error: {
      code: error.code,
      message: error.message,
      retryable: Boolean(error.retryable),
      suggestions: error.suggestions ?? [],
      ...(error.details ? { details: error.details } : {}),
    },
  };
}

export function printSuccess(command: string, data: Record<string, unknown>): void {
  printCommandResult(command, { data });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compactUrl(value: unknown): string {
  const raw = asString(value) ?? "";
  if (!raw) {
    return "";
  }
  try {
    const url = new URL(raw);
    return `${url.pathname}${url.search}`;
  } catch {
    return raw;
  }
}

function pageLine(page: unknown): string | null {
  const record = asRecord(page);
  const url = compactUrl(record.url);
  const title = asString(record.title);
  if (!url && !title) {
    return null;
  }
  return title ? `${url} (${title})` : url;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function formatRunPointer(value: unknown): string | null {
  const run = asRecord(value);
  const runId = asString(run.runId);
  const runDir = asString(run.runDir);
  if (!runId && !runDir) {
    return null;
  }
  return `run ${[runId ? `id=${runId}` : null, runDir ? `dir=${runDir}` : null]
    .filter(Boolean)
    .join(" ")}`;
}

function formatDiagnosticsDelta(value: unknown): string[] {
  const delta = asRecord(value);
  const consoleDelta = asNumber(delta.consoleDelta) ?? 0;
  const networkDelta = asNumber(delta.networkDelta) ?? 0;
  const pageErrorDelta = asNumber(delta.pageErrorDelta) ?? 0;
  const lines = [
    `delta console=${consoleDelta} network=${networkDelta} pageError=${pageErrorDelta}`,
  ];
  const lastConsole = asRecord(delta.lastConsole);
  const lastNetwork = asRecord(delta.lastNetwork);
  const lastPageError = asRecord(delta.lastPageError);
  if (Object.keys(lastConsole).length > 0) {
    lines.push(
      `last console ${asString(lastConsole.level) ?? ""}: ${asString(lastConsole.text) ?? ""}`.trim(),
    );
  }
  if (Object.keys(lastNetwork).length > 0) {
    const method = asString(lastNetwork.method) ?? "";
    const status = asNumber(lastNetwork.status);
    const failure = asString(lastNetwork.failureText);
    lines.push(
      `last network ${method} ${compactUrl(lastNetwork.url)}${status !== null ? ` -> ${status}` : ""}${failure ? ` ${failure}` : ""}`.trim(),
    );
  }
  if (Object.keys(lastPageError).length > 0) {
    lines.push(`last pageerror: ${asString(lastPageError.text) ?? ""}`);
  }
  return lines;
}

function formatReadText(result: CommandResult): string {
  const text = asString(result.data.text) ?? "";
  const truncated = Boolean(result.data.truncated);
  const totalChars = asNumber(result.data.totalCharCount) ?? text.length;
  const chars = asNumber(result.data.charCount) ?? text.length;
  return `${text}\n[truncated: ${truncated}, chars: ${chars}/${totalChars}]`;
}

function formatSnapshot(result: CommandResult): string {
  const snapshot = asString(result.data.snapshot) ?? "";
  return snapshot || "(empty snapshot)";
}

function formatNetworkRecord(record: unknown): string {
  const item = asRecord(record);
  const ts = asString(item.timestamp) ?? asString(item.ts) ?? "";
  const kind = asString(item.event) ?? asString(item.kind) ?? "network";
  const method = asString(item.method) ?? "-";
  const status = asNumber(item.status);
  const requestId = asString(item.requestId) ?? "-";
  const resourceType = asString(item.resourceType) ?? "-";
  const failure = asString(item.failureText);
  const suffix = failure ? ` -> ${failure}` : status !== null ? ` -> ${status}` : "";
  return `${ts} ${kind} ${method} ${resourceType} ${requestId} ${compactUrl(item.url)}${suffix}`.trim();
}

function formatNetwork(result: CommandResult): string {
  const summary = asRecord(result.data.summary);
  const total = asNumber(summary.total) ?? 0;
  const sample = asArray(summary.sample);
  const lines = [`total=${total}`, ...sample.map(formatNetworkRecord)];
  const detail = result.data.detail ?? summary.detail;
  if (detail) {
    lines.push("detail:");
    lines.push(stringifyValue(detail));
  }
  return lines.join("\n");
}

function formatConsoleRecord(record: unknown): string {
  const item = asRecord(record);
  const ts = asString(item.timestamp) ?? asString(item.ts) ?? "";
  const level = asString(item.level) ?? "info";
  return `${ts} ${level}: ${asString(item.text) ?? ""}`.trim();
}

function formatConsole(result: CommandResult): string {
  const summary = asRecord(result.data.summary);
  const total = asNumber(summary.total) ?? 0;
  const errors = asNumber(summary.errors) ?? 0;
  const warnings = asNumber(summary.warnings) ?? 0;
  const sample = asArray(summary.sample);
  return [
    `total=${total} errors=${errors} warnings=${warnings}`,
    ...sample.map(formatConsoleRecord),
  ].join("\n");
}

function formatDiagnosticsDigest(result: CommandResult): string {
  const lines: string[] = [];
  const summary = asRecord(result.data.summary);
  const currentPage = pageLine(result.data.currentPage);
  if (currentPage) {
    lines.push(`page ${currentPage}`);
  }
  lines.push(
    `summary consoleErrors=${asNumber(summary.consoleErrorCount) ?? 0} consoleWarnings=${asNumber(summary.consoleWarningCount) ?? 0} httpErrors=${asNumber(summary.httpErrorCount) ?? 0} failedRequests=${asNumber(summary.failedRequestCount) ?? 0} pageErrors=${asNumber(summary.pageErrorCount) ?? 0}`,
  );
  const topSignals = asArray(result.data.topSignals);
  if (topSignals.length > 0) {
    lines.push("signals:");
    for (const signal of topSignals) {
      const item = asRecord(signal);
      lines.push(
        `${asString(item.timestamp) ?? ""} ${asString(item.kind) ?? "signal"} ${asString(item.summary) ?? ""}`.trim(),
      );
    }
  }
  return lines.join("\n");
}

function formatPage(result: CommandResult): string {
  const current = asRecord(result.data.currentPage);
  const pages = asArray(result.data.pages);
  if (pages.length > 0) {
    return pages
      .map((item) => {
        const page = asRecord(item);
        const prefix = page.current ? "*" : "-";
        return `${prefix} ${pageLine(page) ?? stringifyValue(page)}`;
      })
      .join("\n");
  }
  return pageLine(current) ?? stringifyValue(result.data);
}

function formatSession(result: CommandResult): string {
  const sessions = asArray(result.data.sessions);
  if (sessions.length > 0) {
    return sessions
      .map((item) => {
        const session = asRecord(item);
        const page = pageLine(session.page);
        return `${asString(session.name) ?? "session"} alive=${String(session.alive ?? "?")}${page ? ` ${page}` : ""}`;
      })
      .join("\n");
  }
  const page = pageLine(result.page);
  const fields = Object.entries(result.data)
    .filter(([key]) => key !== "workspace" && key !== "pages" && key !== "currentPage")
    .map(
      ([key, value]) =>
        `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`,
    );
  return [page ? `page ${page}` : null, fields.join(" ")].filter(Boolean).join("\n");
}

function formatAction(command: string, result: CommandResult): string {
  const page = pageLine(result.page);
  const keys = [
    "acted",
    "filled",
    "typed",
    "pressed",
    "matched",
    "navigated",
    "uploaded",
    "downloaded",
  ];
  const facts = keys
    .filter((key) => key in result.data)
    .map((key) => `${key}=${String(result.data[key])}`);
  const lines = [`${command}${facts.length > 0 ? ` ${facts.join(" ")}` : " ok"}`];
  if (page) {
    lines.push(`page ${page}`);
  }
  const runPointer = formatRunPointer(result.data.run);
  if (runPointer) {
    lines.push(runPointer);
  }
  lines.push(...formatDiagnosticsDelta(result.data.diagnosticsDelta));
  return lines.join("\n");
}

function hasOutputFlag(name: string): boolean {
  return process.argv.includes(name);
}

function formatBatch(result: CommandResult): string {
  const summary = asRecord(result.data.summary);
  const analysis = asRecord(result.data.analysis);
  const warnings = asArray(analysis.warnings).map(String);
  const lines = [
    `batch completed=${String(result.data.completed ?? true)} steps=${asNumber(summary.stepCount) ?? 0} success=${asNumber(summary.successCount) ?? 0} failed=${asNumber(summary.failedCount) ?? 0} continueOnError=${String(summary.continueOnError ?? false)}`,
  ];
  const firstFailedStep = asNumber(summary.firstFailedStep);
  if (firstFailedStep !== null) {
    lines.push(
      `first failure step=${firstFailedStep} command=${asString(summary.firstFailedCommand) ?? "-"} reason=${asString(summary.firstFailureReasonCode) ?? "-"}`,
    );
    const message = asString(summary.firstFailureMessage);
    if (message) {
      lines.push(message);
    }
    const suggestions = asArray(summary.firstFailureSuggestions).map(String);
    if (suggestions.length > 0) {
      lines.push("Try:");
      lines.push(...suggestions.map((item) => `- ${item}`));
    }
  }
  if (warnings.length > 0) {
    lines.push("warnings:");
    lines.push(...warnings.map((item) => `- ${item}`));
  }
  if (hasOutputFlag("--include-results")) {
    const results = asArray(result.data.results);
    if (results.length > 0) {
      lines.push("steps:");
      for (const entry of results) {
        const step = asRecord(entry);
        const ok = Boolean(step.ok);
        const error = asRecord(step.error);
        const index = asNumber(step.index);
        const command = asString(step.command) ?? asString(step.step) ?? "-";
        const message = asString(error.message);
        lines.push(
          `${index !== null ? index + 1 : "?"}. ${ok ? "ok" : "failed"} ${command}${ok || !message ? "" : ` ${message}`}`.trim(),
        );
      }
    }
  }
  return lines.join("\n");
}

function formatCommandText(command: string, result: CommandResult): string {
  if (command === "batch") {
    return formatBatch(result);
  }
  if (command === "read-text") {
    return formatReadText(result);
  }
  if (command === "snapshot") {
    return formatSnapshot(result);
  }
  if (command === "network") {
    return formatNetwork(result);
  }
  if (command === "console") {
    return formatConsole(result);
  }
  if (command === "diagnostics digest") {
    return formatDiagnosticsDigest(result);
  }
  if (command.startsWith("page ")) {
    return formatPage(result);
  }
  if (command.startsWith("session ")) {
    return formatSession(result);
  }
  if (
    [
      "open",
      "click",
      "fill",
      "type",
      "press",
      "wait",
      "scroll",
      "upload",
      "download",
      "drag",
    ].includes(command)
  ) {
    return formatAction(command, result);
  }

  const page = pageLine(result.page);
  return [page ? `page ${page}` : null, stringifyValue(result.data)].filter(Boolean).join("\n");
}

export function printCommandResult(command: string, result: CommandResult) {
  if (outputMode() === "json") {
    printJson(commandEnvelope(command, result));
    return;
  }
  printText(formatCommandText(command, result));
}

export function printNotImplemented(command: string, suggestions: string[]): void {
  printCommandError(command, {
    code: "NOT_IMPLEMENTED",
    message: `Command '${command}' is not implemented yet`,
    suggestions,
  });
}

export function printCommandError(command: string, error: CommandError) {
  if (outputMode() === "json") {
    printJson(errorEnvelope(command, error));
    return;
  }

  const lines = [`ERROR ${error.code}`, error.message];
  const suggestions = error.suggestions ?? [];
  if (suggestions.length > 0) {
    lines.push("Try:");
    lines.push(...suggestions.map((item) => `- ${item}`));
  }
  if (error.details) {
    lines.push("Details:");
    lines.push(JSON.stringify(error.details, null, 2));
  }
  printText(lines.join("\n"));
}

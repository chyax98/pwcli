type CommandResult = {
  session?: Record<string, unknown>;
  page?: Record<string, unknown>;
  diagnostics?: unknown[];
  data: Record<string, unknown>;
};

export type RecoveryKind =
  | "retry"
  | "inspect"
  | "recreate"
  | "re-snapshot"
  | "dismiss-dialog"
  | "reauth"
  | "human-handoff";

type CommandError = {
  code: string;
  message: string;
  retryable?: boolean;
  suggestions?: string[];
  recovery?: {
    kind: RecoveryKind;
    commands: string[];
  };
  details?: Record<string, unknown>;
};

type OutputMode = "text" | "json";

let cachedOutputMode: OutputMode | undefined;

function outputMode(): OutputMode {
  if (cachedOutputMode !== undefined) {
    return cachedOutputMode;
  }
  const envMode = process.env.PWCLI_OUTPUT?.trim().toLowerCase();
  if (envMode === "json" || envMode === "text") {
    cachedOutputMode = envMode;
    return cachedOutputMode;
  }

  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    const mode = process.argv[outputIndex + 1]?.trim().toLowerCase();
    if (mode === "json" || mode === "text") {
      cachedOutputMode = mode;
      return cachedOutputMode;
    }
  }

  const outputPrefix = "--output=";
  const outputArg = process.argv.find((arg) => arg.startsWith(outputPrefix));
  const mode = outputArg?.slice(outputPrefix.length).trim().toLowerCase();
  if (mode === "json" || mode === "text") {
    cachedOutputMode = mode;
    return cachedOutputMode;
  }

  cachedOutputMode = "text";
  return cachedOutputMode;
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
      ...(error.recovery ? { recovery: error.recovery } : {}),
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

function workspacePageLine(page: unknown): string {
  const record = asRecord(page);
  const pageId = asString(record.pageId) ?? "-";
  const navigationId = asString(record.navigationId);
  const index = asNumber(record.index);
  const current = record.current === true ? "current=true" : "current=false";
  const label = pageLine(record) ?? stringifyValue(record);
  return [
    `pageId=${pageId}`,
    index !== null ? `index=${index}` : null,
    navigationId ? `navigationId=${navigationId}` : null,
    current,
    label,
  ]
    .filter(Boolean)
    .join(" ");
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
  if (delta.unavailable) {
    return [`delta unavailable: ${asString(delta.reason) ?? "unknown"}`];
  }
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

function formatDiagnosticsRuns(result: CommandResult): string {
  const runs = asArray(result.data.runs);
  const lines = [`runs count=${asNumber(result.data.count) ?? runs.length}`];
  for (const item of runs) {
    const run = asRecord(item);
    const summary = asRecord(run.summary);
    const runId = asString(run.runId) ?? "-";
    const sessionName = asString(run.sessionName) ?? "-";
    const last = asString(run.lastTimestamp) ?? "-";
    const commandCount = asNumber(run.commandCount) ?? 0;
    const failureCount = asNumber(summary.failureCount) ?? 0;
    const signalCount = asNumber(summary.signalCount) ?? 0;
    lines.push(
      `${runId} session=${sessionName} commands=${commandCount} failures=${failureCount} signals=${signalCount} last=${last}`,
    );
  }
  return lines.join("\n");
}

function formatTraceInspect(result: CommandResult): string {
  const output = asString(result.data.output) ?? "";
  const limitations = asArray(result.data.limitations).map(String);
  const lines = [
    `section=${asString(result.data.section) ?? "-"} trace=${asString(result.data.tracePath) ?? "-"}`,
    `command=${asString(result.data.command) ?? "-"}`,
  ];
  const limit = asNumber(result.data.limit);
  if (limit !== null) {
    lines.push(`limit=${limit}`);
  }
  if (limitations.length > 0) {
    lines.push("limitations:");
    lines.push(...limitations.map((item) => `- ${item}`));
  }
  if (result.data.truncated) {
    const lineCount = asNumber(result.data.outputLineCount);
    const shownLines = asNumber(result.data.outputLinesShown);
    const charCount = asNumber(result.data.outputCharCount) ?? output.length;
    lines.push(
      lineCount !== null && shownLines !== null
        ? `output truncated at ${shownLines}/${lineCount} lines and ${output.length}/${charCount} chars`
        : `output truncated at ${output.length}/${charCount} chars`,
    );
  }
  lines.push(output || "(empty trace CLI output)");
  return lines.join("\n");
}

function formatTrace(result: CommandResult): string {
  const action = asString(result.data.action) ?? "trace";
  const facts = [
    result.data.started === true ? "started=true" : null,
    result.data.stopped === true ? "stopped=true" : null,
  ].filter(Boolean);
  const lines = [`trace ${action}${facts.length > 0 ? ` ${facts.join(" ")}` : ""}`];
  const artifactPath = asString(result.data.traceArtifactPath);
  if (artifactPath) {
    lines.push(`artifact=${artifactPath}`);
  }
  const nextStep = asString(result.data.nextStep);
  if (nextStep) {
    lines.push(`next=${nextStep}`);
  }
  const inspectHint = asString(result.data.inspectHint);
  if (inspectHint) {
    lines.push(`hint=${inspectHint}`);
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
        return `${prefix} ${workspacePageLine(page)}`;
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
    "checked",
    "selected",
    "saved",
    "modalPending",
  ];
  const facts = keys
    .filter((key) => key in result.data)
    .map((key) => `${key}=${String(result.data[key])}`);
  const lines = [`${command}${facts.length > 0 ? ` ${facts.join(" ")}` : " ok"}`];
  if (page) {
    lines.push(`page ${page}`);
  }
  const blockedState = asString(result.data.blockedState);
  if (blockedState) {
    lines.push(`blockedState=${blockedState}`);
  }
  const runPointer = formatRunPointer(result.data.run);
  if (runPointer) {
    lines.push(runPointer);
  }
  const nextSteps = asArray(result.data.nextSteps).map(String);
  if (nextSteps.length > 0) {
    lines.push("Next steps:");
    lines.push(...nextSteps.map((item) => `- ${item}`));
  }
  lines.push(...formatDiagnosticsDelta(result.data.diagnosticsDelta));
  return lines.join("\n");
}

function formatStateTarget(value: unknown): string {
  const target = asRecord(value);
  const nth = asNumber(target.nth);
  const nthSuffix = nth !== null ? ` nth=${nth}` : "";
  if (typeof target.selector === "string") {
    return `selector=${target.selector}${nthSuffix}`;
  }
  if (typeof target.text === "string") {
    return `text=${JSON.stringify(target.text)}${nthSuffix}`;
  }
  if (typeof target.role === "string") {
    const name = typeof target.name === "string" ? ` name=${JSON.stringify(target.name)}` : "";
    return `role=${target.role}${name}${nthSuffix}`;
  }
  if (typeof target.label === "string") {
    return `label=${JSON.stringify(target.label)}${nthSuffix}`;
  }
  if (typeof target.placeholder === "string") {
    return `placeholder=${JSON.stringify(target.placeholder)}${nthSuffix}`;
  }
  if (typeof target.testid === "string") {
    return `testid=${target.testid}${nthSuffix}`;
  }
  return stringifyValue(target);
}

function formatStateCheck(command: string, result: CommandResult): string {
  const target = formatStateTarget(result.data.target);
  const count = asNumber(result.data.count) ?? 0;
  if (command === "locate") {
    const candidates = asArray(result.data.candidates);
    const lines = [`locate count=${count} ${target}`];
    for (const candidate of candidates) {
      const item = asRecord(candidate);
      const index = asNumber(item.index) ?? "?";
      const tagName = asString(item.tagName) ?? "node";
      const visible = Boolean(item.visible);
      const text = asString(item.text) ?? "";
      const href = asString(item.href);
      const role = asString(item.role);
      const name = asString(item.name);
      const region = asString(item.region);
      const ancestor = asString(item.ancestor);
      const selectorHint = asString(item.selectorHint);
      lines.push(
        `${index}. ${tagName} visible=${visible}${role ? ` role=${JSON.stringify(role)}` : ""}${name ? ` name=${JSON.stringify(name)}` : ""}${href ? ` href=${JSON.stringify(href)}` : ""}${region ? ` region=${JSON.stringify(region)}` : ""}${ancestor ? ` ancestor=${JSON.stringify(ancestor)}` : ""}${selectorHint ? ` selectorHint=${JSON.stringify(selectorHint)}` : ""}${text ? ` text=${JSON.stringify(text)}` : ""}`,
      );
    }
    return lines.join("\n");
  }
  if (command === "get") {
    return `get ${asString(result.data.fact) ?? "fact"}=${stringifyValue(result.data.value)} count=${count} ${target}`;
  }
  return `is ${asString(result.data.state) ?? "state"}=${String(Boolean(result.data.value))} count=${count} ${target}`;
}

function formatVerify(result: CommandResult): string {
  const assertion = asString(result.data.assertion) ?? "assertion";
  const passed = Boolean(result.data.passed);
  const target = result.data.target ? ` ${formatStateTarget(result.data.target)}` : "";
  const actual = "actual" in result.data ? ` actual=${stringifyValue(result.data.actual)}` : "";
  const expected =
    "expected" in result.data ? ` expected=${stringifyValue(result.data.expected)}` : "";
  const count = asNumber(result.data.count);
  return `verify ${assertion} passed=${passed}${target}${count !== null ? ` count=${count}` : ""}${actual}${expected}`;
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
  if (command === "locate" || command === "get" || command === "is") {
    return formatStateCheck(command, result);
  }
  if (command === "verify") {
    return formatVerify(result);
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
  if (command === "diagnostics runs") {
    return formatDiagnosticsRuns(result);
  }
  if (command === "trace inspect") {
    return formatTraceInspect(result);
  }
  if (command === "trace start" || command === "trace stop") {
    return formatTrace(result);
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
      "hover",
      "wait",
      "scroll",
      "upload",
      "download",
      "drag",
      "check",
      "uncheck",
      "select",
      "pdf",
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

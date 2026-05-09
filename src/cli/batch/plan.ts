export const SUPPORTED_BATCH_TOP_LEVEL = [
  "bootstrap",
  "check",
  "click",
  "code",
  "errors",
  "fill",
  "get",
  "hover",
  "is",
  "locate",
  "open",
  "page",
  "press",
  "read-text",
  "route",
  "screenshot",
  "scroll",
  "select",
  "snapshot",
  "state",
  "status",
  "type",
  "uncheck",
  "verify",
  "wait",
] as const;

type BatchStepKind = "mutation" | "read" | "recovery" | "session-shape" | "transition" | "wait";

export function formatBatchArgv(argv: string[]) {
  return argv.map((part) => (/[\s"'\\]/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function classifyBatchStep(tokens: string[]): BatchStepKind {
  const [command, subcommand] = tokens;
  if (command === "wait") return "wait";
  if (command === "open" || command === "click" || command === "press") return "transition";
  if (
    command === "fill" ||
    command === "type" ||
    command === "scroll" ||
    command === "route" ||
    command === "bootstrap" ||
    (command === "state" && subcommand === "load") ||
    command === "code" ||
    command === "check" ||
    command === "uncheck" ||
    command === "select" ||
    command === "hover"
  ) {
    return command === "code" ? "session-shape" : "mutation";
  }
  if (command === "errors" && subcommand === "clear") return "recovery";
  return "read";
}

export function unsupportedBatchStepMessage(tokens: string[]) {
  const [command] = tokens;
  if (!command) return "batch step is empty";
  if (command === "session") {
    return "batch does not support session lifecycle; run `session create|attach|recreate` before batch";
  }
  if (command === "environment") {
    return "batch does not support environment mutation in the stable subset; run environment commands directly before batch";
  }
  if (command === "auth") {
    return "batch does not support auth provider execution; run `auth` directly before batch";
  }
  if (command === "dialog") {
    return "batch does not support dialog recovery; recover the modal first with `dialog accept|dismiss`";
  }
  if (command === "diagnostics" || command === "network" || command === "console") {
    return "batch does not support diagnostics query commands; run diagnostics directly after the dependent batch flow";
  }
  return `unsupported batch step '${command}'`;
}

export function findInvalidBatchStep(commands: string[][]) {
  for (const [index, tokens] of commands.entries()) {
    const [command] = tokens;
    if (!command) return { index, tokens, message: "batch step is empty" };
    if (
      !SUPPORTED_BATCH_TOP_LEVEL.includes(command as (typeof SUPPORTED_BATCH_TOP_LEVEL)[number])
    ) {
      return { index, tokens, message: unsupportedBatchStepMessage(tokens) };
    }
  }
  return null;
}

export function analyzeBatchPlan(commands: string[][], continueOnError?: boolean) {
  const warnings: string[] = [];
  commands.forEach((tokens, index) => {
    const kind = classifyBatchStep(tokens);
    const next = commands[index + 1];
    const nextKind = next ? classifyBatchStep(next) : null;
    const rawStep = formatBatchArgv(tokens);
    const nextRawStep = next ? formatBatchArgv(next) : null;
    if (
      (tokens[0] === "open" || tokens[0] === "click" || tokens[0] === "press") &&
      next &&
      nextKind !== "wait"
    ) {
      warnings.push(
        `step ${index + 1} (${rawStep}) changes page state; if step ${index + 2} (${nextRawStep}) depends on navigation or network completion, insert an explicit wait first`,
      );
    }
    if (tokens[0] === "code" && commands.length > 1) {
      warnings.push(
        `step ${index + 1} (${rawStep}) uses opaque code; isolate it or keep it at the end of the serial flow when possible`,
      );
    }
    if (
      continueOnError &&
      (kind === "mutation" || kind === "transition" || kind === "session-shape") &&
      next
    ) {
      warnings.push(
        `step ${index + 1} (${rawStep}) mutates session state; --continue-on-error can make later steps consume stale state`,
      );
    }
  });
  return {
    serialOnly: true,
    requiresExistingSession: true,
    stepCount: commands.length,
    continueOnError: Boolean(continueOnError),
    supportedTopLevel: [...SUPPORTED_BATCH_TOP_LEVEL],
    warnings,
  };
}

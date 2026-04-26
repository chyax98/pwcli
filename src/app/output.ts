export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printSuccess(command: string, data: Record<string, unknown>): void {
  printJson({
    ok: true,
    command,
    data,
  });
}

export function printCommandResult(
  command: string,
  result: {
    session?: Record<string, unknown>;
    page?: Record<string, unknown>;
    diagnostics?: unknown[];
    data: Record<string, unknown>;
  },
) {
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
  printJson({
    ok: true,
    command,
    ...(result.session ? { session: result.session } : {}),
    ...(result.page ? { page: result.page } : {}),
    ...(result.diagnostics && result.diagnostics.length > 0
      ? { diagnostics: result.diagnostics }
      : {}),
    data,
  });
}

export function printNotImplemented(command: string, suggestions: string[]): void {
  printJson({
    ok: false,
    command,
    error: {
      code: "NOT_IMPLEMENTED",
      message: `Command '${command}' is not implemented yet`,
      retryable: false,
      suggestions,
    },
  });
}

export function printCommandError(
  command: string,
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    suggestions?: string[];
    details?: Record<string, unknown>;
  },
) {
  printJson({
    ok: false,
    command,
    error: {
      code: error.code,
      message: error.message,
      retryable: Boolean(error.retryable),
      suggestions: error.suggestions ?? [],
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

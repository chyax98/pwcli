import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { parsePageSummary, runManagedSessionCommand } from "../session.js";
import { managedRunCode, maybeRawOutput, stateAccessPrelude } from "../shared.js";

const TRACE_INSPECT_OUTPUT_LIMIT = 50_000;

export type TraceInspectSection = "actions" | "requests" | "console" | "errors";

export class TraceInspectError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "TraceInspectError";
    this.code = code;
    this.details = details;
  }
}

const requireFromHere = createRequire(import.meta.url);

function playwrightCoreRoot() {
  return dirname(requireFromHere.resolve("playwright-core/package.json"));
}

function playwrightTraceCliPaths() {
  const root = playwrightCoreRoot();
  return {
    entrypoint: resolve(root, "cli.js"),
    traceCli: resolve(root, "lib", "tools", "trace", "traceCli.js"),
  };
}

function runTraceCli(args: string[], cwd: string) {
  const paths = playwrightTraceCliPaths();
  if (!existsSync(paths.entrypoint) || !existsSync(paths.traceCli)) {
    throw new TraceInspectError(
      "TRACE_CLI_UNAVAILABLE",
      "Playwright trace CLI is unavailable in the installed playwright-core package",
      {
        entrypoint: paths.entrypoint,
        entrypointAvailable: existsSync(paths.entrypoint),
        traceCli: paths.traceCli,
        traceCliAvailable: existsSync(paths.traceCli),
      },
    );
  }

  const result = spawnSync(process.execPath, [paths.entrypoint, "trace", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: TRACE_INSPECT_OUTPUT_LIMIT * 200,
  });
  return {
    ...result,
    command: `playwright trace ${args.map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg)).join(" ")}`,
  };
}

function boundedOutput(value: string, lineLimit?: number) {
  const lines = value.split(/\r?\n/);
  const lineLimited = lineLimit && lineLimit > 0 && lines.length > lineLimit;
  const lineLimitedValue = lineLimited ? lines.slice(0, lineLimit).join("\n") : value;
  const charLimited = lineLimitedValue.length > TRACE_INSPECT_OUTPUT_LIMIT;
  const output = charLimited
    ? lineLimitedValue.slice(0, TRACE_INSPECT_OUTPUT_LIMIT)
    : lineLimitedValue;
  return {
    output,
    outputCharCount: value.length,
    outputLineCount: lines.length,
    ...(lineLimit && lineLimit > 0 ? { outputLinesShown: Math.min(lines.length, lineLimit) } : {}),
    truncated: lineLimited || charLimited,
  };
}

function traceSectionArgs(options: {
  section: TraceInspectSection;
  failed?: boolean;
  level?: string;
}) {
  const args: string[] = [options.section];

  if (options.failed) {
    if (options.section === "requests") {
      args.push("--failed");
    } else {
      throw new TraceInspectError(
        "TRACE_FILTER_UNSUPPORTED",
        "--failed is only supported with --section requests",
        {
          section: options.section,
          filter: "failed",
        },
      );
    }
  }

  const level = options.level?.trim().toLowerCase();
  if (level) {
    if (options.section !== "console") {
      throw new TraceInspectError(
        "TRACE_FILTER_UNSUPPORTED",
        "--level is only supported with --section console",
        {
          section: options.section,
          filter: "level",
          level,
        },
      );
    } else if (level === "error") {
      args.push("--errors-only");
    } else if (level === "warning" || level === "warn") {
      args.push("--warnings");
    } else {
      throw new TraceInspectError(
        "TRACE_FILTER_UNSUPPORTED",
        "--level only supports error, warning, or warn",
        {
          section: options.section,
          filter: "level",
          level,
        },
      );
    }
  }

  return args;
}

export async function managedTraceInspect(options: {
  tracePath: string;
  section: TraceInspectSection;
  failed?: boolean;
  level?: string;
  limit?: number;
}) {
  const tracePath = resolve(options.tracePath);
  if (!existsSync(tracePath)) {
    throw new TraceInspectError("TRACE_FILE_NOT_FOUND", "Trace file does not exist", {
      tracePath,
    });
  }

  const tempDir = mkdtempSync(resolve(tmpdir(), "pwcli-trace-"));
  try {
    const openResult = runTraceCli(["open", tracePath], tempDir);
    const openOutput = `${openResult.stdout ?? ""}${openResult.stderr ?? ""}`;
    if (openResult.error) {
      throw new TraceInspectError("TRACE_CLI_FAILED", "Playwright trace CLI failed to open trace", {
        command: openResult.command,
        errorMessage: openResult.error.message,
        ...boundedOutput(openOutput, options.limit),
      });
    }
    if (openResult.status !== 0) {
      throw new TraceInspectError("TRACE_CLI_FAILED", "Playwright trace CLI failed to open trace", {
        command: openResult.command,
        exitCode: openResult.status,
        signal: openResult.signal,
        ...boundedOutput(openOutput, options.limit),
      });
    }

    const args = traceSectionArgs(options);
    const sectionResult = runTraceCli(args, tempDir);
    const output = `${sectionResult.stdout ?? ""}${sectionResult.stderr ?? ""}`;
    if (sectionResult.error) {
      throw new TraceInspectError(
        "TRACE_CLI_FAILED",
        "Playwright trace CLI failed to inspect trace",
        {
          command: sectionResult.command,
          errorMessage: sectionResult.error.message,
          ...boundedOutput(output, options.limit),
        },
      );
    }
    if (sectionResult.status !== 0) {
      throw new TraceInspectError(
        "TRACE_CLI_FAILED",
        "Playwright trace CLI failed to inspect trace",
        {
          command: sectionResult.command,
          exitCode: sectionResult.status,
          signal: sectionResult.signal,
          ...boundedOutput(output, options.limit),
        },
      );
    }

    return {
      data: {
        section: options.section,
        tracePath,
        command: sectionResult.command,
        commands: [openResult.command, sectionResult.command],
        failed: options.failed && options.section === "requests" ? true : undefined,
        level: options.level ?? null,
        limit: options.limit ?? null,
        ...boundedOutput(output, options.limit),
      },
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function managedTrace(action: "start" | "stop", options?: { sessionName?: string }) {
  const command = action === "start" ? "tracing-start" : "tracing-stop";
  const result = await runManagedSessionCommand(
    {
      _: [command],
    },
    {
      sessionName: options?.sessionName,
    },
  );
  const traceState = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude()}
      state.trace = {
        active: ${action === "start" ? "true" : "false"},
        supported: true,
        lastAction: ${JSON.stringify(action)},
        updatedAt: new Date().toISOString(),
      };
      return JSON.stringify(state.trace);
    }`,
  })
    .then((traceResult) => traceResult.data.result)
    .catch(() => undefined);
  const traceArtifactPath = parseTraceArtifactPath(result.text);

  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      action,
      started: action === "start" ? true : undefined,
      stopped: action === "stop" ? true : undefined,
      ...(traceArtifactPath ? { traceArtifactPath } : {}),
      ...(action === "stop" && traceArtifactPath
        ? {
            nextStep: `pw trace inspect ${JSON.stringify(traceArtifactPath)} --section actions`,
            inspectHint:
              "Use `pw trace inspect <traceArtifactPath> --section actions|requests|console|errors` to inspect the saved trace artifact.",
          }
        : {}),
      ...(traceState ? { trace: traceState } : {}),
      ...maybeRawOutput(result.text),
    },
  };
}

function parseTraceArtifactPath(text: string) {
  const match = text.match(/^- \[Trace\]\(([^)]+)\)$/m);
  return match?.[1];
}

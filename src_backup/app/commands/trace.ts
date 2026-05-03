import type { Command } from "commander";
import { managedTrace, managedTraceInspect } from "../../infra/playwright/runtime.js";
import { printCommandError, printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

const TRACE_INSPECT_SECTIONS = ["actions", "requests", "console", "errors"] as const;

type TraceInspectSection = (typeof TRACE_INSPECT_SECTIONS)[number];

function requireTraceInspectSection(value?: string): TraceInspectSection {
  const section = value?.trim();
  if (!section) {
    throw new Error("TRACE_SECTION_REQUIRED");
  }
  if (!TRACE_INSPECT_SECTIONS.includes(section as TraceInspectSection)) {
    throw new Error(`TRACE_SECTION_INVALID:${section}`);
  }
  return section as TraceInspectSection;
}

function printTraceInspectError(error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = typeof record.code === "string" ? record.code : undefined;
  if (code?.startsWith("TRACE_")) {
    printCommandError("trace inspect", {
      code,
      message: error instanceof Error ? error.message : "trace inspect failed",
      retryable: false,
      suggestions: [
        "Pass an existing trace zip produced by Playwright tracing",
        "Run `pnpm install` if the bundled Playwright trace CLI is unavailable",
      ],
      details:
        record.details && typeof record.details === "object"
          ? (record.details as Record<string, unknown>)
          : undefined,
    });
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (
    message === "TRACE_SECTION_REQUIRED" ||
    message.startsWith("TRACE_SECTION_INVALID:") ||
    message === "TRACE_LIMIT_INVALID"
  ) {
    printCommandError("trace inspect", {
      code:
        message === "TRACE_SECTION_REQUIRED"
          ? "TRACE_SECTION_REQUIRED"
          : message === "TRACE_LIMIT_INVALID"
            ? "TRACE_LIMIT_INVALID"
            : "TRACE_SECTION_INVALID",
      message:
        message === "TRACE_SECTION_REQUIRED"
          ? "trace inspect requires --section <section>"
          : message === "TRACE_LIMIT_INVALID"
            ? "trace inspect requires a positive integer for --limit"
            : `trace inspect received an invalid section: ${message.split(":").slice(1).join(":")}`,
      retryable: false,
      suggestions: ["Use --section actions|requests|console|errors", "Use --limit 20 to keep output compact"],
    });
    return;
  }

  printCommandError("trace inspect", {
    code: "TRACE_INSPECT_FAILED",
    message,
    retryable: false,
    suggestions: ["Use `pw trace inspect <trace.zip> --section actions`"],
  });
}

export function registerTraceCommand(program: Command): void {
  const trace = program.command("trace").description("Manage and inspect Playwright traces");

  addSessionOption(
    trace.command("start").description("Start tracing in a named managed session"),
  ).action(async (options: { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult("trace start", await managedTrace("start", { sessionName }));
    } catch (error) {
      printSessionAwareCommandError("trace start", error, {
        code: "TRACE_FAILED",
        message: "trace start failed",
        suggestions: ["Use `pw trace start --session bug-a`"],
      });
      process.exitCode = 1;
    }
  });

  addSessionOption(
    trace.command("stop").description("Stop tracing in a named managed session"),
  ).action(async (options: { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult("trace stop", await managedTrace("stop", { sessionName }));
    } catch (error) {
      printSessionAwareCommandError("trace stop", error, {
        code: "TRACE_FAILED",
        message: "trace stop failed",
        suggestions: ["Use `pw trace stop --session bug-a`"],
      });
      process.exitCode = 1;
    }
  });

  trace
    .command("inspect <file>")
    .description("Inspect an offline Playwright trace zip through the bundled trace CLI")
    .option("--section <section>", "actions, requests, console, or errors")
    .option("--failed", "Only failed requests when section=requests")
    .option("--level <level>", "Console level filter when section=console")
    .option("--limit <n>", "Limit trace inspect output to the first N lines")
    .action(
      async (
        file: string,
        options: {
          section?: string;
          failed?: boolean;
          level?: string;
          limit?: string;
        },
      ) => {
        try {
          const section = requireTraceInspectSection(options.section);
          const limit = options.limit ? Number(options.limit) : undefined;
          if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
            throw new Error("TRACE_LIMIT_INVALID");
          }
          const traceResult = await managedTraceInspect({
            tracePath: file,
            section,
            failed: options.failed,
            level: options.level,
            limit,
          });
          const level = options.level?.trim().toLowerCase();
          if (
            section === "console" &&
            level &&
            level !== "error" &&
            level !== "warning" &&
            level !== "warn"
          ) {
            (traceResult.data as Record<string, unknown>).note =
              "trace inspect --level only reliably filters 'error' and 'warning'; use pw console --session <name> --level <level> for live filtering";
          }
          printCommandResult("trace inspect", traceResult);
        } catch (error) {
          printTraceInspectError(error);
          process.exitCode = 1;
        }
      },
    );
}

import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedTrace, managedTraceInspect } from "#engine/diagnose/trace.js";
import {
  bool,
  type CliArgs,
  firstPos,
  num,
  print,
  printError,
  session,
  str,
  withCliError,
} from "./_helpers.js";

const start = defineCommand({
  meta: {
    name: "start",
    description:
      "Purpose: start Playwright tracing for a session.\nExamples:\n  pw trace start -s task-a\nNotes: tracing is normally enabled by session defaults; use this for explicit control.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("trace start", await managedTrace("start", { sessionName: session(a) }), a);
    } catch (e) {
      withCliError("trace start", a, e);
    }
  },
});
const stop = defineCommand({
  meta: {
    name: "stop",
    description:
      "Purpose: stop tracing and return the trace artifact path.\nExamples:\n  pw trace stop -s task-a\nNotes: inspect the returned trace zip with `pw trace inspect`.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("trace stop", await managedTrace("stop", { sessionName: session(a) }), a);
    } catch (e) {
      withCliError("trace stop", a, e);
    }
  },
});
const inspect = defineCommand({
  meta: {
    name: "inspect",
    description:
      "Purpose: inspect a trace archive section without opening the UI.\nExamples:\n  pw trace inspect ./trace.zip --section actions\n  pw trace inspect ./trace.zip --section requests --failed\nNotes: `--failed` only applies to requests; `--level` only applies to console.",
  },
  args: {
    ...sharedArgs,
    section: {
      type: "enum",
      options: ["actions", "requests", "console", "errors"],
      description: "Section",
      default: "actions",
    },
    failed: { type: "boolean", description: "Failed requests only" },
    level: { type: "string", description: "Console level", valueHint: "level" },
    limit: { type: "string", description: "Output line limit", valueHint: "n" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "trace inspect",
        await managedTraceInspect({
          tracePath: firstPos(a) as string,
          section: a.section as "actions" | "requests" | "console" | "errors",
          failed: bool(a.failed),
          level: str(a.level),
          limit: num(a.limit),
        }),
        a,
      );
    } catch (e) {
      printError("trace inspect", a, {
        code: (e as { code?: string }).code ?? "TRACE_INSPECT_FAILED",
        message: e instanceof Error ? e.message : String(e),
        details: (e as { details?: Record<string, unknown> }).details,
      });
    }
  },
});

export default defineCommand({
  meta: {
    name: "trace",
    description:
      "Purpose: start, stop, and inspect Playwright trace artifacts for diagnosis.\nExamples:\n  pw trace stop -s task-a\n  pw trace inspect .pwcli/runs/task/trace.zip --section actions\nNotes: `--failed` only applies to requests; `--level` only applies to console.",
  },
  subCommands: { start, stop, inspect },
});

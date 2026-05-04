import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import {
  HarCaptureUnsupportedError,
  managedHar,
  managedHarReplay,
  managedHarReplayStop,
} from "#engine/diagnose/har.js";
import {
  type CliArgs,
  firstPos,
  print,
  printError,
  session,
  str,
  withCliError,
} from "./_helpers.js";

function handleHarError(command: string, args: CliArgs, error: unknown) {
  if (error instanceof HarCaptureUnsupportedError) {
    printError(command, args, {
      code: error.code,
      message: error.message,
      retryable: false,
      suggestions: [
        "Use `pw network --session <name>` and `pw diagnostics export|bundle` for 1.0 network evidence",
        "Use `pw trace start|stop|inspect` when you need replayable browser evidence",
        "Use `pw har replay <file> --session <name>` with a pre-recorded HAR for deterministic stubbing",
      ],
      details: error.details,
    });
    return;
  }
  withCliError(command, args, error);
}

const start = defineCommand({
  meta: {
    name: "start",
    description:
      "Purpose: return the explicit unsupported guard for hot HAR recording.\nOptions: --path accepts the intended HAR path for the failure envelope.\nExamples:\n  pw har start -s task-a --path ./record.har\nNotes: hot HAR recording is unsupported for managed sessions; use har replay with a pre-recorded HAR, or network/diagnostics/trace for evidence.",
  },
  args: {
    ...sharedArgs,
    path: {
      type: "string",
      description: "HAR path for unsupported capture request",
      valueHint: "path",
    },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "har start",
        await managedHar("start", { sessionName: session(a), path: str(a.path) ?? firstPos(a) }),
        a,
      );
    } catch (e) {
      handleHarError("har start", a, e);
    }
  },
});
const stop = defineCommand({
  meta: {
    name: "stop",
    description:
      "Purpose: return the explicit unsupported guard for hot HAR recording stop.\nOptions: only the target session is required.\nExamples:\n  pw har stop -s task-a\nNotes: hot HAR recording is unsupported; use har replay/replay-stop for deterministic stubbing, or network/diagnostics/trace for evidence.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("har stop", await managedHar("stop", { sessionName: session(a) }), a);
    } catch (e) {
      handleHarError("har stop", a, e);
    }
  },
});
const replay = defineCommand({
  meta: {
    name: "replay",
    description:
      "Purpose: replay requests from a pre-recorded HAR file.\nOptions: pass the HAR file as the positional argument.\nExamples:\n  pw har replay ./fixture.har -s task-a\nNotes: replay is the supported HAR path; start/stop hot recording intentionally return unsupported.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "har replay",
        await managedHarReplay({ sessionName: session(a), filePath: firstPos(a) as string }),
        a,
      );
    } catch (e) {
      withCliError("har replay", a, e);
    }
  },
});
const replayStop = defineCommand({
  meta: { name: "replay-stop", description: "Stop HAR replay" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("har replay-stop", await managedHarReplayStop({ sessionName: session(a) }), a);
    } catch (e) {
      withCliError("har replay-stop", a, e);
    }
  },
});

export default defineCommand({
  meta: { name: "har", description: "HAR controls" },
  subCommands: { start, stop, replay, "replay-stop": replayStop },
});

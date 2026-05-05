import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedHarReplay, managedHarReplayStop } from "#engine/diagnose/har.js";
import { type CliArgs, firstPos, print, session, withCliError } from "./_helpers.js";

const replay = defineCommand({
  meta: {
    name: "replay",
    description:
      "Purpose: replay requests from a pre-recorded HAR file.\nOptions: pass the HAR file as the positional argument.\nExamples:\n  pw har replay ./fixture.har -s task-a\nNotes: recording is a session lifecycle option; use `pw session create --record-har <file>` or `pw session recreate --record-har <file>`.",
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
  meta: {
    name: "replay-stop",
    description:
      "Purpose: stop HAR replay routing for the session.\nExamples:\n  pw har replay-stop -s task-a\nNotes: if route cleanup is limited, recreate the session to fully reset routing.",
  },
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
  subCommands: { replay, "replay-stop": replayStop },
});

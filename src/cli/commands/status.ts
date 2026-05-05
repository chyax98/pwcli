import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedObserveStatus } from "#engine/diagnose/core.js";
import { type CliArgs, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "status",
    description:
      "Purpose: inspect the current session, page URL/title, workspace projection and preview stream state.\nExamples:\n  pw status -s task-a\n  pw status -s task-a --verbose\nNotes: use this before acting when the session state is uncertain.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("status", await managedObserveStatus({ sessionName: session(a) }), a);
    } catch (error) {
      withCliError("status", a, error);
    }
  },
});

import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedOpen } from "#engine/session.js";
import { type CliArgs, firstPos, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "open",
    description:
      "Purpose: navigate an existing managed session to a URL.\nExamples:\n  pw open -s task-a http://localhost:3000\nNotes: create the session first with `pw session create`; `open` never creates a session.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "open",
        await managedOpen(firstPos(a) as string, { sessionName: session(a), reset: false }),
        a,
      );
    } catch (e) {
      withCliError("open", a, e);
    }
  },
});

import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedScroll } from "#engine/act/page.js";
import { type CliArgs, num, positionals, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "scroll",
    description:
      "Purpose: scroll the current page or a target area.\nExamples:\n  pw scroll -s task-a --down 800\n  pw scroll -s task-a --selector '.list' --down 400\nNotes: verify newly revealed content with `read-text`, `snapshot`, or `locate`.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const parts = positionals(a);
      print(
        "scroll",
        await managedScroll({
          sessionName: session(a),
          direction: parts[0] as "up" | "down" | "left" | "right",
          distance: num(parts[1]),
        }),
        a,
      );
    } catch (error) {
      withCliError("scroll", a, error, "scroll failed");
    }
  },
});

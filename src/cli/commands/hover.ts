import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedHover } from "#engine/act/element.js";
import { actionTarget, type CliArgs, firstPos, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "hover",
    description:
      "Purpose: hover an element by ref, selector, or semantic locator.\nExamples:\n  pw hover -s task-a --text Menu\n  pw hover -s task-a --selector '.menu-trigger'\nNotes: use a read-only command after hover to inspect revealed content.",
  },
  args: actionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const result = await managedHover({
        sessionName: session(a),
        ...actionTarget(a, firstPos(a)),
      });
      print("hover", result, a);
    } catch (error) {
      withCliError("hover", a, error, "hover failed");
    }
  },
});

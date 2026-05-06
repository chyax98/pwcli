import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedHover } from "#engine/act/element.js";
import {
  actionTarget,
  attachSnapDiff,
  bool,
  type CliArgs,
  firstPos,
  print,
  session,
  withCliError,
} from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "hover",
    description:
      "Purpose: hover an element by ref, selector, or semantic locator.\nExamples:\n  pw hover -s task-a --text Menu\n  pw hover -s task-a --selector '.menu-trigger'\nNotes: use a read-only command after hover to inspect revealed content. Use `--diff` to see accessibility tree changes after the action.",
  },
  args: actionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sessionName = session(a);
      const result = await managedHover({
        sessionName,
        ...actionTarget(a, firstPos(a)),
      });
      if (bool(a["snap-diff"])) await attachSnapDiff(sessionName, result);
      print("hover", result, a);
    } catch (error) {
      withCliError("hover", a, error, "hover failed");
    }
  },
});

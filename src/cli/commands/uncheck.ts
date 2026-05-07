import { defineCommand } from "citty";
import { interactiveActionArgs } from "#cli/args.js";
import { managedUncheck } from "#engine/act/element.js";
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
    name: "uncheck",
    description:
      "Purpose: uncheck a checkbox control by ref, selector, or semantic locator.\nExamples:\n  pw uncheck -s task-a --label Subscribe\n  pw uncheck -s task-a --selector '#subscribe'\nNotes: use `is checked` afterward when the checked state matters. Use `--diff` to see accessibility tree changes after the action.",
  },
  args: interactiveActionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sessionName = session(a);
      const result = await managedUncheck({ sessionName, ...actionTarget(a, firstPos(a)) });
      if (bool(a["snap-diff"])) await attachSnapDiff(sessionName, result);
      print("uncheck", result, a);
    } catch (error) {
      withCliError("uncheck", a, error, "uncheck failed");
    }
  },
});

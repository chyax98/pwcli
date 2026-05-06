import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedCheck } from "#engine/act/element.js";
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
    name: "check",
    description:
      "Purpose: check a checkbox or radio control by ref, selector, or semantic locator.\nExamples:\n  pw check -s task-a --label 'I agree'\n  pw check -s task-a --selector '#terms'\nNotes: use `is checked` afterward when the checked state matters. Use `--diff` to see accessibility tree changes after the action.",
  },
  args: actionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sessionName = session(a);
      const result = await managedCheck({ sessionName, ...actionTarget(a, firstPos(a)) });
      if (bool(a["snap-diff"])) await attachSnapDiff(sessionName, result);
      print("check", result, a);
    } catch (error) {
      withCliError("check", a, error, "check failed");
    }
  },
});

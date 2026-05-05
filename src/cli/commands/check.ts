import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedCheck } from "#engine/act/element.js";
import { actionTarget, type CliArgs, firstPos, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "check",
    description:
      "Purpose: check a checkbox or radio control by ref, selector, or semantic locator.\nExamples:\n  pw check -s task-a --label 'I agree'\n  pw check -s task-a --selector '#terms'\nNotes: use `is checked` afterward when the checked state matters.",
  },
  args: actionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "check",
        await managedCheck({ sessionName: session(a), ...actionTarget(a, firstPos(a)) }),
        a,
      );
    } catch (error) {
      withCliError("check", a, error, "check failed");
    }
  },
});

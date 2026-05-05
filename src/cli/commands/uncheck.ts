import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedUncheck } from "#engine/act/element.js";
import { actionTarget, type CliArgs, firstPos, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "uncheck",
    description:
      "Purpose: uncheck a checkbox control by ref, selector, or semantic locator.\nExamples:\n  pw uncheck -s task-a --label Subscribe\n  pw uncheck -s task-a --selector '#subscribe'\nNotes: use `is checked` afterward when the checked state matters.",
  },
  args: actionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "uncheck",
        await managedUncheck({ sessionName: session(a), ...actionTarget(a, firstPos(a)) }),
        a,
      );
    } catch (error) {
      withCliError("uncheck", a, error, "uncheck failed");
    }
  },
});

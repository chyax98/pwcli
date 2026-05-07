import { defineCommand } from "citty";
import { interactiveActionArgs } from "#cli/args.js";
import { managedClick } from "#engine/act/element.js";
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
    name: "click",
    description:
      "Purpose: click an element by ref, selector, or semantic locator.\nExamples:\n  pw click -s task-a --text Submit\n  pw click -s task-a --ref e12\n  pw click -s task-a --ref e12 --diff\nNotes: follow clicks with `wait` and a read-only verification command. Use `--diff` to see accessibility tree changes after the action.",
  },
  args: {
    ...interactiveActionArgs,
    button: {
      type: "enum",
      options: ["left", "right", "middle"],
      description: "Mouse button",
      default: "left",
    },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sessionName = session(a);
      const result = await managedClick({
        sessionName,
        ...actionTarget(a, firstPos(a)),
        button: a.button !== "left" ? (a.button as string) : undefined,
      });
      if (bool(a["snap-diff"])) await attachSnapDiff(sessionName, result);
      print("click", result, a);
    } catch (error) {
      withCliError("click", a, error, "click failed");
    }
  },
});

import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedClick } from "#engine/act/element.js";
import { actionTarget, type CliArgs, firstPos, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "click",
    description:
      "Purpose: click an element by ref, selector, or semantic locator.\nExamples:\n  pw click -s task-a --text Submit\n  pw click -s task-a --ref e12\nNotes: follow clicks with `wait` and a read-only verification command.",
  },
  args: {
    ...actionArgs,
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
      print("click", result, a);
    } catch (error) {
      withCliError("click", a, error, "click failed");
    }
  },
});

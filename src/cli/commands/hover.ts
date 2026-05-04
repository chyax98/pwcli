import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedHover } from "#engine/act/element.js";
import { actionTarget, type CliArgs, firstPos, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: { name: "hover", description: "Hover an element by ref, selector, or semantic locator" },
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

import { defineCommand } from "citty";
import { managedUncheck } from "#engine/act/element.js";
import { actionArgs } from "#cli/args.js";
import { actionTarget, firstPos, print, session, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "uncheck", description: "Uncheck a checkbox control" },
  args: actionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("uncheck", await managedUncheck({ sessionName: session(a), ...actionTarget(a, firstPos(a)) }), a);
    } catch (error) {
      withCliError("uncheck", a, error, "uncheck failed");
    }
  },
});

import { defineCommand } from "citty";
import { managedCheck } from "#engine/act/element.js";
import { actionArgs } from "#cli/args.js";
import { actionTarget, firstPos, print, session, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "check", description: "Check a checkbox or radio control" },
  args: actionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("check", await managedCheck({ sessionName: session(a), ...actionTarget(a, firstPos(a)) }), a);
    } catch (error) {
      withCliError("check", a, error, "check failed");
    }
  },
});

import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedLocate } from "#engine/observe.js";
import { bool, type CliArgs, print, session, stateTarget, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: { name: "locate", description: "Locate state target candidates" },
  args: {
    ...actionArgs,
    nth: { ...actionArgs.nth, default: undefined },
    "return-ref": { type: "boolean", description: "Try returning a fresh snapshot ref" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    const returnRef =
      bool(a["return-ref"]) || bool(a.returnRef) || a["return-ref"] === "" || a.returnRef === "";
    try {
      print(
        "locate",
        await managedLocate({ sessionName: session(a), target: stateTarget(a), returnRef }),
        a,
      );
    } catch (error) {
      withCliError("locate", a, error);
    }
  },
});

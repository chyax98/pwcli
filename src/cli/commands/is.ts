import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedIsState } from "#engine/observe.js";
import { type CliArgs, firstPos, print, session, stateTarget, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: { name: "is", description: "Check target state" },
  args: {
    ...actionArgs,
    state: {
      type: "enum",
      options: ["visible", "enabled", "checked"],
      description: "State to check",
    },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const state = (a.state ?? firstPos(a)) as "visible" | "enabled" | "checked";
      print(
        "is",
        await managedIsState({ sessionName: session(a), target: stateTarget(a), state }),
        a,
      );
    } catch (error) {
      withCliError("is", a, error);
    }
  },
});

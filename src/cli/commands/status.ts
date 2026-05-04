import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedObserveStatus } from "#engine/diagnose/core.js";
import { type CliArgs, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: { name: "status", description: "Show session and page status overview" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("status", await managedObserveStatus({ sessionName: session(a) }), a);
    } catch (error) {
      withCliError("status", a, error);
    }
  },
});

import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedOpen } from "#engine/session.js";
import { assertActionAllowed } from "#store/action-policy.js";
import { type CliArgs, firstPos, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: { name: "open", description: "Navigate an existing managed session" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      await assertActionAllowed("navigate", "open");
      print(
        "open",
        await managedOpen(firstPos(a) as string, { sessionName: session(a), reset: false }),
        a,
      );
    } catch (e) {
      withCliError("open", a, e);
    }
  },
});

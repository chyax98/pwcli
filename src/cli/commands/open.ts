import { defineCommand } from "citty";
import { managedOpen } from "#engine/session.js";
import { sharedArgs } from "#cli/args.js";
import { firstPos, print, session, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "open", description: "Navigate an existing managed session" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try { print("open", await managedOpen(firstPos(a) as string, { sessionName: session(a), reset: false }), a); } catch (e) { withCliError("open", a, e); }
  },
});

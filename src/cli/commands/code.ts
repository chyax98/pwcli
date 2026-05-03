import { defineCommand } from "citty";
import { managedRunCode } from "#engine/shared.js";
import { sharedArgs } from "#cli/args.js";
import { firstPos, num, print, session, sourceFromArgs, str, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "code", description: "Run direct Playwright page code" },
  args: { ...sharedArgs, file: { type: "string", description: "Source file", valueHint: "path" }, retry: { type: "string", description: "Retry count", default: "0", valueHint: "n" } },
  async run({ args }) {
    const a = args as CliArgs;
    try { print("code", await managedRunCode({ sessionName: session(a), source: (await sourceFromArgs(firstPos(a), str(a.file))) ?? "", retry: num(a.retry, 0) }), a); } catch (e) { withCliError("code", a, e); }
  },
});

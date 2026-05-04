import { defineCommand } from "citty";
import { managedRunCode } from "#engine/shared.js";
import { sharedArgs } from "#cli/args.js";
import { firstPos, num, print, session, sourceFromArgs, str, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "code",
    description:
      "Purpose: run a short Playwright page-context escape hatch in an existing session.\nOptions: pass inline source as the positional argument or use --file.\nExamples:\n  pw code -s task-a 'return await page.title()'\n  pw code -s task-a --file ./probe.js\nNotes: do not use code as a long workflow runner; prefer first-class commands plus explicit wait/verify steps.",
  },
  args: { ...sharedArgs, file: { type: "string", description: "Source file containing page-context code", valueHint: "path" }, retry: { type: "string", description: "Retry count", default: "0", valueHint: "n" } },
  async run({ args }) {
    const a = args as CliArgs;
    try { print("code", await managedRunCode({ sessionName: session(a), source: (await sourceFromArgs(firstPos(a), str(a.file))) ?? "", retry: num(a.retry, 0) }), a); } catch (e) { withCliError("code", a, e); }
  },
});

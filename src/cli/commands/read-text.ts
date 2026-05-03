import { defineCommand } from "citty";
import { managedReadText } from "#engine/act/page.js";
import { sharedArgs } from "#cli/args.js";
import { bool, num, print, session, str, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "read-text", description: "Read visible page text" },
  args: { ...sharedArgs, selector: { type: "string", description: "Read text from selector", valueHint: "css" }, "include-overlay": { type: "boolean", description: "Include overlay text", default: true }, "max-chars": { type: "string", description: "Maximum characters", valueHint: "n" } },
  async run({ args }) {
    const a = args as CliArgs;
    try { print("read-text", await managedReadText({ sessionName: session(a), selector: str(a.selector), includeOverlay: a["include-overlay"] !== false, maxChars: num(a["max-chars"]) }), a); } catch (error) { withCliError("read-text", a, error); }
  },
});

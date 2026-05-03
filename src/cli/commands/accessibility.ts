import { defineCommand } from "citty";
import { managedAccessibilitySnapshot } from "#engine/observe.js";
import { sharedArgs } from "#cli/args.js";
import { bool, print, session, str, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "accessibility", description: "Capture page accessibility tree" },
  args: { ...sharedArgs, "interactive-only": { type: "boolean", description: "Return only interactive nodes", alias: ["interactive"] }, root: { type: "string", description: "Root selector", valueHint: "css" } },
  async run({ args }) {
    const a = args as CliArgs;
    try { print("accessibility", await managedAccessibilitySnapshot({ sessionName: session(a), interactiveOnly: bool(a["interactive-only"]), root: str(a.root) }), a); } catch (error) { withCliError("accessibility", a, error); }
  },
});

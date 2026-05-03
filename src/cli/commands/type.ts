import { defineCommand } from "citty";
import { managedType } from "#engine/act/element.js";
import { actionArgs } from "#cli/args.js";
import { actionTarget, positionals, print, session, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "type", description: "Type text into page or an element" },
  args: actionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const parts = positionals(a);
      const hasFlagTarget = Boolean(a.selector || a.text || a.role || a.label || a.placeholder || a["test-id"]);
      const ref = hasFlagTarget || parts.length === 1 ? undefined : parts.shift();
      const value = parts.join(" ");
      const result = await managedType({ sessionName: session(a), ...actionTarget(a, ref), value });
      print("type", result, a);
    } catch (error) {
      withCliError("type", a, error, "type failed");
    }
  },
});

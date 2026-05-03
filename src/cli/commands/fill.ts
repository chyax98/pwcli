import { defineCommand } from "citty";
import { managedFill } from "#engine/act/element.js";
import { actionArgs } from "#cli/args.js";
import { actionTarget, positionals, print, session, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "fill", description: "Fill an input by ref, selector, or semantic locator" },
  args: actionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const parts = positionals(a);
      const hasFlagTarget = Boolean(a.selector || a.text || a.role || a.label || a.placeholder || a["test-id"]);
      const ref = hasFlagTarget ? undefined : parts.shift();
      const value = parts.join(" ");
      const sessionName = session(a);
      const result = await managedFill({ sessionName, ...actionTarget(a, ref), value });
      print("fill", result, a);
    } catch (error) {
      withCliError("fill", a, error, "fill failed");
    }
  },
});

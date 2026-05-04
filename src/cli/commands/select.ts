import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedSelect } from "#engine/act/element.js";
import {
  actionTarget,
  type CliArgs,
  positionals,
  print,
  session,
  withCliError,
} from "./_helpers.js";

export default defineCommand({
  meta: { name: "select", description: "Select an option by ref, selector, or semantic locator" },
  args: actionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const parts = positionals(a);
      const hasFlagTarget = Boolean(
        a.selector || a.text || a.role || a.label || a.placeholder || a["test-id"],
      );
      const ref = hasFlagTarget ? undefined : parts.shift();
      const value = parts.join(" ");
      print(
        "select",
        await managedSelect({ sessionName: session(a), ...actionTarget(a, ref), value }),
        a,
      );
    } catch (error) {
      withCliError("select", a, error, "select failed");
    }
  },
});

import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedSelect } from "#engine/act/element.js";
import {
  actionTarget,
  attachSnapDiff,
  bool,
  type CliArgs,
  positionals,
  print,
  session,
  withCliError,
} from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "select",
    description:
      "Purpose: select an option in a select control by ref, selector, or semantic locator.\nExamples:\n  pw select -s task-a --label Country US\n  pw select -s task-a --selector '#country' US\n  pw select -s task-a --ref e8 'US' --diff\nNotes: pass the option value expected by the page. Use `--diff` to see accessibility tree changes after the action.",
  },
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
      const sessionName = session(a);
      const result = await managedSelect({ sessionName, ...actionTarget(a, ref), value });
      if (bool(a["snap-diff"])) await attachSnapDiff(sessionName, result);
      print("select", result, a);
    } catch (error) {
      withCliError("select", a, error, "select failed");
    }
  },
});

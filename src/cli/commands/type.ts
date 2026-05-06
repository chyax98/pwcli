import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedType } from "#engine/act/element.js";
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
    name: "type",
    description:
      "Purpose: type text into the focused page or a target element.\nExamples:\n  pw type -s task-a --selector '#search' query\n  pw type -s task-a 'free text'\nNotes: prefer `fill` for replacing input value; use `type` when key events matter. Use `--diff` to see accessibility tree changes after the action.",
  },
  args: actionArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const parts = positionals(a);
      const hasFlagTarget = Boolean(
        a.selector || a.text || a.role || a.label || a.placeholder || a["test-id"],
      );
      const ref = hasFlagTarget || parts.length === 1 ? undefined : parts.shift();
      const value = parts.join(" ");
      const sessionName = session(a);
      const result = await managedType({ sessionName, ...actionTarget(a, ref), value });
      if (bool(a["snap-diff"])) await attachSnapDiff(sessionName, result);
      print("type", result, a);
    } catch (error) {
      withCliError("type", a, error, "type failed");
    }
  },
});

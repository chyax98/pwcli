import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedAccessibilitySnapshot } from "#engine/observe.js";
import { bool, type CliArgs, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "accessibility",
    description:
      "Purpose: capture the page accessibility tree for structural reading.\nExamples:\n  pw accessibility -s task-a\n  pw accessibility -s task-a --interactive-only\nNotes: this is read-only and complements `snapshot` and `read-text`.",
  },
  args: {
    ...sharedArgs,
    "interactive-only": {
      type: "boolean",
      description: "Return only interactive nodes",
      alias: ["interactive"],
    },
    root: { type: "string", description: "Root selector", valueHint: "css" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "accessibility",
        await managedAccessibilitySnapshot({
          sessionName: session(a),
          interactiveOnly: bool(a["interactive-only"]),
          root: str(a.root),
        }),
        a,
      );
    } catch (error) {
      withCliError("accessibility", a, error);
    }
  },
});

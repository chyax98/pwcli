import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedReadText } from "#engine/act/page.js";
import { type CliArgs, num, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "read-text",
    description:
      "Purpose: read visible page text for fast Agent understanding.\nExamples:\n  pw read-text -s task-a --max-chars 2000\n  pw read-text -s task-a --selector main\nNotes: this is read-only; use `snapshot -i` when you need actionable refs.",
  },
  args: {
    ...sharedArgs,
    selector: { type: "string", description: "Read text from selector", valueHint: "css" },
    "include-overlay": { type: "boolean", description: "Include overlay text", default: true },
    "max-chars": { type: "string", description: "Maximum characters", valueHint: "n" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "read-text",
        await managedReadText({
          sessionName: session(a),
          selector: str(a.selector),
          includeOverlay: a["include-overlay"] !== false,
          maxChars: num(a["max-chars"]),
        }),
        a,
      );
    } catch (error) {
      withCliError("read-text", a, error);
    }
  },
});

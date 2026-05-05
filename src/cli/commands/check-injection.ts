import { defineCommand } from "citty";
import { managedCheckInjection } from "#engine/safety.js";
import { bool, type CliArgs, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "check-injection",
    description:
      "Purpose: scan page content for prompt-injection-like patterns.\nOptions: include visible content by default; use --include-hidden to scan hidden text too.\nExamples:\n  pw check-injection -s task-a\n  pw check-injection -s task-a --include-hidden\nNotes: this is a heuristic safety scan, not a formal guarantee. Treat high-severity findings as human-review signals.",
  },
  args: {
    session: {
      type: "string",
      alias: "s",
      description: "Target managed session",
      valueHint: "name",
    },
    output: { type: "string", description: "Output format: text|json", default: "text" },
    "include-hidden": { type: "boolean", description: "Scan hidden/invisible text as well" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "check-injection",
        await managedCheckInjection({
          sessionName: session(a),
          includeHidden: bool(a["include-hidden"]),
        }),
        a,
      );
    } catch (error) {
      withCliError("check-injection", a, error, "check-injection failed");
    }
  },
});

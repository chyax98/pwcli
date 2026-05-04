import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedConsole } from "#engine/diagnose/core.js";
import { bool, type CliArgs, num, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: { name: "console", description: "Inspect captured console records" },
  args: {
    ...sharedArgs,
    level: { type: "string", description: "Minimum level", default: "info", valueHint: "level" },
    source: { type: "string", description: "Source filter", valueHint: "source" },
    text: { type: "string", description: "Text filter", valueHint: "text" },
    since: { type: "string", description: "Since ISO time", valueHint: "iso" },
    current: { type: "boolean", description: "Current page only" },
    limit: { type: "string", description: "Limit", valueHint: "n" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "console",
        await managedConsole(str(a.level), {
          sessionName: session(a),
          source: str(a.source),
          text: str(a.text),
          since: str(a.since),
          current: bool(a.current),
          limit: num(a.limit),
        }),
        a,
      );
    } catch (e) {
      withCliError("console", a, e);
    }
  },
});

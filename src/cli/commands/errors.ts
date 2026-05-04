import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedErrors } from "#engine/diagnose/core.js";
import {
  bool,
  type CliArgs,
  firstPos,
  num,
  print,
  session,
  str,
  withCliError,
} from "./_helpers.js";

export default defineCommand({
  meta: { name: "errors", description: "Inspect or clear page errors" },
  args: {
    ...sharedArgs,
    action: { type: "enum", options: ["recent", "clear"], description: "Action" },
    text: { type: "string", description: "Text filter", valueHint: "text" },
    since: { type: "string", description: "Since ISO time", valueHint: "iso" },
    current: { type: "boolean", description: "Current page only" },
    limit: { type: "string", description: "Limit", valueHint: "n" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const action = (a.action ?? firstPos(a) ?? "recent") as "recent" | "clear";
      print(
        "errors",
        await managedErrors(action, {
          sessionName: session(a),
          text: str(a.text),
          since: str(a.since),
          current: bool(a.current),
          limit: num(a.limit),
        }),
        a,
      );
    } catch (e) {
      withCliError("errors", a, e);
    }
  },
});

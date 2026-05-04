import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedDrag } from "#engine/act/page.js";
import { type CliArgs, positionals, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: { name: "drag", description: "Drag one element to another" },
  args: {
    ...sharedArgs,
    "from-selector": { type: "string", description: "Source selector", valueHint: "css" },
    "to-selector": { type: "string", description: "Target selector", valueHint: "css" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const parts = positionals(a);
      print(
        "drag",
        await managedDrag({
          sessionName: session(a),
          fromRef: parts[0],
          toRef: parts[1],
          fromSelector: str(a["from-selector"]),
          toSelector: str(a["to-selector"]),
        }),
        a,
      );
    } catch (error) {
      withCliError("drag", a, error, "drag failed");
    }
  },
});

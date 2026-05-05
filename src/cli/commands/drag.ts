import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedDrag } from "#engine/act/page.js";
import { type CliArgs, positionals, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "drag",
    description:
      "Purpose: drag one element to another by refs or selectors.\nExamples:\n  pw drag -s task-a e10 e12\n  pw drag -s task-a --from-selector '.item' --to-selector '.dropzone'\nNotes: verify the resulting page state after the drag, because drag success only proves the gesture ran.",
  },
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

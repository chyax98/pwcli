import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedGetFact } from "#engine/observe.js";
import { type CliArgs, firstPos, print, session, stateTarget, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "get",
    description:
      "Purpose: read a fact from a target element.\nExamples:\n  pw get text -s task-a --selector h1\n  pw get value -s task-a --label Email\nNotes: this is read-only; use it for assertions and state inspection.",
  },
  args: {
    ...actionArgs,
    fact: { type: "enum", options: ["text", "value", "count"], description: "Fact to read" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const fact = (a.fact ?? firstPos(a)) as "text" | "value" | "count";
      print(
        "get",
        await managedGetFact({ sessionName: session(a), target: stateTarget(a), fact }),
        a,
      );
    } catch (error) {
      withCliError("get", a, error);
    }
  },
});

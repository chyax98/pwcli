import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedStateDiff, managedStateLoad, managedStateSave } from "#engine/identity.js";
import {
  bool,
  type CliArgs,
  firstPos,
  print,
  printError,
  session,
  str,
  withCliError,
} from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "state",
    description:
      "Purpose: save, load, or diff browser storage state for a session.\nExamples:\n  pw state save -s task-a ./state.json\n  pw state diff -s task-a --before ./before.json --after ./after.json\nNotes: `load` mutates session state; use it before navigation or verification steps.",
  },
  args: {
    ...sharedArgs,
    action: { type: "enum", options: ["save", "load", "diff"], description: "Action" },
    before: { type: "string", description: "Diff before file", valueHint: "path" },
    after: { type: "string", description: "Diff after file", valueHint: "path" },
    "include-values": { type: "boolean", description: "Include values in diff" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const action = str(a.action) ?? firstPos(a);
      const file = (a._ as string[] | undefined)?.[1];
      if (action === "save")
        print("state save", await managedStateSave(file, { sessionName: session(a) }), a);
      else if (action === "load")
        print("state load", await managedStateLoad(file as string, { sessionName: session(a) }), a);
      else if (action === "diff")
        print(
          "state diff",
          await managedStateDiff({
            sessionName: str(a.session),
            before: str(a.before),
            after: str(a.after),
            includeValues: bool(a["include-values"]),
          }),
          a,
        );
      else
        printError("state", a, {
          code: "STATE_ACTION_REQUIRED",
          message: "state requires action: save, load, or diff",
        });
    } catch (e) {
      withCliError("state", a, e);
    }
  },
});

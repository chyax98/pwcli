import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedUpload } from "#engine/act/page.js";
import { type CliArgs, positionals, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "upload",
    description:
      "Purpose: upload files through a file input.\nExamples:\n  pw upload -s task-a --selector 'input[type=file]' ./avatar.png\n  pw upload -s task-a e12 ./a.txt ./b.txt\nNotes: verify page state after upload; this command only proves files were assigned to the input.",
  },
  args: {
    ...sharedArgs,
    selector: { type: "string", description: "Input selector", valueHint: "css" },
    ref: { type: "string", description: "Snapshot aria ref", valueHint: "ref" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const parts = positionals(a);
      const ref = str(a.ref) ?? (a.selector ? undefined : parts.shift());
      print(
        "upload",
        await managedUpload({
          sessionName: session(a),
          ref,
          selector: str(a.selector),
          files: parts,
        }),
        a,
      );
    } catch (error) {
      withCliError("upload", a, error, "upload failed");
    }
  },
});

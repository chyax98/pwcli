import { defineCommand } from "citty";
import { managedUpload } from "#engine/act/page.js";
import { sharedArgs } from "#cli/args.js";
import { positionals, print, session, str, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "upload", description: "Upload files through an input" },
  args: { ...sharedArgs, selector: { type: "string", description: "Input selector", valueHint: "css" }, ref: { type: "string", description: "Snapshot aria ref", valueHint: "ref" } },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const parts = positionals(a);
      const ref = str(a.ref) ?? (a.selector ? undefined : parts.shift());
      print("upload", await managedUpload({ sessionName: session(a), ref, selector: str(a.selector), files: parts }), a);
    } catch (error) {
      withCliError("upload", a, error, "upload failed");
    }
  },
});

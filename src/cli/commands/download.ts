import { defineCommand } from "citty";
import { managedDownload } from "#engine/act/page.js";
import { sharedArgs } from "#cli/args.js";
import { firstPos, print, session, str, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "download", description: "Click a target and save the download" },
  args: { ...sharedArgs, ref: { type: "string", description: "Snapshot aria ref", valueHint: "ref" }, selector: { type: "string", description: "CSS selector", valueHint: "css" }, path: { type: "string", description: "Output file path", valueHint: "path" }, dir: { type: "string", description: "Output directory", valueHint: "dir" } },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("download", await managedDownload({ sessionName: session(a), ref: str(a.ref) ?? firstPos(a), selector: str(a.selector), path: str(a.path), dir: str(a.dir) }), a);
    } catch (error) {
      withCliError("download", a, error, "download failed");
    }
  },
});

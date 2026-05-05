import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedDownload } from "#engine/act/page.js";
import { type CliArgs, firstPos, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "download",
    description:
      "Purpose: click a target that triggers a download and save the file.\nExamples:\n  pw download -s task-a --selector '#export' --path ./export.csv\n  pw download -s task-a e12 --dir ./downloads\nNotes: use this only for browser download flows; use `network` for inspecting response metadata.",
  },
  args: {
    ...sharedArgs,
    ref: { type: "string", description: "Snapshot aria ref", valueHint: "ref" },
    selector: { type: "string", description: "CSS selector", valueHint: "css" },
    path: { type: "string", description: "Output file path", valueHint: "path" },
    dir: { type: "string", description: "Output directory", valueHint: "dir" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "download",
        await managedDownload({
          sessionName: session(a),
          ref: str(a.ref) ?? firstPos(a),
          selector: str(a.selector),
          path: str(a.path),
          dir: str(a.dir),
        }),
        a,
      );
    } catch (error) {
      withCliError("download", a, error, "download failed");
    }
  },
});

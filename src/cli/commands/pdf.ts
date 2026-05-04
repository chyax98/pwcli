import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedPdf } from "#engine/act/page.js";
import { type CliArgs, firstPos, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: { name: "pdf", description: "Save current page as PDF" },
  args: {
    ...sharedArgs,
    path: { type: "string", description: "Output PDF path", valueHint: "path" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "pdf",
        await managedPdf({
          sessionName: session(a),
          path: str(a.path) ?? firstPos(a) ?? "page.pdf",
        }),
        a,
      );
    } catch (error) {
      withCliError("pdf", a, error, "pdf failed");
    }
  },
});

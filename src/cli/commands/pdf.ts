import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedPdf } from "#engine/act/page.js";
import { type CliArgs, firstPos, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "pdf",
    description:
      "Purpose: save the current page as a PDF artifact.\nExamples:\n  pw pdf -s task-a --path ./page.pdf\n  pw pdf -s task-a ./page.pdf\nNotes: PDF is evidence output; use read-only commands for behavioral assertions.",
  },
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

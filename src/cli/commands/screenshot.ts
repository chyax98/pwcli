import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedScreenshot } from "#engine/act/page.js";
import { managedAnnotatedScreenshot } from "#engine/workspace.js";
import { bool, type CliArgs, firstPos, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: { name: "screenshot", description: "Capture a page or element screenshot" },
  args: {
    ...sharedArgs,
    ref: { type: "string", description: "Snapshot aria ref", valueHint: "ref" },
    selector: { type: "string", description: "CSS selector", valueHint: "css" },
    path: { type: "string", description: "Output file path", valueHint: "path" },
    "full-page": { type: "boolean", description: "Capture full page" },
    annotate: { type: "boolean", description: "Annotate interactive elements" },
    format: { type: "enum", options: ["png", "jpeg"], description: "Image format", default: "png" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const options = {
        sessionName: session(a),
        ref: str(a.ref) ?? firstPos(a),
        selector: str(a.selector),
        path: str(a.path),
        fullPage: bool(a["full-page"]),
      };
      print(
        "screenshot",
        bool(a.annotate)
          ? await managedAnnotatedScreenshot(options)
          : await managedScreenshot(options),
        a,
      );
    } catch (error) {
      withCliError("screenshot", a, error, "screenshot failed");
    }
  },
});

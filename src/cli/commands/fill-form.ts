import { readFile } from "node:fs/promises";
import { defineCommand } from "citty";
import { managedFillForm } from "#engine/forms.js";
import { type CliArgs, firstPos, print, session, str, withCliError } from "./_helpers.js";

async function readValues(args: CliArgs) {
  const file = str(args.file);
  const raw = file ? await readFile(file, "utf8") : firstPos(args);
  if (!raw) throw new Error("fill-form requires JSON values via positional string or --file");
  const parsed = JSON.parse(raw) as Record<string, string | boolean | string[]>;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("fill-form values must be a JSON object");
  }
  return parsed;
}

export default defineCommand({
  meta: {
    name: "fill-form",
    description:
      'Purpose: fill a form by field label, name, placeholder or id using a JSON object.\nOptions: pass values as a positional JSON object or --file; use --selector to scope to a specific form.\nExamples:\n  pw fill-form -s task-a \'{"Email":"user@example.com","Password":"secret"}\'\n  pw fill-form -s task-a --selector \'#login-form\' --file ./values.json\nNotes: current version supports text-like fields, checkbox/radio boolean true, and single-value select.',
  },
  args: {
    session: {
      type: "string",
      alias: "s",
      description: "Target managed session",
      valueHint: "name",
    },
    output: { type: "string", description: "Output format: text|json", default: "text" },
    selector: { type: "string", description: "CSS selector for the form root", valueHint: "css" },
    file: { type: "string", description: "Path to JSON values object", valueHint: "path" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "fill-form",
        await managedFillForm({
          sessionName: session(a),
          selector: str(a.selector),
          values: await readValues(a),
        }),
        a,
      );
    } catch (error) {
      withCliError("fill-form", a, error, "fill-form failed");
    }
  },
});

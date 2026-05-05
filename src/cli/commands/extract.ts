import { readFile } from "node:fs/promises";
import { defineCommand } from "citty";
import { type ExtractFieldSpec, managedExtract } from "#engine/extract.js";
import { type CliArgs, firstPos, print, session, str, withCliError } from "./_helpers.js";

async function readSchema(args: CliArgs) {
  const file = str(args.file);
  const raw = file ? await readFile(file, "utf8") : firstPos(args);
  if (!raw) throw new Error("extract requires schema JSON via positional string or --file");
  const parsed = JSON.parse(raw) as {
    multiple?: boolean;
    fields?: Array<{
      key: string;
      selector: string;
      type?: "text" | "html" | "attr";
      attr?: string;
    }>;
  };
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray(parsed.fields) ||
    parsed.fields.length === 0
  ) {
    throw new Error("extract schema must be an object with non-empty fields[]");
  }
  return parsed as { multiple?: boolean; fields: ExtractFieldSpec[] };
}

export default defineCommand({
  meta: {
    name: "extract",
    description:
      'Purpose: extract structured data from the current page using a minimal selector-based schema.\nOptions: pass schema JSON as a positional argument or --file; use --selector to scope repeated roots.\nExamples:\n  pw extract -s task-a \'{"fields":[{"key":"title","selector":"h1"}]}\'\n  pw extract -s task-a --selector \'.card\' --file ./schema.json\nNotes: current version supports text/html/attr field extraction and optional multiple root mode.',
  },
  args: {
    session: {
      type: "string",
      alias: "s",
      description: "Target managed session",
      valueHint: "name",
    },
    output: { type: "string", description: "Output format: text|json", default: "text" },
    selector: {
      type: "string",
      description: "CSS selector for repeated root items",
      valueHint: "css",
    },
    file: { type: "string", description: "Path to schema JSON", valueHint: "path" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "extract",
        await managedExtract({
          sessionName: session(a),
          selector: str(a.selector),
          schema: await readSchema(a),
        }),
        a,
      );
    } catch (error) {
      withCliError("extract", a, error, "extract failed");
    }
  },
});

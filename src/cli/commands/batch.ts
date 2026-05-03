import { readFile } from "node:fs/promises";
import { defineCommand } from "citty";
import { runBatch } from "#cli/batch/executor.js";
import { sharedArgs } from "#cli/args.js";
import { bool, print, printError, session, str, type CliArgs, withCliError } from "./_helpers.js";

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export default defineCommand({
  meta: { name: "batch", description: "Run a structured serial command batch" },
  args: { ...sharedArgs, "stdin-json": { type: "boolean", description: "Read JSON argv arrays from stdin" }, file: { type: "string", description: "JSON file with argv arrays", valueHint: "path" }, "continue-on-error": { type: "boolean", description: "Continue after failed step" }, "include-results": { type: "boolean", description: "Include full step results" }, "summary-only": { type: "boolean", description: "Omit step results" } },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const raw = str(a.file) ? await readFile(str(a.file) as string, "utf8") : bool(a["stdin-json"]) ? await readStdin() : "";
      if (!raw.trim()) { printError("batch", a, { code: "BATCH_INPUT_REQUIRED", message: "batch requires --stdin-json or --file <path>" }); return; }
      const commands = JSON.parse(raw) as string[][];
      if (!Array.isArray(commands) || !commands.every((step) => Array.isArray(step) && step.every((part) => typeof part === "string"))) {
        printError("batch", a, { code: "BATCH_INPUT_INVALID", message: "batch input must be a JSON array of argv string arrays" });
        return;
      }
      print("batch", { data: await runBatch({ sessionName: session(a), commands, continueOnError: bool(a["continue-on-error"]), includeResults: bool(a["include-results"]), summaryOnly: bool(a["summary-only"]) }) }, a);
    } catch (e) { withCliError("batch", a, e); }
  },
});

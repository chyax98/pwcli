import { readFile } from "node:fs/promises";
import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { runBatch } from "#cli/batch/executor.js";
import { bool, type CliArgs, print, printError, session, str, withCliError } from "./_helpers.js";

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export default defineCommand({
  meta: {
    name: "batch",
    description:
      'Purpose: run a single-session serial batch from JSON string[][].\nOptions: input must come from --stdin-json or --file.\nExamples:\n  printf \'[["read-text","--max-chars","1000"],["verify","text","--text","Done"]]\' | pw batch -s task-a --stdin-json\n  pw batch -s task-a --file ./steps.json --continue-on-error\nNotes: batch supports a stable command subset only; keep lifecycle, auth, diagnostics queries and recovery outside batch.',
  },
  args: {
    ...sharedArgs,
    "stdin-json": { type: "boolean", description: "Read JSON string[][] argv arrays from stdin" },
    file: {
      type: "string",
      description: "JSON file containing string[][] argv arrays",
      valueHint: "path",
    },
    "continue-on-error": { type: "boolean", description: "Continue after failed step" },
    "include-results": { type: "boolean", description: "Include full step results" },
    "summary-only": { type: "boolean", description: "Omit step results" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const raw = str(a.file)
        ? await readFile(str(a.file) as string, "utf8")
        : bool(a["stdin-json"])
          ? await readStdin()
          : "";
      if (!raw.trim()) {
        printError("batch", a, {
          code: "BATCH_INPUT_REQUIRED",
          message: "batch requires --stdin-json or --file <path>",
        });
        return;
      }
      const commands = JSON.parse(raw) as string[][];
      if (
        !Array.isArray(commands) ||
        !commands.every(
          (step) => Array.isArray(step) && step.every((part) => typeof part === "string"),
        )
      ) {
        printError("batch", a, {
          code: "BATCH_INPUT_INVALID",
          message: "batch input must be a JSON array of argv string arrays",
        });
        return;
      }
      const continueOnError = bool(a["continue-on-error"]);
      const result = await runBatch({
        sessionName: session(a),
        commands,
        continueOnError,
        includeResults: bool(a["include-results"]),
        summaryOnly: bool(a["summary-only"]),
      });
      if (result.summary.failedCount > 0 && !continueOnError) {
        printError("batch", a, {
          code: "BATCH_STEP_FAILED",
          message:
            result.summary.firstFailureMessage ??
            `batch step ${result.summary.firstFailedStep} failed`,
          suggestions: result.summary.firstFailureSuggestions ?? [],
          details: { summary: result.summary, results: result.results, analysis: result.analysis },
        });
      } else {
        print("batch", { data: result }, a);
      }
    } catch (e) {
      withCliError("batch", a, e);
    }
  },
});

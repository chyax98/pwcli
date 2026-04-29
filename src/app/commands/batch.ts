import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { runBatch } from "../batch/run-batch.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

function parseBatchCommands(input: string) {
  const parsed = JSON.parse(input) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("batch expects a JSON array of command argv arrays");
  }

  return parsed.map((entry) => {
    if (!Array.isArray(entry) || entry.some((part) => typeof part !== "string")) {
      throw new Error('batch expects items shaped like ["open", "https://example.com"]');
    }
    return entry as string[];
  });
}

export function registerBatchCommand(program: Command): void {
  addSessionOption(
    program
      .command("batch")
      .description("Run multiple structured commands against a named managed session")
      .option("--json", "Read a JSON array of argv arrays from stdin")
      .option("--stdin-json", "Read a JSON array of argv arrays from stdin")
      .option("--file <path>", "Read a JSON array of argv arrays from a file")
      .option("--continue-on-error", "Continue after a failed step")
      .option("--include-results", "Include full step-by-step results in output"),
  ).action(
    async (options: {
      session?: string;
      json?: boolean;
      stdinJson?: boolean;
      file?: string;
      continueOnError?: boolean;
      includeResults?: boolean;
    }) => {
      try {
        const sessionName = requireSessionName(options);
        const readsStdin = Boolean(options.json || options.stdinJson);
        if (readsStdin && options.file) {
          throw new Error("batch accepts either --stdin-json/--json or --file, not both");
        }
        const input = options.file
          ? await readFile(options.file, "utf8")
          : readsStdin
            ? await new Promise<string>((resolve, reject) => {
                let data = "";
                process.stdin.setEncoding("utf8");
                process.stdin.on("data", (chunk) => {
                  data += chunk;
                });
                process.stdin.on("end", () => resolve(data));
                process.stdin.on("error", reject);
              })
            : "";
        if (!input.trim()) {
          throw new Error("batch requires --file <path> or --stdin-json stdin input");
        }
        const commands = parseBatchCommands(input);
        printCommandResult("batch", {
          data: await runBatch({
            sessionName,
            commands,
            continueOnError: options.continueOnError,
            includeResults: options.includeResults,
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "batch failed";
        printSessionAwareCommandError("batch", error, {
          code: "BATCH_FAILED",
          message: "batch failed",
          suggestions: message.includes("session lifecycle")
            ? [
                "Create or attach the session first with `pw session create|attach`",
                "Keep batch for dependent steps inside one existing session only",
              ]
            : message.includes("environment mutation")
              ? [
                  "Run environment commands directly before batch",
                  'Keep batch for stable page/read/action steps such as [["snapshot"],["click","e6"],["wait","network-idle"]]',
                ]
              : [
                  'Pass `--file steps.json` with [["snapshot"],["click","--selector","#fire"]]',
                  "Or pipe the same JSON into `pw batch --session bug-a --stdin-json`",
                ],
        });
        process.exitCode = 1;
      }
    },
  );
}

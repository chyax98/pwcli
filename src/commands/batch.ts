import type { Command } from "commander";
import { runBatch } from "../core/batch.js";
import { printJson } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerBatchCommand(program: Command): void {
  addSessionOption(
    program
      .command("batch <steps...>")
      .description("Run multiple semantic commands against a named managed session")
      .option("--continue-on-error", "Continue after a failed step"),
  ).action(async (steps: string[], options: { session?: string; continueOnError?: boolean }) => {
    try {
      const sessionName = requireSessionName(options);
      printJson({
        ok: true,
        command: "batch",
        data: await runBatch({
          sessionName,
          steps,
          continueOnError: options.continueOnError,
        }),
      });
    } catch (error) {
      printSessionAwareCommandError("batch", error, {
        code: "BATCH_FAILED",
        message: "batch failed",
        suggestions: [
          'Pass quoted steps, for example: pw batch --session bug-a "snapshot" "click e6"',
        ],
      });
      process.exitCode = 1;
    }
  });
}

import type { Command } from "commander";
import { managedSnapshot, managedSnapshotStatus } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerSnapshotCommand(program: Command): void {
  const snapshot = addSessionOption(
    program
      .command("snapshot")
      .description("Capture an AI-friendly page snapshot")
      .option("-i, --interactive", "Return only likely interactive snapshot lines")
      .option("-c, --compact", "Remove low-signal structural lines"),
  ).action(async (options: { session?: string; interactive?: boolean; compact?: boolean }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult(
        "snapshot",
        await managedSnapshot({
          sessionName,
          interactive: options.interactive,
          compact: options.compact,
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("snapshot", error, {
        code: "SNAPSHOT_FAILED",
        message: "snapshot failed",
        suggestions: ["Run `pw session create <name> --open <url>` first"],
      });
      process.exitCode = 1;
    }
  });

  addSessionOption(
    snapshot.command("status").description("Check if the current snapshot is fresh, stale, or missing"),
  ).action(async (options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult("snapshot status", await managedSnapshotStatus({ sessionName }));
    } catch (error) {
      printSessionAwareCommandError("snapshot status", error, {
        code: "SNAPSHOT_STATUS_FAILED",
        message: "snapshot status check failed",
        suggestions: ["Run `pw session create <name> --open <url>` first"],
      });
      process.exitCode = 1;
    }
  });
}

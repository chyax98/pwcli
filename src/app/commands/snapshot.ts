import type { Command } from "commander";
import { managedSnapshot } from "../../domain/interaction/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerSnapshotCommand(program: Command): void {
  addSessionOption(
    program
      .command("snapshot")
      .description("Capture an AI-friendly page snapshot")
      .option("--mode <mode>", "Snapshot mode: ai|default"),
  ).action(async (options: { session?: string; mode?: "ai" | "default" }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult("snapshot", await managedSnapshot({ sessionName }));
    } catch (error) {
      printSessionAwareCommandError("snapshot", error, {
        code: "SNAPSHOT_FAILED",
        message: "snapshot failed",
        suggestions: ["Run `pw session create <name> --open <url>` first"],
      });
      process.exitCode = 1;
    }
  });
}

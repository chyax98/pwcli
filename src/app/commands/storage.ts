import type { Command } from "commander";
import { managedStorageRead } from "../../domain/identity-state/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerStorageCommand(program: Command): void {
  addSessionOption(
    program
      .command("storage <kind>")
      .description("Read current-page localStorage or sessionStorage"),
  ).action(async (kind: string, options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      if (kind !== "local" && kind !== "session") {
        throw new Error("storage requires local or session");
      }
      printCommandResult(
        `storage ${kind}`,
        await managedStorageRead(kind, {
          sessionName,
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("storage", error, {
        code: "STORAGE_FAILED",
        message: "storage failed",
        suggestions: [
          "Use `pw storage local --session <name>` or `pw storage session --session <name>`",
          "Open a page with a stable origin before reading storage",
        ],
      });
      process.exitCode = 1;
    }
  });
}

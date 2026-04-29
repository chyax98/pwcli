import type { Command } from "commander";
import { managedStorageMutation, managedStorageRead } from "../../domain/identity-state/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerStorageCommand(program: Command): void {
  addSessionOption(
    program
      .command("storage <kind> [action] [key] [value]")
      .description("Read or mutate current-page localStorage or sessionStorage"),
  ).action(
    async (
      kind: string,
      action: string | undefined,
      key: string | undefined,
      value: string | undefined,
      options: { session?: string },
      command: Command,
    ) => {
      try {
        const sessionName = requireSessionName(options, command);
        if (kind !== "local" && kind !== "session") {
          throw new Error("storage requires local or session");
        }
        if (!action) {
          printCommandResult(
            `storage ${kind}`,
            await managedStorageRead(kind, {
              sessionName,
            }),
          );
          return;
        }
        if (action !== "get" && action !== "set" && action !== "delete" && action !== "clear") {
          throw new Error("storage action requires get, set, delete, or clear");
        }
        printCommandResult(
          `storage ${kind} ${action}`,
          await managedStorageMutation(kind, action, {
            key,
            sessionName,
            value,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("storage", error, {
          code: "STORAGE_FAILED",
          message: "storage failed",
          suggestions: [
            "Use `pw storage local --session <name>` or `pw storage session --session <name>`",
            "Use `pw storage local set --session <name> <key> <value>` for current-origin mutation",
            "Open a page with a stable origin before reading or mutating storage",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

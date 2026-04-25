import type { Command } from "commander";
import { managedStateLoad, managedStateSave } from "../core/managed.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerStateCommand(program: Command): void {
  addSessionOption(
    program
      .command("state <action> [file]")
      .description("Save or load storage state for a named managed session"),
  ).action(async (action: string, file: string | undefined, options: { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      if (action === "save") {
        printCommandResult("state save", await managedStateSave(file, { sessionName }));
        return;
      }
      if (action === "load" && file) {
        printCommandResult("state load", await managedStateLoad(file, { sessionName }));
        return;
      }
      throw new Error("state requires `save [file]` or `load <file>`");
    } catch (error) {
      printSessionAwareCommandError("state", error, {
        code: "STATE_FAILED",
        message: "state failed",
        suggestions: [
          "Use `pw state --session bug-a save auth.json` or `pw state --session bug-a load auth.json`",
        ],
      });
      process.exitCode = 1;
    }
  });
}

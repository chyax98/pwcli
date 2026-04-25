import type { Command } from "commander";
import { managedObserveStatus } from "../core/managed.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerObserveCommand(program: Command): void {
  addSessionOption(
    program
      .command("observe <action>")
      .description("Inspect lightweight observe status for a named managed session"),
  ).action(async (action: string, options: { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      if (action !== "status") {
        throw new Error("observe currently supports status only");
      }
      printCommandResult("observe", await managedObserveStatus({ sessionName }));
    } catch (error) {
      printSessionAwareCommandError("observe", error, {
        code: "OBSERVE_FAILED",
        message: "observe failed",
        suggestions: [
          "Use `pw observe --session bug-a status` to inspect current diagnostics state",
        ],
      });
      process.exitCode = 1;
    }
  });
}

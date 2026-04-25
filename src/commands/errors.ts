import type { Command } from "commander";
import { managedErrors } from "../core/managed.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerErrorsCommand(program: Command): void {
  addSessionOption(
    program
      .command("errors <action>")
      .description("Inspect recent page errors from a named managed session"),
  ).action(async (action: string, options: { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      if (action !== "recent" && action !== "clear") {
        throw new Error("errors requires recent or clear");
      }
      printCommandResult("errors", await managedErrors(action, { sessionName }));
    } catch (error) {
      printSessionAwareCommandError("errors", error, {
        code: "ERRORS_FAILED",
        message: "errors failed",
        suggestions: [
          "Use `pw errors --session bug-a recent` to inspect current page errors",
          "Use `pw errors --session bug-a clear` to move the current baseline",
        ],
      });
      process.exitCode = 1;
    }
  });
}

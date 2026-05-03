import type { Command } from "commander";
import { managedErrors } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerErrorsCommand(program: Command): void {
  addSessionOption(
    program
      .command("errors <action>")
      .description("Inspect recent page errors from a named managed session")
      .option("--text <substring>", "Filter page errors by substring")
      .option("--since <iso>", "Keep only records at or after the given ISO timestamp")
      .option("--current", "Only show errors from the current page navigation")
      .option("--limit <n>", "Limit returned error rows"),
  ).action(
    async (
      action: string,
      options: {
        session?: string;
        text?: string;
        since?: string;
        current?: boolean;
        limit?: string;
      },
    ) => {
      try {
        const sessionName = requireSessionName(options);
        if (action !== "recent" && action !== "clear") {
          throw new Error("errors requires recent or clear");
        }
        printCommandResult(
          "errors",
          await managedErrors(action, {
            sessionName,
            text: options.text,
            since: options.since,
            current: options.current,
            limit: options.limit ? Number(options.limit) : undefined,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("errors", error, {
          code: "ERRORS_FAILED",
          message: "errors failed",
          suggestions: [
            "Use `pw errors --session bug-a recent --text failed` to inspect filtered page errors",
            "Use `pw errors --session bug-a clear` to move the current baseline",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

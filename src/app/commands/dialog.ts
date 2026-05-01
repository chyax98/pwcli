import type { Command } from "commander";
import { managedDialog } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
  withActionFailureScreenshot,
} from "./session-options.js";

export function registerDialogCommand(program: Command): void {
  const dialog = addSessionOption(
    program.command("dialog").description("Handle a browser dialog on the current managed session"),
  );

  addSessionOption(
    dialog.command("accept [prompt]").description("Accept the current dialog"),
  ).action(async (prompt: string | undefined, options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult("dialog accept", await withActionFailureScreenshot(sessionName, () => managedDialog("accept", { prompt, sessionName })));
    } catch (error) {
      printSessionAwareCommandError("dialog accept", error, {
        code: "DIALOG_ACCEPT_FAILED",
        message: "dialog accept failed",
        suggestions: [
          "Use `pw dialog accept --session <name>` when a modal dialog is blocking the session",
          "Run `pw doctor --session <name>` if you are unsure whether the session is blocked",
        ],
      });
      process.exitCode = 1;
    }
  });

  addSessionOption(dialog.command("dismiss").description("Dismiss the current dialog")).action(
    async (options: { session?: string }, command: Command) => {
      try {
        const sessionName = requireSessionName(options, command);
        printCommandResult("dialog dismiss", await withActionFailureScreenshot(sessionName, () => managedDialog("dismiss", { sessionName })));
      } catch (error) {
        printSessionAwareCommandError("dialog dismiss", error, {
          code: "DIALOG_DISMISS_FAILED",
          message: "dialog dismiss failed",
          suggestions: [
            "Use `pw dialog dismiss --session <name>` when a modal dialog is blocking the session",
            "Run `pw doctor --session <name>` if you are unsure whether the session is blocked",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

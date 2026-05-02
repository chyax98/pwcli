import type { Command } from "commander";
import {
  isModalStateBlockedMessage,
  managedPageAssess,
  managedPageCurrent,
  managedPageDialogs,
  managedPageFrames,
  managedPageList,
} from "../../infra/playwright/runtime.js";
import { printCommandError, printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerPageCommand(program: Command): void {
  const page = addSessionOption(
    program.command("page").description("Inspect current page, tabs, and frames"),
  );

  addSessionOption(page.command("current").description("Show current page truth")).action(
    async (options: { session?: string }, command: Command) => {
      try {
        const sessionName = requireSessionName(options, command);
        printCommandResult("page current", await managedPageCurrent({ sessionName }));
      } catch (error) {
        printSessionAwareCommandError("page current", error, {
          code: "PAGE_CURRENT_FAILED",
          message: "page current failed",
          suggestions: ["Run `pw session create <name> --open <url>` first"],
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(
    page.command("list").description("List pages in the current runtime session"),
  ).action(async (options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult("page list", await managedPageList({ sessionName }));
    } catch (error) {
      printSessionAwareCommandError("page list", error, {
        code: "PAGE_LIST_FAILED",
        message: "page list failed",
        suggestions: ["Run `pw session create <name> --open <url>` first"],
      });
      process.exitCode = 1;
    }
  });

  addSessionOption(page.command("frames").description("List frames of the current page")).action(
    async (options: { session?: string }, command: Command) => {
      try {
        const sessionName = requireSessionName(options, command);
        printCommandResult("page frames", await managedPageFrames({ sessionName }));
      } catch (error) {
        printSessionAwareCommandError("page frames", error, {
          code: "PAGE_FRAMES_FAILED",
          message: "page frames failed",
          suggestions: ["Run `pw session create <name> --open <url>` first"],
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(
    page.command("dialogs").description("List observed dialogs for the current page workspace"),
  ).action(async (options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult("page dialogs", await managedPageDialogs({ sessionName }));
    } catch (error) {
      printSessionAwareCommandError("page dialogs", error, {
        code: "PAGE_DIALOGS_FAILED",
        message: "page dialogs failed",
        suggestions: ["Run `pw session create <name> --open <url>` first"],
      });
      process.exitCode = 1;
    }
  });

  addSessionOption(
    page
      .command("assess")
      .description("Assess the active page and suggest the next read-only observation lane"),
  ).action(async (options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult("page assess", await managedPageAssess({ sessionName }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isModalStateBlockedMessage(message)) {
        printCommandError("page assess", {
          code: "MODAL_STATE_BLOCKED",
          message: "page assess is blocked by a modal dialog",
          suggestions: [
            "Run `pw dialog accept --session <name>` or `pw dialog dismiss --session <name>` first",
          ],
        });
        process.exitCode = 1;
        return;
      }
      printSessionAwareCommandError("page assess", error, {
        code: "PAGE_ASSESS_FAILED",
        message: "page assess failed",
        suggestions: [
          "Run `pw page current --session <name>` to confirm the active page",
          "Retry with `pw read-text --session <name>` and `pw snapshot -i --session <name>` if the page is still readable",
        ],
      });
      process.exitCode = 1;
    }
  });
}

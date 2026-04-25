import type { Command } from "commander";
import { managedPageCurrent, managedPageFrames, managedPageList } from "../core/managed.js";
import { printCommandResult } from "../utils/output.js";
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
}

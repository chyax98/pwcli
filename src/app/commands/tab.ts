import type { Command } from "commander";
import { managedTabClose, managedTabSelect } from "../../domain/workspace/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerTabCommand(program: Command): void {
  const tab = addSessionOption(
    program.command("tab").description("Select or close managed browser tabs by stable pageId"),
  );

  addSessionOption(tab.command("select <pageId>").description("Select a tab by pageId")).action(
    async (pageId: string, options: { session?: string }, command: Command) => {
      try {
        const sessionName = requireSessionName(options, command);
        printCommandResult(
          "tab select",
          await managedTabSelect({ sessionName, pageId: pageId.trim() }),
        );
      } catch (error) {
        printSessionAwareCommandError("tab select", error, {
          code: "TAB_SELECT_FAILED",
          message: "tab select failed",
          suggestions: ["Run `pw page list --session <name>` and pass a listed pageId"],
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(tab.command("close <pageId>").description("Close a tab by pageId")).action(
    async (pageId: string, options: { session?: string }, command: Command) => {
      try {
        const sessionName = requireSessionName(options, command);
        printCommandResult(
          "tab close",
          await managedTabClose({ sessionName, pageId: pageId.trim() }),
        );
      } catch (error) {
        printSessionAwareCommandError("tab close", error, {
          code: "TAB_CLOSE_FAILED",
          message: "tab close failed",
          suggestions: ["Run `pw page list --session <name>` and pass a listed pageId"],
        });
        process.exitCode = 1;
      }
    },
  );
}

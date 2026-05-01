import type { Command } from "commander";
import { managedOpen } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerOpenCommand(program: Command): void {
  addSessionOption(
    program
      .command("open <url>")
      .description("Open a URL in an existing named managed browser session"),
  ).action(async (url: string, options: { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      const result = await managedOpen(url, {
        sessionName,
        reset: false,
      });

      printCommandResult("open", {
        session: result.session,
        page: result.page,
        data: result.data,
      });
    } catch (error) {
      printSessionAwareCommandError("open", error, {
        code: "OPEN_FAILED",
        message: "open failed",
        suggestions: [
          "Verify the URL is reachable",
          "Create or recreate the session first if you need a different browser shape",
          "Load storage state with `pw state load <file> --session <name>` before navigating",
        ],
      });
      process.exitCode = 1;
    }
  });
}

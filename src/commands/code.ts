import type { Command } from "commander";
import { managedRunCode } from "../core/managed.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerCodeCommand(program: Command): void {
  addSessionOption(
    program
      .command("code [source]")
      .description("Run Playwright code in a named managed browser session")
      .option("--file <path>", "Run code from a local file"),
  ).action(async (source: string | undefined, options: { session?: string; file?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult(
        "code",
        await managedRunCode({
          sessionName,
          source,
          file: options.file,
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("code", error, {
        code: "CODE_EXECUTION_FAILED",
        message: "code execution failed",
        suggestions: [
          "Pass inline code like: pw code --session bug-a \"async page => { await page.goto('https://example.com'); return await page.title(); }\"",
          "Or pass --file <path> with code that evaluates to a function taking page",
        ],
      });
      process.exitCode = 1;
    }
  });
}

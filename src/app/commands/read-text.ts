import type { Command } from "commander";
import { managedReadText } from "../../domain/interaction/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerReadTextCommand(program: Command): void {
  addSessionOption(
    program
      .command("read-text")
      .description("Read visible text from the current page or a selector")
      .option("--selector <selector>", "Read text from a specific selector")
      .option("--max-chars <count>", "Limit output length"),
  ).action(async (options: { session?: string; selector?: string; maxChars?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult(
        "read-text",
        await managedReadText({
          sessionName,
          selector: options.selector,
          maxChars: options.maxChars ? Number(options.maxChars) : undefined,
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("read-text", error, {
        code: "READ_TEXT_FAILED",
        message: "read-text failed",
        suggestions: ["Run `pw session create <name> --open <url>` first"],
      });
      process.exitCode = 1;
    }
  });
}

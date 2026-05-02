import type { Command } from "commander";
import { managedReadText } from "../../infra/playwright/runtime.js";
import { printCommandError, printCommandResult } from "../output.js";
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
      .option("--no-include-overlay", "Skip modal/dropdown/popover overlay text (included by default)")
      .option("--max-chars <count>", "Limit output length (default: 15000)"),
  ).action(
    async (options: {
      session?: string;
      selector?: string;
      includeOverlay?: boolean;
      maxChars?: string;
    }) => {
      try {
        const sessionName = requireSessionName(options);
        const maxChars = options.maxChars ? Number(options.maxChars) : 15000;
        if (options.maxChars && !Number.isFinite(maxChars)) {
          throw new Error("--max-chars requires a finite number");
        }
        printCommandResult(
          "read-text",
          await managedReadText({
            sessionName,
            selector: options.selector,
            includeOverlay: options.includeOverlay !== false,
            maxChars,
          }),
        );
      } catch (error) {
        const selectorNotFound = readTextSelectorNotFound(error);
        if (selectorNotFound) {
          printCommandError("read-text", {
            code: "READ_TEXT_SELECTOR_NOT_FOUND",
            message: `selector did not match any elements: ${selectorNotFound.selector ?? ""}`,
            retryable: true,
            suggestions: [
              "Run `pw locate --session <name> --selector '<selector>'` to inspect candidates",
              "Run `pw snapshot -i --session <name>` to see available elements",
              "Use a broader selector or `pw read-text --session <name>` to read the full page",
            ],
            details: selectorNotFound,
          });
          process.exitCode = 1;
          return;
        }
        printSessionAwareCommandError("read-text", error, {
          code: "READ_TEXT_FAILED",
          message: "read-text failed",
          suggestions: [
            "Run `pw read-text --session <name>` to read the full page",
            "Use `pw read-text --session <name> --selector '<selector>'` for a specific region",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

function readTextSelectorNotFound(error: unknown): Record<string, unknown> | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/READ_TEXT_SELECTOR_NOT_FOUND:(\{.*\})/s);
  if (!match) {
    return null;
  }
  try {
    const parsed = JSON.parse(match[1]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

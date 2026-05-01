import type { Command } from "commander";
import { managedHover } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

function parseNth(value?: string) {
  const nth = Number(value ?? "1");
  if (!Number.isInteger(nth) || nth < 1) {
    throw new Error("--nth requires a positive integer");
  }
  return nth;
}

export function registerHoverCommand(program: Command): void {
  addSessionOption(
    program
      .command("hover [ref]")
      .description("Hover an element by aria ref or selector")
      .option("--selector <selector>", "Selector target")
      .option("--nth <number>", "1-based match index", "1"),
  ).action(
    async (
      ref: string | undefined,
      options: { selector?: string; nth?: string; session?: string },
    ) => {
      try {
        const sessionName = requireSessionName(options);
        const nth = parseNth(options.nth);
        printCommandResult(
          "hover",
          await managedHover({
            ref,
            selector: options.selector,
            nth: options.selector ? nth : undefined,
            sessionName,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("hover", error, {
          code: "HOVER_FAILED",
          message: "hover failed",
          suggestions: [
            "Use `pw hover --session bug-a e6` or `pw hover --session bug-a --selector '.menu-trigger'`",
            "If the page changed, refresh refs with `pw snapshot -i --session <name>`",
            "After hovering, inspect revealed menus with `pw read-text --session <name>`",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

import type { Command } from "commander";
import { managedHover } from "../../domain/interaction/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerHoverCommand(program: Command): void {
  addSessionOption(
    program
      .command("hover [ref]")
      .description("Hover an element by aria ref or selector")
      .option("--selector <selector>", "Selector target"),
  ).action(async (ref: string | undefined, options: { selector?: string; session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult(
        "hover",
        await managedHover({
          ref,
          selector: options.selector,
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
          "After hovering, inspect revealed menus with `pw read-text --session <name> --include-overlay`",
        ],
      });
      process.exitCode = 1;
    }
  });
}

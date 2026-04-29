import type { Command } from "commander";
import { managedCheck } from "../../domain/interaction/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerCheckCommand(program: Command): void {
  addSessionOption(
    program
      .command("check [ref]")
      .description("Check a checkbox or radio target by ref or selector")
      .option("--selector <selector>", "Selector target"),
  ).action(async (ref: string | undefined, options: { selector?: string; session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult(
        "check",
        await managedCheck({
          ref,
          selector: options.selector,
          sessionName,
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("check", error, {
        code: "CHECK_FAILED",
        message: "check failed",
        suggestions: [
          "Use `pw check --session bug-a e6` or `pw check --session bug-a --selector '#agree'`",
          "Run `pw snapshot -i --session bug-a` to refresh refs",
        ],
      });
      process.exitCode = 1;
    }
  });
}

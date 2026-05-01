import type { Command } from "commander";
import { managedCheck } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
  withActionFailureScreenshot,
} from "./session-options.js";

function parseNth(value?: string) {
  const nth = Number(value ?? "1");
  if (!Number.isInteger(nth) || nth < 1) {
    throw new Error("--nth requires a positive integer");
  }
  return nth;
}

export function registerCheckCommand(program: Command): void {
  addSessionOption(
    program
      .command("check [ref]")
      .description("Check a checkbox or radio target by ref or selector")
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
          "check",
          await withActionFailureScreenshot(sessionName, () => managedCheck({
            ref,
            selector: options.selector,
            nth: options.selector ? nth : undefined,
            sessionName,
          })),
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
    },
  );
}

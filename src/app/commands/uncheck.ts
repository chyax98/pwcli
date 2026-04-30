import type { Command } from "commander";
import { managedUncheck } from "../../domain/interaction/service.js";
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

export function registerUncheckCommand(program: Command): void {
  addSessionOption(
    program
      .command("uncheck [ref]")
      .description("Uncheck a checkbox target by ref or selector")
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
          "uncheck",
          await managedUncheck({
            ref,
            selector: options.selector,
            nth: options.selector ? nth : undefined,
            sessionName,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("uncheck", error, {
          code: "UNCHECK_FAILED",
          message: "uncheck failed",
          suggestions: [
            "Use `pw uncheck --session bug-a e6` or `pw uncheck --session bug-a --selector '#agree'`",
            "Run `pw snapshot -i --session bug-a` to refresh refs",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

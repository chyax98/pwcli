import type { Command } from "commander";
import { managedSelect } from "../../domain/interaction/service.js";
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

export function registerSelectCommand(program: Command): void {
  addSessionOption(
    program
      .command("select <targetOrValue> [value]")
      .description("Select an option value by ref or selector")
      .option("--selector <selector>", "Selector target")
      .option("--nth <number>", "1-based match index", "1"),
  ).action(
    async (
      targetOrValue: string,
      value: string | undefined,
      options: { selector?: string; nth?: string; session?: string },
    ) => {
      try {
        const sessionName = requireSessionName(options);
        const nth = parseNth(options.nth);
        const ref = options.selector ? undefined : targetOrValue;
        const selectedValue = options.selector ? targetOrValue : value;
        if (!selectedValue) {
          throw new Error("select requires an option value");
        }
        printCommandResult(
          "select",
          await managedSelect({
            ref,
            selector: options.selector,
            sessionName,
            nth: options.selector ? nth : undefined,
            value: selectedValue,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("select", error, {
          code: "SELECT_FAILED",
          message: "select failed",
          suggestions: [
            "Use `pw select --session bug-a e6 value` or `pw select --session bug-a --selector '#country' value`",
            "Run `pw snapshot -i --session bug-a` to refresh refs",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

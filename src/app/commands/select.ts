import type { Command } from "commander";
import { managedSelect } from "../../domain/interaction/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerSelectCommand(program: Command): void {
  addSessionOption(
    program
      .command("select <targetOrValue> [value]")
      .description("Select an option value by ref or selector")
      .option("--selector <selector>", "Selector target"),
  ).action(
    async (
      targetOrValue: string,
      value: string | undefined,
      options: { selector?: string; session?: string },
    ) => {
      try {
        const sessionName = requireSessionName(options);
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

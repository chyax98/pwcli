import type { Command } from "commander";
import { managedType } from "../core/managed.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerTypeCommand(program: Command): void {
  addSessionOption(
    program
      .command("type [parts...]")
      .description("Type text into the focused element, aria ref, or selector")
      .option("--selector <selector>", "Selector target when no ref is provided"),
  ).action(async (parts: string[], options: { session?: string; selector?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      const values = Array.isArray(parts) ? parts : [];
      const ref = options.selector ? undefined : values.length > 1 ? values[0] : undefined;
      const value = options.selector
        ? values.join(" ")
        : values.length > 1
          ? values.slice(1).join(" ")
          : values[0];
      if (!value) {
        throw new Error("type requires a value");
      }
      printCommandResult(
        "type",
        await managedType({
          ref,
          selector: options.selector,
          value,
          sessionName,
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("type", error, {
        code: "TYPE_FAILED",
        message: "type failed",
        suggestions: ["Use `pw type --session bug-a value` or `pw type --session bug-a e3 value`"],
      });
      process.exitCode = 1;
    }
  });
}

import type { Command } from "commander";
import { managedFill } from "../core/managed.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerFillCommand(program: Command): void {
  addSessionOption(
    program
      .command("fill [parts...]")
      .description("Fill an input by aria ref or selector")
      .option("--selector <selector>", "Selector target when no ref is provided"),
  ).action(async (parts: string[], options: { session?: string; selector?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      const values = Array.isArray(parts) ? parts : [];
      const ref = options.selector ? undefined : values[0];
      const value = options.selector ? values.join(" ") : values.slice(1).join(" ");
      if (!value) {
        throw new Error("fill requires a value");
      }
      printCommandResult(
        "fill",
        await managedFill({
          ref,
          selector: options.selector,
          value,
          sessionName,
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("fill", error, {
        code: "FILL_FAILED",
        message: "fill failed",
        suggestions: ["Use `pw fill --session bug-a e3 value` or selector mode"],
      });
      process.exitCode = 1;
    }
  });
}

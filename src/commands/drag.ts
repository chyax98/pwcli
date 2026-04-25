import type { Command } from "commander";
import { managedDrag } from "../core/managed.js";
import { printCommandError, printCommandResult } from "../utils/output.js";

export function registerDragCommand(program: Command): void {
  program
    .command("drag [parts...]")
    .description("Drag from one aria ref/selector to another")
    .option("--from-selector <selector>", "Source selector")
    .option("--to-selector <selector>", "Target selector")
    .action(async (parts: string[], options: { fromSelector?: string; toSelector?: string }) => {
      try {
        const values = Array.isArray(parts) ? parts : [];
        let index = 0;
        const from = options.fromSelector ? undefined : values[index++];
        const to = options.toSelector ? undefined : values[index++];
        printCommandResult(
          "drag",
          await managedDrag({
            fromRef: from,
            toRef: to,
            fromSelector: options.fromSelector,
            toSelector: options.toSelector,
          }),
        );
      } catch (error) {
        printCommandError("drag", {
          code: "DRAG_FAILED",
          message: error instanceof Error ? error.message : "drag failed",
          suggestions: ["Use `pw drag e3 e8` or explicit selector flags"],
        });
        process.exitCode = 1;
      }
    });
}

import type { Command } from "commander";
import { managedDrag } from "../core/managed.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerDragCommand(program: Command): void {
  addSessionOption(
    program
      .command("drag [parts...]")
      .description("Drag from one aria ref/selector to another")
      .option("--from-selector <selector>", "Source selector")
      .option("--to-selector <selector>", "Target selector"),
  ).action(
    async (
      parts: string[],
      options: { session?: string; fromSelector?: string; toSelector?: string },
    ) => {
      try {
        const sessionName = requireSessionName(options);
        const values = Array.isArray(parts) ? parts : [];
        let index = 0;
        const from = options.fromSelector ? undefined : values[index++];
        const to = options.toSelector ? undefined : values[index++];
        printCommandResult(
          "drag",
          await managedDrag({
            fromRef: from,
            toRef: to,
            sessionName,
            fromSelector: options.fromSelector,
            toSelector: options.toSelector,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("drag", error, {
          code: "DRAG_FAILED",
          message: "drag failed",
          suggestions: ["Use `pw drag --session bug-a e3 e8` or explicit selector flags"],
        });
        process.exitCode = 1;
      }
    },
  );
}

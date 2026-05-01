import type { Command } from "commander";
import { managedScroll } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerScrollCommand(program: Command): void {
  addSessionOption(
    program
      .command("scroll <direction> [distance]")
      .description("Scroll the current page by direction"),
  ).action(
    async (
      direction: "up" | "down" | "left" | "right",
      distance: string | undefined,
      options: { session?: string },
    ) => {
      try {
        const sessionName = requireSessionName(options);
        printCommandResult(
          "scroll",
          await managedScroll({
            direction,
            distance: distance ? Number(distance) : undefined,
            sessionName,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("scroll", error, {
          code: "SCROLL_FAILED",
          message: "scroll failed",
          suggestions: [
            "Use `pw scroll --session bug-a down` or `pw scroll --session bug-a right 240`",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

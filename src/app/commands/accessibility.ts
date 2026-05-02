import type { Command } from "commander";
import { managedAccessibilitySnapshot } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerAccessibilityCommand(program: Command): void {
  addSessionOption(
    program
      .command("accessibility")
      .description("Capture the accessibility tree for a named managed session")
      .option("-i, --interactive-only", "Return only interactive accessibility nodes")
      .option("-r, --root <selector>", "Start from a specific selector"),
  ).action(
    async (options: {
      session?: string;
      interactiveOnly?: boolean;
      root?: string;
    }) => {
      try {
        const sessionName = requireSessionName(options);
        printCommandResult(
          "accessibility",
          await managedAccessibilitySnapshot({
            sessionName,
            interactiveOnly: options.interactiveOnly,
            root: options.root,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("accessibility", error, {
          code: "ACCESSIBILITY_FAILED",
          message: "accessibility snapshot failed",
          suggestions: ["Run `pw session create <name> --open <url>` first"],
        });
        process.exitCode = 1;
      }
    },
  );
}

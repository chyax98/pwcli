import type { Command } from "commander";
import { managedPress } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
  withActionFailureScreenshot,
} from "./session-options.js";

export function registerPressCommand(program: Command): void {
  addSessionOption(
    program.command("press <key>").description("Press a keyboard key in a named managed session"),
  ).action(async (key: string, options: { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult("press", await withActionFailureScreenshot(sessionName, () => managedPress(key, { sessionName }), "press"));
    } catch (error) {
      printSessionAwareCommandError("press", error, {
        code: "PRESS_FAILED",
        message: "press failed",
        suggestions: ["Use keys like Enter, Tab, ArrowDown, Escape"],
      });
      process.exitCode = 1;
    }
  });
}

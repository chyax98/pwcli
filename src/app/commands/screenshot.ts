import type { Command } from "commander";
import { managedScreenshot } from "../../domain/interaction/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerScreenshotCommand(program: Command): void {
  addSessionOption(
    program
      .command("screenshot [ref]")
      .description("Capture a screenshot of the page or an aria-ref target")
      .option("--selector <selector>", "Selector target")
      .option("--path <path>", "Output file path")
      .option("--full-page", "Capture the full page"),
  ).action(
    async (
      ref: string | undefined,
      options: { session?: string; selector?: string; path?: string; fullPage?: boolean },
    ) => {
      try {
        const sessionName = requireSessionName(options);
        printCommandResult(
          "screenshot",
          await managedScreenshot({
            sessionName,
            ref,
            selector: options.selector,
            path: options.path,
            fullPage: options.fullPage,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("screenshot", error, {
          code: "SCREENSHOT_FAILED",
          message: "screenshot failed",
          suggestions: [
            "Use `pw screenshot --session bug-a` or `pw screenshot --session bug-a e6 --path out.png`",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

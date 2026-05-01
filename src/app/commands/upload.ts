import type { Command } from "commander";
import { managedUpload } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
  withActionFailureScreenshot,
} from "./session-options.js";

export function registerUploadCommand(program: Command): void {
  addSessionOption(
    program
      .command("upload [parts...]")
      .description("Upload files by aria ref or selector")
      .option("--selector <selector>", "Selector target"),
  ).action(async (parts: string[], options: { session?: string; selector?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      const values = Array.isArray(parts) ? parts : [];
      const ref = options.selector ? undefined : values[0];
      const files = options.selector ? values : values.slice(1);
      if (!files.length) {
        throw new Error("upload requires at least one file");
      }
      printCommandResult(
        "upload",
        await withActionFailureScreenshot(sessionName, () => managedUpload({
          ref,
          selector: options.selector,
          files,
          sessionName,
        }), "upload"),
      );
    } catch (error) {
      printSessionAwareCommandError("upload", error, {
        code: "UPLOAD_FAILED",
        message: "upload failed",
        suggestions: ["Use `pw upload --session bug-a e7 ./file.png` or selector mode"],
      });
      process.exitCode = 1;
    }
  });
}

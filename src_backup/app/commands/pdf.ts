import type { Command } from "commander";
import { managedPdf } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerPdfCommand(program: Command): void {
  addSessionOption(
    program
      .command("pdf")
      .description("Export the active page as PDF evidence")
      .requiredOption("--path <path>", "Output PDF path"),
  ).action(async (options: { path: string; session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult(
        "pdf",
        await managedPdf({
          path: options.path,
          sessionName,
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("pdf", error, {
        code: "PDF_FAILED",
        message: "pdf export failed",
        suggestions: [
          "Use `pw pdf --session bug-a --path ./evidence/page.pdf`",
          "PDF export depends on Chromium support in the active Playwright substrate",
        ],
      });
      process.exitCode = 1;
    }
  });
}

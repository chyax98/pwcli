import type { Command } from "commander";
import { managedDownload } from "../core/managed.js";
import { printCommandError, printCommandResult } from "../utils/output.js";

export function registerDownloadCommand(program: Command): void {
  program
    .command("download [ref]")
    .description("Trigger a download from an aria ref or selector")
    .option("--selector <selector>", "Selector target")
    .option("--path <path>", "Output file path")
    .option("--dir <dir>", "Output directory; saved filename uses the browser suggested name")
    .action(
      async (
        ref: string | undefined,
        options: { selector?: string; path?: string; dir?: string },
      ) => {
        try {
          if (options.path && options.dir) {
            throw new Error("download accepts either --path or --dir, not both");
          }
          printCommandResult(
            "download",
            await managedDownload({
              ref,
              selector: options.selector,
              path: options.path,
              dir: options.dir,
            }),
          );
        } catch (error) {
          printCommandError("download", {
            code: "DOWNLOAD_FAILED",
            message: error instanceof Error ? error.message : "download failed",
            suggestions: [
              "Use `pw download e6 --path ./.tmp-downloads/file.bin` for an exact file path",
              "Use `pw download e6 --dir ./.tmp-downloads` to keep the suggested filename",
            ],
          });
          process.exitCode = 1;
        }
      },
    );
}

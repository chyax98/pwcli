import type { Command } from "commander";
import { managedDownload } from "../../domain/interaction/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerDownloadCommand(program: Command): void {
  addSessionOption(
    program
      .command("download [ref]")
      .description("Trigger a download from an aria ref or selector")
      .option("--selector <selector>", "Selector target")
      .option("--path <path>", "Output file path")
      .option("--dir <dir>", "Output directory; saved filename uses the browser suggested name")
      .option(
        "--download-dir <dir>",
        "Alias for --dir; saved filename uses the browser suggested name",
      ),
  ).action(
    async (
      ref: string | undefined,
      options: {
        session?: string;
        selector?: string;
        path?: string;
        dir?: string;
        downloadDir?: string;
      },
    ) => {
      try {
        const sessionName = requireSessionName(options);
        if (options.dir && options.downloadDir) {
          throw new Error("download accepts either --dir or --download-dir, not both");
        }
        const dir = options.dir ?? options.downloadDir;
        if (options.path && dir) {
          throw new Error("download accepts either --path or --dir/--download-dir, not both");
        }
        printCommandResult(
          "download",
          await managedDownload({
            ref,
            selector: options.selector,
            path: options.path,
            dir,
            sessionName,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("download", error, {
          code: "DOWNLOAD_FAILED",
          message: "download failed",
          suggestions: [
            "Use `pw download --session bug-a e6 --path ./.tmp-downloads/file.bin` for an exact file path",
            "Use `pw download --session bug-a e6 --dir ./.tmp-downloads` to keep the suggested filename",
            "Use `pw download --session bug-a e6 --download-dir ./.tmp-downloads` as an alias for --dir",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

import type { Command } from "commander";
import { managedOpen, managedStateLoad } from "../core/managed.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerOpenCommand(program: Command): void {
  addSessionOption(
    program
      .command("open <url>")
      .description("Open a URL in a named managed browser session")
      .option("--headed", "Launch a visible browser window")
      .option("--profile <path>", "Use a persistent browser profile")
      .option("--persistent", "Use a persistent browser profile")
      .option("--state <file>", "Load storage state before navigating"),
  ).action(
    async (
      url: string,
      options: {
        session?: string;
        headed?: boolean;
        profile?: string;
        persistent?: boolean;
        state?: string;
      },
    ) => {
      try {
        const sessionName = requireSessionName(options);
        const persistent = options.persistent || Boolean(options.profile);
        let stateLoaded: string | undefined;

        const result = options.state
          ? await (async () => {
              await managedOpen("about:blank", {
                sessionName,
                headed: options.headed,
                profile: options.profile,
                persistent,
                reset: true,
              });
              await managedStateLoad(options.state, { sessionName });
              stateLoaded = options.state;
              return await managedOpen(url, {
                sessionName,
                reset: false,
              });
            })()
          : await managedOpen(url, {
              sessionName,
              headed: options.headed,
              profile: options.profile,
              persistent,
              reset: Boolean(options.headed || options.profile || persistent),
            });

        printCommandResult("open", {
          session: result.session,
          page: result.page,
          data: {
            ...result.data,
            ...(stateLoaded ? { stateLoaded } : {}),
          },
        });
      } catch (error) {
        printSessionAwareCommandError("open", error, {
          code: "OPEN_FAILED",
          message: "open failed",
          suggestions: [
            "Verify the URL is reachable",
            "Verify the local Playwright browser can launch normally",
            "Use `pw session create <name> --open <url>` as the recommended main path",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

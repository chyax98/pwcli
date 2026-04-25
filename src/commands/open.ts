import type { Command } from "commander";
import { managedOpen, managedStateLoad } from "../core/managed.js";
import { printCommandError, printCommandResult } from "../utils/output.js";

export function registerOpenCommand(program: Command): void {
  program
    .command("open <url>")
    .description("Open a URL in the default managed browser session")
    .option("--headed", "Launch a visible browser window")
    .option("--profile <path>", "Use a persistent browser profile")
    .option("--persistent", "Use a persistent browser profile")
    .option("--state <file>", "Load storage state before navigating")
    .action(
      async (
        url: string,
        options: { headed?: boolean; profile?: string; persistent?: boolean; state?: string },
      ) => {
        try {
          const persistent = options.persistent || Boolean(options.profile);
          let stateLoaded: string | undefined;

          const result = options.state
            ? await (async () => {
                await managedOpen("about:blank", {
                  headed: options.headed,
                  profile: options.profile,
                  persistent,
                  reset: true,
                });
                await managedStateLoad(options.state);
                stateLoaded = options.state;
                return await managedOpen(url, {
                  reset: false,
                });
              })()
            : await managedOpen(url, {
                headed: options.headed,
                profile: options.profile,
                persistent,
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
          printCommandError("open", {
            code: "OPEN_FAILED",
            message: error instanceof Error ? error.message : "open failed",
            suggestions: [
              "Verify the URL is reachable",
              "Verify the local Playwright browser can launch normally",
              "Use `pw open --state ./auth.json <url>` to preload an authenticated state",
            ],
          });
          process.exitCode = 1;
        }
      },
    );
}

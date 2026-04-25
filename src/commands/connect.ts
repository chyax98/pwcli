import type { Command } from "commander";
import { attachManagedSession, resolveAttachTarget } from "./attach-shared.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerConnectCommand(program: Command): void {
  addSessionOption(
    program
      .command("connect [endpoint]")
      .description("Compatibility alias for `pw session attach <name> ...`")
      .option("--ws-endpoint <url>", "Playwright browser websocket endpoint")
      .option("--browser-url <url>", "CDP browser URL, for example http://127.0.0.1:9222")
      .option("--cdp <port>", "CDP port, resolved to http://127.0.0.1:<port>"),
  ).action(
    async (
      endpoint: string | undefined,
      options: { session?: string; wsEndpoint?: string; browserUrl?: string; cdp?: string },
    ) => {
      try {
        const sessionName = requireSessionName(options);
        const target = await resolveAttachTarget(endpoint, options);
        const result = await attachManagedSession({
          sessionName,
          endpoint: target.endpoint,
          resolvedVia: target.resolvedVia,
          ...("browserURL" in target ? { browserURL: target.browserURL } : {}),
        });
        printCommandResult("connect", {
          ...result,
          data: {
            ...result.data,
            compatibilityAlias: "session attach",
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "connect failed";
        printSessionAwareCommandError("connect", error, {
          code: message.includes("_ATTACH_NOT_SUPPORTED")
            ? "CONNECT_NOT_SUPPORTED"
            : "CONNECT_FAILED",
          message,
          suggestions: [
            "Pass exactly one reachable target: positional endpoint, --ws-endpoint, --browser-url, or --cdp",
            "Preferred main path: `pw session attach <name> --ws-endpoint <url>`",
            "For a manual Playwright target, start `node scripts/manual/attach-target.js` and use the printed endpoint",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

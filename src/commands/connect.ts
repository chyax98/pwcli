import type { Command } from "commander";
import { runManagedSessionCommand } from "../session/cli-client.js";
import { parsePageSummary } from "../session/output-parsers.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

function resolveConnectTarget(
  endpoint: string | undefined,
  options: {
    wsEndpoint?: string;
    browserUrl?: string;
    cdp?: string;
  },
) {
  const candidates = [
    options.wsEndpoint ? { endpoint: options.wsEndpoint, resolvedVia: "ws-endpoint" } : null,
    options.browserUrl ? { endpoint: options.browserUrl, resolvedVia: "browser-url" } : null,
    options.cdp
      ? {
          endpoint: `http://127.0.0.1:${options.cdp}`,
          resolvedVia: "cdp",
        }
      : null,
    endpoint ? { endpoint, resolvedVia: "argument" } : null,
  ].filter((item): item is { endpoint: string; resolvedVia: string } => Boolean(item));

  if (candidates.length === 0) {
    throw new Error(
      "connect requires an endpoint, --ws-endpoint <url>, --browser-url <url>, or --cdp <port>",
    );
  }
  if (candidates.length > 1) {
    throw new Error("connect accepts exactly one target source");
  }
  return candidates[0];
}

export function registerConnectCommand(program: Command): void {
  addSessionOption(
    program
      .command("connect [endpoint]")
      .description("Attach a named managed session to an existing Playwright/CDP browser endpoint")
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
        const target = resolveConnectTarget(endpoint, options);
        const probe = await runManagedSessionCommand(
          {
            _: ["snapshot"],
          },
          {
            sessionName,
            reset: true,
            endpoint: target.endpoint,
            createIfMissing: true,
          },
        );
        const page = parsePageSummary(probe.text);

        printCommandResult("connect", {
          page,
          session: {
            scope: "managed",
            name: probe.sessionName,
            default: probe.sessionName === "default",
          },
          data: {
            connected: true,
            endpoint: target.endpoint,
            resolvedVia: target.resolvedVia,
            currentPageAvailable: Boolean(page),
          },
        });
      } catch (error) {
        printSessionAwareCommandError("connect", error, {
          code: "CONNECT_FAILED",
          message: "connect failed",
          suggestions: [
            "Pass exactly one reachable target: positional endpoint, --ws-endpoint, --browser-url, or --cdp",
            "For a manual Playwright target, start `node scripts/manual/connect-target.js` and use the printed wsEndpoint",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

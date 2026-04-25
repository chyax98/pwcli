import type { Command } from "commander";
import { managedOpen, managedStateLoad } from "../core/managed.js";
import {
  getManagedSessionStatus,
  listManagedSessions,
  runManagedSessionCommand,
  stopManagedSession,
} from "../session/cli-client.js";
import { parsePageSummary } from "../session/output-parsers.js";
import { printCommandError, printCommandResult } from "../utils/output.js";

function resolveConnectTarget(
  endpoint: string | undefined,
  options: {
    wsEndpoint?: string;
    browserUrl?: string;
    cdp?: string;
  },
) {
  const candidates = [
    options.wsEndpoint ? { endpoint: options.wsEndpoint } : null,
    options.browserUrl ? { endpoint: options.browserUrl } : null,
    options.cdp ? { endpoint: `http://127.0.0.1:${options.cdp}` } : null,
    endpoint ? { endpoint } : null,
  ].filter((item): item is { endpoint: string } => Boolean(item));

  if (candidates.length > 1) {
    throw new Error("session create accepts exactly one connect target");
  }

  return candidates[0]?.endpoint;
}

async function getSessionPageSummary(name: string) {
  const result = await runManagedSessionCommand(
    {
      _: ["snapshot"],
    },
    {
      sessionName: name,
    },
  );
  return parsePageSummary(result.text);
}

export function registerSessionCommand(program: Command): void {
  const session = program.command("session").description("Manage named browser sessions");

  session
    .command("list")
    .description("List managed sessions in the current workspace")
    .action(async () => {
      try {
        const sessions = await listManagedSessions();
        const enriched = await Promise.all(
          sessions.map(async (entry) => ({
            ...entry,
            page: entry.alive
              ? await getSessionPageSummary(entry.name).catch(() => undefined)
              : undefined,
          })),
        );
        printCommandResult("session list", {
          data: {
            count: enriched.length,
            sessions: enriched,
          },
        });
      } catch (error) {
        printCommandError("session list", {
          code: "SESSION_LIST_FAILED",
          message: error instanceof Error ? error.message : "session list failed",
          suggestions: ["Retry after running `pw session create <name> --open <url>`"],
        });
        process.exitCode = 1;
      }
    });

  session
    .command("create <name>")
    .description("Create or recreate a named managed session")
    .option("--open <url>", "Open a URL in the new session")
    .option("--connect <endpoint>", "Attach the session to an existing endpoint")
    .option("--ws-endpoint <url>", "Playwright browser websocket endpoint")
    .option("--browser-url <url>", "CDP browser URL")
    .option("--cdp <port>", "CDP port, resolved to http://127.0.0.1:<port>")
    .option("--profile <path>", "Use a persistent browser profile")
    .option("--persistent", "Use a persistent browser profile")
    .option("--state <file>", "Load storage state after session creation")
    .option("--headed", "Launch a visible browser window")
    .action(
      async (
        name: string,
        options: {
          open?: string;
          connect?: string;
          wsEndpoint?: string;
          browserUrl?: string;
          cdp?: string;
          profile?: string;
          persistent?: boolean;
          state?: string;
          headed?: boolean;
        },
      ) => {
        try {
          const connectTarget = resolveConnectTarget(options.connect, options);
          const acquisitionCount = [options.open ? 1 : 0, connectTarget ? 1 : 0].reduce(
            (sum, item) => sum + item,
            0,
          );
          if (acquisitionCount > 1) {
            throw new Error("session create accepts exactly one acquisition source");
          }

          const persistent = options.persistent || Boolean(options.profile);
          const result = connectTarget
            ? await (async () => {
                const probe = await runManagedSessionCommand(
                  {
                    _: ["snapshot"],
                  },
                  {
                    sessionName: name,
                    endpoint: connectTarget,
                    reset: true,
                    createIfMissing: true,
                  },
                );
                return {
                  session: {
                    scope: "managed",
                    name: probe.sessionName,
                    default: probe.sessionName === "default",
                  },
                  page: parsePageSummary(probe.text),
                  data: {
                    connected: true,
                    endpoint: connectTarget,
                  },
                };
              })()
            : await managedOpen(options.open ?? "about:blank", {
                sessionName: name,
                headed: options.headed,
                profile: options.profile,
                persistent,
                reset: true,
              });

          if (options.state) {
            await managedStateLoad(options.state, { sessionName: name });
          }

          printCommandResult("session create", {
            session: result.session,
            page: result.page,
            data: {
              ...result.data,
              created: true,
              sessionName: name,
              ...(options.state ? { stateLoaded: options.state } : {}),
            },
          });
        } catch (error) {
          printCommandError("session create", {
            code: "SESSION_CREATE_FAILED",
            message: error instanceof Error ? error.message : "session create failed",
            suggestions: [
              "Use `pw session create <name> --open <url>`",
              "Or `pw session create <name> --connect <endpoint>`",
            ],
          });
          process.exitCode = 1;
        }
      },
    );

  session
    .command("status <name>")
    .description("Show a named managed session status")
    .action(async (name: string) => {
      try {
        const status = await getManagedSessionStatus(name);
        if (!status) {
          printCommandError("session status", {
            code: "SESSION_NOT_FOUND",
            message: `Session '${name}' not found.`,
            suggestions: [
              "Run `pw session list` to inspect active sessions",
              "Create it with `pw session create <name> --open <url>`",
            ],
          });
          process.exitCode = 1;
          return;
        }
        printCommandResult("session status", {
          session: {
            scope: "managed",
            name: status.name,
            default: status.name === "default",
          },
          data: {
            active: status.alive,
            socketPath: status.socketPath,
            version: status.version,
            workspaceDir: status.workspaceDir,
          },
        });
      } catch (error) {
        printCommandError("session status", {
          code: "SESSION_STATUS_FAILED",
          message: error instanceof Error ? error.message : "session status failed",
          suggestions: ["Run `pw session list` first"],
        });
        process.exitCode = 1;
      }
    });

  session
    .command("close <name>")
    .description("Close a named managed session")
    .action(async (name: string) => {
      try {
        const closed = await stopManagedSession(name);
        printCommandResult("session close", {
          data: {
            name,
            closed,
          },
        });
      } catch (error) {
        printCommandError("session close", {
          code: "SESSION_CLOSE_FAILED",
          message: error instanceof Error ? error.message : "session close failed",
          suggestions: ["Retry or remove the stale session files manually"],
        });
        process.exitCode = 1;
      }
    });
}

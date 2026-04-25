import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { managedOpen, managedStateLoad } from "../core/managed.js";
import {
  getManagedSessionEntry,
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
    .description("Create a named managed session")
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
    .command("recreate <name>")
    .description("Recreate a named managed session with a new browser shape")
    .option("--headed", "Launch the recreated session in headed mode")
    .option("--headless", "Launch the recreated session in headless mode")
    .option("--open <url>", "Override the target URL after recreation")
    .action(
      async (
        name: string,
        options: {
          headed?: boolean;
          headless?: boolean;
          open?: string;
        },
      ) => {
        let tempDir: string | undefined;
        try {
          if (options.headed && options.headless) {
            throw new Error("session recreate accepts either --headed or --headless, not both");
          }

          const entry = await getManagedSessionEntry(name);
          if (!entry) {
            throw new Error(`SESSION_NOT_FOUND:${name}`);
          }

          const currentPage = await getSessionPageSummary(name).catch(() => undefined);
          const currentHeaded = entry.config.browser?.launchOptions?.headless === false;
          const headed = options.headed ? true : options.headless ? false : currentHeaded;
          const profile = entry.config.browser?.userDataDir;
          const persistent = Boolean(entry.config.cli?.persistent || profile);
          const targetUrl = options.open ?? currentPage?.url ?? "about:blank";

          tempDir = await mkdtemp(join(tmpdir(), "pwcli-recreate-"));
          const statePath = join(tempDir, "state.json");
          let stateSaved = false;
          try {
            await runManagedSessionCommand(
              {
                _: ["state-save", statePath],
              },
              {
                sessionName: name,
              },
            );
            stateSaved = true;
          } catch {}

          await stopManagedSession(name);
          await managedOpen(stateSaved ? "about:blank" : targetUrl, {
            sessionName: name,
            headed,
            ...(profile ? { profile } : {}),
            ...(persistent ? { persistent: true } : {}),
            reset: true,
          });

          if (stateSaved) {
            await managedStateLoad(statePath, { sessionName: name });
            if (targetUrl && targetUrl !== "about:blank") {
              await managedOpen(targetUrl, {
                sessionName: name,
                reset: false,
              });
            }
          }

          const page = await getSessionPageSummary(name).catch(() => undefined);
          printCommandResult("session recreate", {
            session: {
              scope: "managed",
              name,
              default: name === "default",
            },
            page,
            data: {
              recreated: true,
              headed,
              ...(profile ? { profile } : {}),
              ...(persistent ? { persistent: true } : {}),
              ...(options.open ? { openedUrl: options.open } : {}),
            },
          });
        } catch (error) {
          printCommandError("session recreate", {
            code: "SESSION_RECREATE_FAILED",
            message: error instanceof Error ? error.message : "session recreate failed",
            suggestions: [
              "Use `pw session recreate <name> --headed`",
              "Or `pw session recreate <name> --headless`",
            ],
          });
          process.exitCode = 1;
        } finally {
          if (tempDir) {
            await rm(tempDir, { recursive: true, force: true }).catch(() => {});
          }
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

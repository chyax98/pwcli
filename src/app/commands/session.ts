import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { managedStateLoad, managedStateSave } from "../../domain/identity-state/service.js";
import { sessionRoutingError } from "../../domain/session/routing.js";
import {
  applySessionDefaults,
  getManagedSessionEntry,
  getManagedSessionStatus,
  getSessionDefaults,
  listManagedSessions,
  managedOpen,
  resolveLifecycleHeaded,
  resolveTraceEnabled,
  runManagedSessionCommand,
  stopAllManagedSessions,
  stopManagedSession,
} from "../../domain/session/service.js";
import { parsePageSummary } from "../../infra/playwright/output-parsers.js";
import { printCommandError, printCommandResult } from "../output.js";
import { attachManagedSession, resolveAttachTarget } from "./attach-shared.js";

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
    .option("--profile <path>", "Use a persistent browser profile")
    .option("--persistent", "Use a persistent browser profile")
    .option("--state <file>", "Load storage state after session creation")
    .option("--headed", "Launch a visible browser window")
    .option("--headless", "Force headless mode")
    .option("--trace", "Enable tracing for the session")
    .option("--no-trace", "Disable tracing for the session")
    .action(
      async (
        name: string,
        options: {
          open?: string;
          profile?: string;
          persistent?: boolean;
          state?: string;
          headed?: boolean;
          headless?: boolean;
          trace?: boolean;
          noTrace?: boolean;
        },
      ) => {
        try {
          if (name.length > 16) {
            throw new Error(`SESSION_NAME_TOO_LONG:${name}:16`);
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            throw new Error(`SESSION_NAME_INVALID:${name}`);
          }
          if (options.headed && options.headless) {
            throw new Error("session create accepts either --headed or --headless, not both");
          }
          const defaults = await getSessionDefaults();
          const headed = await resolveLifecycleHeaded(options);
          const traceEnabled = await resolveTraceEnabled(options);
          const persistent = options.persistent || Boolean(options.profile);
          await managedOpen("about:blank", {
            sessionName: name,
            headed,
            profile: options.profile,
            persistent,
            reset: true,
          });

          if (options.state) {
            await managedStateLoad(options.state, { sessionName: name });
          }

          const appliedDefaults = await applySessionDefaults({
            sessionName: name,
            traceEnabled,
          });

          const targetUrl = options.open ?? "about:blank";
          const result =
            targetUrl === "about:blank"
              ? await managedOpen("about:blank", {
                  sessionName: name,
                  reset: false,
                })
              : await managedOpen(targetUrl, {
                  sessionName: name,
                  reset: false,
                });

          printCommandResult("session create", {
            session: result.session,
            page: result.page,
            data: {
              ...result.data,
              created: true,
              sessionName: name,
              defaults,
              appliedDefaults,
              headed,
              traceEnabled,
              ...(options.state ? { stateLoaded: options.state } : {}),
            },
          });
        } catch (error) {
          const routing = sessionRoutingError(
            error instanceof Error ? error.message : String(error),
          );
          if (routing) {
            printCommandError("session create", routing);
            process.exitCode = 1;
            return;
          }
          printCommandError("session create", {
            code: "SESSION_CREATE_FAILED",
            message: error instanceof Error ? error.message : "session create failed",
            suggestions: [
              "Use `pw session create <name> --open <url>`",
              "Use `pw session attach <name> --ws-endpoint <url>` to bind an existing browser",
            ],
          });
          process.exitCode = 1;
        }
      },
    );

  session
    .command("attach <name> [endpoint]")
    .description("Attach a named managed session to an existing Playwright/CDP browser endpoint")
    .option("--ws-endpoint <url>", "Playwright browser websocket endpoint")
    .option("--browser-url <url>", "CDP browser URL, for example http://127.0.0.1:9222")
    .option("--cdp <port>", "CDP port, resolved to http://127.0.0.1:<port>")
    .option("--trace", "Enable tracing for the attached session")
    .option("--no-trace", "Disable tracing for the attached session")
    .action(
      async (
        name: string,
        endpoint: string | undefined,
        options: {
          wsEndpoint?: string;
          browserUrl?: string;
          cdp?: string;
          trace?: boolean;
          noTrace?: boolean;
        },
      ) => {
        try {
          if (name.length > 16) {
            throw new Error(`SESSION_NAME_TOO_LONG:${name}:16`);
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            throw new Error(`SESSION_NAME_INVALID:${name}`);
          }
          const defaults = await getSessionDefaults();
          const traceEnabled = await resolveTraceEnabled(options);
          const target = await resolveAttachTarget(endpoint, options);
          const result = await attachManagedSession({
            sessionName: name,
            endpoint: target.endpoint,
            resolvedVia: target.resolvedVia,
            ...("browserURL" in target ? { browserURL: target.browserURL } : {}),
          });
          const appliedDefaults = await applySessionDefaults({
            sessionName: name,
            traceEnabled,
          });
          printCommandResult("session attach", {
            ...result,
            data: {
              ...result.data,
              defaults,
              appliedDefaults,
              traceEnabled,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "session attach failed";
          const routing = sessionRoutingError(message);
          if (routing) {
            printCommandError("session attach", routing);
            process.exitCode = 1;
            return;
          }
          printCommandError("session attach", {
            code: "SESSION_ATTACH_FAILED",
            message,
            suggestions: [
              "Pass exactly one attach source: positional endpoint, --ws-endpoint, --browser-url, or --cdp",
              "For a local verification target, start `node scripts/manual/attach-target.js` and use any printed attach source",
              "If the browser only exposes CDP, resolve or publish a Playwright ws endpoint and attach with `--ws-endpoint`",
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
    .option("--trace", "Enable tracing for the recreated session")
    .option("--no-trace", "Disable tracing for the recreated session")
    .action(
      async (
        name: string,
        options: {
          headed?: boolean;
          headless?: boolean;
          open?: string;
          trace?: boolean;
          noTrace?: boolean;
        },
      ) => {
        let tempDir: string | undefined;
        try {
          if (name.length > 16) {
            throw new Error(`SESSION_NAME_TOO_LONG:${name}:16`);
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            throw new Error(`SESSION_NAME_INVALID:${name}`);
          }
          if (options.headed && options.headless) {
            throw new Error("session recreate accepts either --headed or --headless, not both");
          }

          const entry = await getManagedSessionEntry(name);
          if (!entry) {
            throw new Error(`SESSION_NOT_FOUND:${name}`);
          }

          const currentPage = await getSessionPageSummary(name).catch(() => undefined);
          const currentHeaded = entry.config.browser?.launchOptions?.headless === false;
          const defaults = await getSessionDefaults();
          const headed = options.headed ? true : options.headless ? false : currentHeaded;
          const traceEnabled = await resolveTraceEnabled(options);
          const profile = entry.config.browser?.userDataDir;
          const persistent = Boolean(entry.config.cli?.persistent || profile);
          const targetUrl = options.open ?? currentPage?.url ?? "about:blank";

          tempDir = await mkdtemp(join(tmpdir(), "pwcli-recreate-"));
          const statePath = join(tempDir, "state.json");
          let stateSaved = false;
          try {
            await managedStateSave(statePath, { sessionName: name });
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
          }

          const appliedDefaults = await applySessionDefaults({
            sessionName: name,
            traceEnabled,
          });

          if (targetUrl && targetUrl !== "about:blank") {
            await managedOpen(targetUrl, {
              sessionName: name,
              reset: false,
            });
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
              defaults,
              appliedDefaults,
              traceEnabled,
              ...(profile ? { profile } : {}),
              ...(persistent ? { persistent: true } : {}),
              ...(options.open ? { openedUrl: options.open } : {}),
            },
          });
        } catch (error) {
          const routing = sessionRoutingError(
            error instanceof Error ? error.message : String(error),
          );
          if (routing) {
            printCommandError("session recreate", routing);
            process.exitCode = 1;
            return;
          }
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
    .command("close [name]")
    .description("Close one named managed session, or all managed sessions with --all")
    .option("--all", "Close every managed session in the current workspace bucket")
    .action(async (name: string | undefined, options: { all?: boolean }) => {
      try {
        const closeAll = Boolean(options.all) || name === "all";
        if (!closeAll && !name) {
          throw new Error("session close requires <name> or --all");
        }
        if (closeAll && name && name !== "all") {
          throw new Error("session close accepts either <name> or --all, not both");
        }
        if (closeAll) {
          const result = await stopAllManagedSessions();
          printCommandResult("session close", {
            data: {
              all: true,
              count: result.count,
              closedCount: result.closedCount,
              sessions: result.sessions,
            },
          });
          return;
        }
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
          suggestions:
            error instanceof Error && error.message.includes("--all")
              ? [
                  "Use `pw session close <name>` to close one session",
                  "Or use `pw session close --all` / `pw session close all` to close every managed session in the current workspace bucket",
                ]
              : ["Retry or remove the stale session files manually"],
        });
        process.exitCode = 1;
      }
    });
}

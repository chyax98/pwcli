import { accessSync, constants, existsSync, lstatSync, readFileSync } from "node:fs";
import { connect as connectNet } from "node:net";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { connect as connectTls } from "node:tls";
import type { Command } from "commander";
import { managedObserveStatus } from "../../domain/diagnostics/service.js";
import { listPluginNames, resolvePluginPath } from "../../infra/plugins/resolve.js";
import { isModalStateBlockedMessage } from "../../infra/playwright/runtime/shared.js";
import {
  getManagedSessionEntry,
  getManagedSessionStatus,
  listManagedSessions,
  runManagedSessionCommand,
} from "../../domain/session/service.js";
import { parsePageSummary } from "../../infra/playwright/output-parsers.js";
import { printCommandError, printCommandResult } from "../output.js";
import { addSessionOption } from "./session-options.js";

type DoctorStatus = "ok" | "warn" | "fail" | "skipped";

type DoctorDiagnostic = {
  kind: string;
  status: DoctorStatus;
  summary: string;
  details: Record<string, unknown>;
};

function expandPath(input: string) {
  if (input === "~") {
    return homedir();
  }
  if (input.startsWith("~/")) {
    return resolve(homedir(), input.slice(2));
  }
  return resolve(input);
}

function canReadPath(path: string) {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function canWritePath(path: string) {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function inspectProfilePath(input?: string): DoctorDiagnostic {
  if (!input) {
    return {
      kind: "profile-path",
      status: "skipped",
      summary: "No profile path provided",
      details: {},
    };
  }
  const resolvedPath = expandPath(input);
  const exists = existsSync(resolvedPath);
  const type = exists ? (lstatSync(resolvedPath).isDirectory() ? "directory" : "file") : "missing";
  const writable = exists ? canWritePath(resolvedPath) : canWritePath(resolve(resolvedPath, ".."));
  return {
    kind: "profile-path",
    status: type === "file" || !writable ? "warn" : "ok",
    summary:
      type === "file"
        ? "Profile path points to a file"
        : writable
          ? "Profile path is usable"
          : "Profile path is not writable",
    details: {
      requestedPath: input,
      resolvedPath,
      exists,
      type,
      writable,
      usable: type !== "file" && writable,
    },
  };
}

function inspectStatePath(input?: string): DoctorDiagnostic {
  if (!input) {
    return {
      kind: "state-path",
      status: "skipped",
      summary: "No state path provided",
      details: {},
    };
  }
  const resolvedPath = expandPath(input);
  const exists = existsSync(resolvedPath);
  if (!exists) {
    return {
      kind: "state-path",
      status: "warn",
      summary: "State file does not exist",
      details: {
        requestedPath: input,
        resolvedPath,
        exists,
      },
    };
  }

  const readable = canReadPath(resolvedPath);
  let validJson = false;
  let cookieCount = 0;
  let originCount = 0;
  let parseError = "";
  if (readable) {
    try {
      const parsed = JSON.parse(readFileSync(resolvedPath, "utf8"));
      validJson = true;
      cookieCount = Array.isArray(parsed.cookies) ? parsed.cookies.length : 0;
      originCount = Array.isArray(parsed.origins) ? parsed.origins.length : 0;
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    kind: "state-path",
    status: readable && validJson ? "ok" : "warn",
    summary:
      readable && validJson ? "State file is readable JSON" : "State file is unreadable or invalid",
    details: {
      requestedPath: input,
      resolvedPath,
      exists,
      readable,
      validJson,
      cookieCount,
      originCount,
      ...(parseError ? { parseError } : {}),
    },
  };
}

async function probeEndpoint(endpoint?: string): Promise<DoctorDiagnostic> {
  if (!endpoint) {
    return {
      kind: "endpoint-reachability",
      status: "skipped",
      summary: "No endpoint provided",
      details: {},
    };
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error) {
    return {
      kind: "endpoint-reachability",
      status: "warn",
      summary: "Endpoint is not a valid URL",
      details: {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  if (url.protocol === "http:" || url.protocol === "https:") {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(3000),
      });
      return {
        kind: "endpoint-reachability",
        status: "ok",
        summary: "HTTP endpoint responded",
        details: {
          endpoint,
          protocol: url.protocol,
          statusCode: response.status,
          ok: response.ok,
        },
      };
    } catch (error) {
      return {
        kind: "endpoint-reachability",
        status: "warn",
        summary: "HTTP endpoint did not respond",
        details: {
          endpoint,
          protocol: url.protocol,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  if (url.protocol === "ws:" || url.protocol === "wss:") {
    const port = url.port || (url.protocol === "wss:" ? "443" : "80");
    return await new Promise((resolveResult) => {
      let settled = false;
      const finish = (diagnostic: DoctorDiagnostic) => {
        if (settled) {
          return;
        }
        settled = true;
        resolveResult(diagnostic);
      };
      const onConnect = (socket: { destroy: () => void }) => {
        socket.destroy();
        finish({
          kind: "endpoint-reachability",
          status: "ok",
          summary: "WebSocket endpoint accepted a TCP connection",
          details: {
            endpoint,
            protocol: url.protocol,
            host: url.hostname,
            port: Number(port),
          },
        });
      };
      const socket =
        url.protocol === "wss:"
          ? connectTls(
              {
                host: url.hostname,
                port: Number(port),
              },
              function onSecureConnect() {
                onConnect(this);
              },
            )
          : connectNet(
              {
                host: url.hostname,
                port: Number(port),
              },
              function onNetConnect() {
                onConnect(this);
              },
            );
      socket.setTimeout(3000, () => {
        socket.destroy();
        finish({
          kind: "endpoint-reachability",
          status: "warn",
          summary: "WebSocket endpoint timed out",
          details: {
            endpoint,
            protocol: url.protocol,
            host: url.hostname,
            port: Number(port),
          },
        });
      });
      socket.on("error", (error) => {
        socket.destroy();
        finish({
          kind: "endpoint-reachability",
          status: "warn",
          summary: "WebSocket endpoint is unreachable",
          details: {
            endpoint,
            protocol: url.protocol,
            host: url.hostname,
            port: Number(port),
            error: error.message,
          },
        });
      });
    });
  }

  return {
    kind: "endpoint-reachability",
    status: "warn",
    summary: "Unsupported endpoint protocol",
    details: {
      endpoint,
      protocol: url.protocol,
    },
  };
}

async function inspectSessionSubstrate(sessionName?: string): Promise<DoctorDiagnostic> {
  const sessions = await listManagedSessions();
  const summary: Record<string, unknown> = {
    discoveredCount: sessions.length,
    aliveCount: sessions.filter((session) => session.alive).length,
    sessions,
  };

  if (!sessionName) {
    return {
      kind: "session-substrate",
      status: sessions.length > 0 ? "ok" : "warn",
      summary:
        sessions.length > 0 ? "Managed session registry is readable" : "No managed sessions found",
      details: summary,
    };
  }

  const entry = await getManagedSessionEntry(sessionName);
  const status = await getManagedSessionStatus(sessionName);
  if (!entry || !status) {
    return {
      kind: "session-substrate",
      status: "warn",
      summary: `Managed session '${sessionName}' not found`,
      details: {
        ...summary,
        requestedSession: sessionName,
      },
    };
  }

  let probe: Record<string, unknown> | undefined;
  if (status.alive) {
    try {
      const result = await runManagedSessionCommand(
        {
          _: ["snapshot"],
        },
        {
          sessionName,
        },
      );
      probe = {
        reachable: true,
        page: parsePageSummary(result.text),
      };
    } catch (error) {
      probe = {
        reachable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    kind: "session-substrate",
    status: status.alive && probe?.reachable !== false ? "ok" : "warn",
    summary: status.alive
      ? "Managed session is alive"
      : "Managed session is registered but not alive",
    details: {
      ...summary,
      requestedSession: sessionName,
      socketPath: status.socketPath,
      workspaceDir: status.workspaceDir,
      version: status.version,
      alive: status.alive,
      config: entry.config,
      ...(probe ? { probe } : {}),
    },
  };
}

async function inspectObserveStatus(sessionName?: string): Promise<DoctorDiagnostic> {
  if (!sessionName) {
    return {
      kind: "observe-status",
      status: "skipped",
      summary: "No session provided for observe status",
      details: {},
    };
  }

  try {
    const result = await managedObserveStatus({ sessionName });
    const status =
      typeof result.data?.status === "object" && result.data.status ? result.data.status : {};
    const workspace =
      typeof result.data?.workspace === "object" && result.data.workspace
        ? result.data.workspace
        : {};
    const pageErrors =
      typeof result.data?.pageErrors === "object" && result.data.pageErrors
        ? result.data.pageErrors
        : {};
    const routes =
      typeof result.data?.routes === "object" && result.data.routes ? result.data.routes : {};
    const stream =
      typeof result.data?.stream === "object" && result.data.stream ? result.data.stream : {};

    return {
      kind: "observe-status",
      status: "ok",
      summary: "Observe status is readable",
      details: {
        sessionName,
        page: result.page,
        workspace,
        pageErrors,
        routes,
        trace: result.data?.trace,
        har: result.data?.har,
        bootstrap: result.data?.bootstrap,
        console: result.data?.console,
        network: result.data?.network,
        stream,
        rawStatus: status,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isModalStateBlockedMessage(message)) {
      return {
        kind: "modal-state",
        status: "warn",
        summary: "Workspace reads are blocked by a modal dialog",
        details: {
          sessionName,
          code: "MODAL_STATE_BLOCKED",
          error: message,
        },
      };
    }
    return {
      kind: "observe-status",
      status: "warn",
      summary: "Observe status could not be read",
      details: {
        sessionName,
        error: message,
      },
    };
  }
}

function inspectPluginResolution(pluginName?: string): DoctorDiagnostic {
  const plugins = listPluginNames();
  if (!pluginName) {
    return {
      kind: "plugin-resolution",
      status: plugins.length > 0 ? "ok" : "warn",
      summary: plugins.length > 0 ? "Plugin directories are readable" : "No plugins discovered",
      details: {
        discoveredCount: plugins.length,
        plugins,
      },
    };
  }

  const resolvedPath = resolvePluginPath(pluginName);
  return {
    kind: "plugin-resolution",
    status: resolvedPath ? "ok" : "warn",
    summary: resolvedPath ? `Plugin '${pluginName}' resolved` : `Plugin '${pluginName}' not found`,
    details: {
      requestedPlugin: pluginName,
      discoveredCount: plugins.length,
      plugins,
      resolvedPath,
    },
  };
}

function summarizeDiagnostics(diagnostics: DoctorDiagnostic[]) {
  return diagnostics.reduce(
    (summary, diagnostic) => {
      summary[diagnostic.status] += 1;
      return summary;
    },
    { ok: 0, warn: 0, fail: 0, skipped: 0 },
  );
}

export function registerDoctorCommand(program: Command): void {
  addSessionOption(
    program
      .command("doctor")
      .description("Run readonly diagnostics for session substrate and local inputs")
      .option("--plugin <name>", "Resolve a plugin name")
      .option("--profile <path>", "Inspect a profile path")
      .option("--state <file>", "Inspect a storage state path")
      .option("--endpoint <url>", "Probe an endpoint for reachability"),
  ).action(
    async (options: {
      session?: string;
      plugin?: string;
      profile?: string;
      state?: string;
      endpoint?: string;
    }) => {
      try {
        const diagnostics = [
          await inspectSessionSubstrate(options.session),
          await inspectObserveStatus(options.session),
          inspectPluginResolution(options.plugin),
          inspectProfilePath(options.profile),
          inspectStatePath(options.state),
          await probeEndpoint(options.endpoint),
        ];
        const summary = summarizeDiagnostics(diagnostics);
        printCommandResult("doctor", {
          ...(options.session
            ? {
                session: {
                  scope: "managed",
                  name: options.session,
                  default: options.session === "default",
                },
              }
            : {}),
          diagnostics,
          data: {
            healthy: summary.fail === 0 && summary.warn === 0,
            summary,
          },
        });
      } catch (error) {
        printCommandError("doctor", {
          code: "DOCTOR_FAILED",
          message: error instanceof Error ? error.message : "doctor failed",
          suggestions: [
            "Retry with `pw doctor --session <name>` to probe a managed session",
            "Add `--plugin`, `--profile`, `--state`, or `--endpoint` to inspect specific inputs",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

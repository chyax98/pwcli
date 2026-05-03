import type { Command } from "commander";
import { readBootstrapConfig } from "../../infra/fs/bootstrap-config.js";
import { getAuthProvider, listAuthProviders } from "../../infra/auth-providers/registry.js";
import {
  getManagedSessionEntry,
  getManagedSessionStatus,
  listManagedSessions,
  runManagedSessionCommand,
} from "../../infra/playwright/cli-client.js";
import { parsePageSummary } from "../../infra/playwright/output-parsers.js";
import { isModalStateBlockedMessage } from "../../infra/playwright/runtime/shared.js";
import { managedObserveStatus } from "../../infra/playwright/runtime.js";
import {
  type DoctorDiagnostic,
  compactDoctorDiagnostic,
  doctorRecovery,
  summarizeDiagnostics,
} from "../../domain/environment/health-checks.js";
import {
  inspectEnvironment,
  inspectProfilePath,
  inspectStatePath,
  probeEndpoint,
} from "../../infra/environment/health-probes.js";
import { printCommandError, printCommandResult } from "../output.js";
import { addSessionOption } from "./session-options.js";

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

function inspectAuthProviderResolution(providerName?: string): DoctorDiagnostic {
  const providers = listAuthProviders();
  if (!providerName) {
    return {
      kind: "auth-provider-resolution",
      status: providers.length > 0 ? "ok" : "warn",
      summary:
        providers.length > 0
          ? "Built-in auth providers are readable"
          : "No auth providers discovered",
      details: {
        discoveredCount: providers.length,
        providers,
      },
    };
  }

  const provider = getAuthProvider(providerName);
  return {
    kind: "auth-provider-resolution",
    status: provider ? "ok" : "warn",
    summary: provider
      ? `Auth provider '${providerName}' resolved`
      : `Auth provider '${providerName}' not found`,
    details: {
      requestedProvider: providerName,
      discoveredCount: providers.length,
      providers,
      resolved: Boolean(provider),
    },
  };
}

async function inspectBootstrapConfig(sessionName?: string): Promise<DoctorDiagnostic> {
  const config = await readBootstrapConfig(sessionName);
  if (!config) {
    return {
      kind: "bootstrap-config",
      status: "ok",
      summary: "No bootstrap config persisted",
      details: {
        sessionName: sessionName ?? "default",
        bootstrapConfigMissing: true,
      },
    };
  }
  return {
    kind: "bootstrap-config",
    status: "ok",
    summary: `Bootstrap config present with ${config.initScripts.length} init script(s)`,
    details: {
      sessionName: sessionName ?? "default",
      initScriptCount: config.initScripts.length,
      initScripts: config.initScripts,
      headersFile: config.headersFile ?? null,
      appliedAt: config.appliedAt,
    },
  };
}

export function registerDoctorCommand(program: Command): void {
  addSessionOption(
    program
      .command("doctor")
      .description("Run readonly diagnostics for session substrate and local inputs")
      .option("--auth-provider <name>", "Resolve a built-in auth provider")
      .option("--profile <path>", "Inspect a profile path")
      .option("--state <file>", "Inspect a storage state path")
      .option("--endpoint <url>", "Probe an endpoint for reachability")
      .option("--verbose", "Return the full diagnostic details instead of the compact default"),
  ).action(
    async (options: {
      session?: string;
      authProvider?: string;
      profile?: string;
      state?: string;
      endpoint?: string;
      verbose?: boolean;
    }) => {
      try {
        const diagnostics = [
          await inspectEnvironment(process.cwd()),
          await inspectSessionSubstrate(options.session),
          await inspectObserveStatus(options.session),
          await inspectBootstrapConfig(options.session),
          inspectAuthProviderResolution(options.authProvider),
          inspectProfilePath(options.profile),
          inspectStatePath(options.state),
          await probeEndpoint(options.endpoint),
        ];
        const summary = summarizeDiagnostics(diagnostics);
        const recovery = doctorRecovery(diagnostics);
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
          diagnostics: options.verbose ? diagnostics : diagnostics.map(compactDoctorDiagnostic),
          data: {
            healthy: summary.fail === 0 && summary.warn === 0,
            summary,
            recovery,
          },
        });
      } catch (error) {
        printCommandError("doctor", {
          code: "DOCTOR_FAILED",
          message: error instanceof Error ? error.message : "doctor failed",
          suggestions: [
            "Retry with `pw doctor --session <name>` to probe a managed session",
            "Add `--auth-provider`, `--profile`, `--state`, or `--endpoint` to inspect specific inputs",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}

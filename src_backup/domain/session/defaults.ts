import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { managedTrace } from "../../infra/playwright/runtime.js";

export type SessionDefaults = {
  headed: boolean;
  trace: boolean;
  diagnosticsRecords: boolean;
  runArtifacts: boolean;
};

type SessionDefaultsConfig = {
  sessionDefaults?: Partial<SessionDefaults>;
};

export const DEFAULT_SESSION_DEFAULTS: SessionDefaults = {
  headed: false,
  trace: true,
  diagnosticsRecords: true,
  runArtifacts: true,
};

const DEFAULTS_CONFIG_PATH = resolve(".pwcli", "config.json");

async function readDefaultsConfig(): Promise<Partial<SessionDefaults>> {
  try {
    await access(DEFAULTS_CONFIG_PATH, constants.R_OK);
  } catch {
    return {};
  }

  try {
    const text = await readFile(DEFAULTS_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(text) as SessionDefaultsConfig;
    return parsed.sessionDefaults ?? {};
  } catch {
    return {};
  }
}

export async function getSessionDefaults(): Promise<SessionDefaults> {
  const config = await readDefaultsConfig();
  return {
    headed: typeof config.headed === "boolean" ? config.headed : DEFAULT_SESSION_DEFAULTS.headed,
    trace: typeof config.trace === "boolean" ? config.trace : DEFAULT_SESSION_DEFAULTS.trace,
    diagnosticsRecords:
      typeof config.diagnosticsRecords === "boolean"
        ? config.diagnosticsRecords
        : DEFAULT_SESSION_DEFAULTS.diagnosticsRecords,
    runArtifacts:
      typeof config.runArtifacts === "boolean"
        ? config.runArtifacts
        : DEFAULT_SESSION_DEFAULTS.runArtifacts,
  };
}

export async function resolveLifecycleHeaded(options: {
  headed?: boolean;
  headless?: boolean;
}): Promise<boolean> {
  if (options.headed) {
    return true;
  }
  if (options.headless) {
    return false;
  }
  return (await getSessionDefaults()).headed;
}

export async function resolveTraceEnabled(options: {
  trace?: boolean;
  noTrace?: boolean;
}): Promise<boolean> {
  if (options.trace === true) {
    return true;
  }
  if (options.trace === false || options.noTrace) {
    return false;
  }
  return (await getSessionDefaults()).trace;
}

export async function applySessionDefaults(options: {
  sessionName: string;
  traceEnabled: boolean;
}) {
  if (!options.traceEnabled) {
    return {
      trace: {
        requested: false,
        applied: false,
      },
    };
  }

  try {
    const trace = await managedTrace("start", { sessionName: options.sessionName });
    return {
      trace: {
        requested: true,
        applied: true,
        data: trace.data,
      },
    };
  } catch (error) {
    return {
      trace: {
        requested: true,
        applied: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

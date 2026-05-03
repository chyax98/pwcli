import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

// ─── Bootstrap config ────────────────────────────────────────────────────────

export type BootstrapConfig = {
  initScripts: string[];
  headersFile?: string;
  appliedAt: string;
};

function bootstrapConfigPath(sessionName?: string) {
  return resolve(join(".pwcli", "bootstrap", `${sessionName ?? "default"}.json`));
}

export async function readBootstrapConfig(sessionName?: string): Promise<BootstrapConfig | null> {
  try {
    const text = await readFile(bootstrapConfigPath(sessionName), "utf8");
    return JSON.parse(text) as BootstrapConfig;
  } catch {
    return null;
  }
}

export async function writeBootstrapConfig(
  sessionName: string | undefined,
  config: BootstrapConfig,
): Promise<void> {
  const configPath = bootstrapConfigPath(sessionName);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
}

export async function removeBootstrapInitScript(
  sessionName: string | undefined,
  scriptPath: string,
): Promise<BootstrapConfig | null> {
  const existing = await readBootstrapConfig(sessionName);
  if (!existing) return null;
  const updated: BootstrapConfig = {
    ...existing,
    initScripts: existing.initScripts.filter((p) => p !== resolve(scriptPath)),
    appliedAt: new Date().toISOString(),
  };
  await writeBootstrapConfig(sessionName, updated);
  return updated;
}

// ─── Session defaults ─────────────────────────────────────────────────────────

export type SessionDefaults = {
  headed: boolean;
  trace: boolean;
  diagnosticsRecords: boolean;
  runArtifacts: boolean;
};

export const DEFAULT_SESSION_DEFAULTS: SessionDefaults = {
  headed: false,
  trace: true,
  diagnosticsRecords: true,
  runArtifacts: true,
};

const DEFAULTS_CONFIG_PATH = resolve(".pwcli", "config.json");

export async function getSessionDefaults(): Promise<SessionDefaults> {
  try {
    await access(DEFAULTS_CONFIG_PATH, constants.R_OK);
    const text = await readFile(DEFAULTS_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(text) as { sessionDefaults?: Partial<SessionDefaults> };
    const config = parsed.sessionDefaults ?? {};
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
  } catch {
    return { ...DEFAULT_SESSION_DEFAULTS };
  }
}

export async function resolveHeaded(options: {
  headed?: boolean;
  headless?: boolean;
}): Promise<boolean> {
  if (options.headed) return true;
  if (options.headless) return false;
  return (await getSessionDefaults()).headed;
}

export async function resolveTraceEnabled(options: {
  trace?: boolean;
  noTrace?: boolean;
}): Promise<boolean> {
  if (options.trace === true) return true;
  if (options.trace === false || options.noTrace) return false;
  return (await getSessionDefaults()).trace;
}

import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

// ─── Playwright daemon session config ────────────────────────────────────────

type JsonObject = Record<string, unknown>;

export type SessionRecordHarConfig = {
  path: string;
  content?: "omit" | "embed" | "attach";
  mode?: "full" | "minimal";
  urlFilter?: string;
};

export type SessionRecordVideoConfig = {
  dir: string;
  size?: {
    width: number;
    height: number;
  };
};

export type SessionRuntimeConfig = {
  browser?: {
    userDataDir?: string;
    isolated?: boolean;
    launchOptions?: JsonObject;
    contextOptions?: JsonObject & {
      recordHar?: SessionRecordHarConfig;
      recordVideo?: SessionRecordVideoConfig;
    };
  };
};

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeJsonObjects(base: JsonObject, overrides: JsonObject): JsonObject {
  const result: JsonObject = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = mergeJsonObjects(result[key], value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

async function readSessionRuntimeConfig(configPath?: string): Promise<SessionRuntimeConfig> {
  if (!configPath) return {};
  const text = await readFile(configPath, "utf8");
  return JSON.parse(text) as SessionRuntimeConfig;
}

function sessionRuntimeConfigPath(sessionName: string) {
  return resolve(join(".pwcli", "session-config", `${sessionName}.config.json`));
}

export async function writeSessionRuntimeConfig(options: {
  sessionName: string;
  baseConfigPath?: string;
  recordHar?: SessionRecordHarConfig;
  recordVideo?: SessionRecordVideoConfig;
}) {
  if (!options.baseConfigPath && !options.recordHar && !options.recordVideo) return undefined;

  const base = await readSessionRuntimeConfig(options.baseConfigPath);
  const contextOptions: JsonObject = {
    ...(options.recordHar ? { recordHar: options.recordHar } : {}),
    ...(options.recordVideo ? { recordVideo: options.recordVideo } : {}),
  };
  const overrides: SessionRuntimeConfig =
    options.recordHar || options.recordVideo
      ? {
          browser: {
            contextOptions,
          },
        }
      : {};
  const config = mergeJsonObjects(
    base as JsonObject,
    overrides as JsonObject,
  ) as SessionRuntimeConfig;
  const configPath = sessionRuntimeConfigPath(options.sessionName);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
  return { configPath, config };
}

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

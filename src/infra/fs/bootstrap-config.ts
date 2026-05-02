import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type BootstrapConfig = {
  initScripts: string[];
  headersFile?: string;
  appliedAt: string;
};

function bootstrapConfigPath(sessionName?: string) {
  const name = sessionName ?? "default";
  return resolve(join(".pwcli", "bootstrap", `${name}.json`));
}

export async function readBootstrapConfig(
  sessionName?: string,
): Promise<BootstrapConfig | null> {
  const configPath = bootstrapConfigPath(sessionName);
  try {
    const text = await readFile(configPath, "utf8");
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
  if (!existing) {
    return null;
  }
  const normalized = resolve(scriptPath);
  const updated: BootstrapConfig = {
    ...existing,
    initScripts: existing.initScripts.filter((p) => p !== normalized),
    appliedAt: new Date().toISOString(),
  };
  await writeBootstrapConfig(sessionName, updated);
  return updated;
}

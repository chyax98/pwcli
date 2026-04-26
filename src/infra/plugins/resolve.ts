import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FILE_CANDIDATES = [".js", ".mjs", ".cjs", ".ts"];
const BUNDLED_PLUGIN_DIR = fileURLToPath(new URL("../../../plugins", import.meta.url));

function pluginDirs() {
  return [
    BUNDLED_PLUGIN_DIR,
    resolve(process.cwd(), "plugins"),
    resolve(process.cwd(), ".pwcli", "plugins"),
    join(homedir(), ".pwcli", "plugins"),
  ];
}

function resolveExplicitPluginPath(name: string) {
  if (existsSync(name)) {
    return resolve(name);
  }
  for (const ext of FILE_CANDIDATES) {
    const candidate = `${name}${ext}`;
    if (existsSync(candidate)) {
      return resolve(candidate);
    }
  }
  return null;
}

export function resolvePluginPath(name: string) {
  const explicitPath = resolveExplicitPluginPath(name);
  if (explicitPath) {
    return explicitPath;
  }

  for (const dir of pluginDirs()) {
    for (const ext of FILE_CANDIDATES) {
      const candidate = join(dir, `${name}${ext}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

export function listPluginNames() {
  const names = new Set<string>();
  for (const dir of pluginDirs()) {
    if (!existsSync(dir)) {
      continue;
    }
    for (const file of readdirSync(dir)) {
      for (const ext of FILE_CANDIDATES) {
        if (file.endsWith(ext) && file.length > ext.length) {
          names.add(file.slice(0, -ext.length));
        }
      }
    }
  }
  return [...names].sort();
}

export function loadPluginSource(path: string) {
  return readFileSync(path, "utf8");
}

export function parseKeyValueArgs(values?: string[]) {
  const args: Record<string, string> = {};
  for (const item of values ?? []) {
    const index = item.indexOf("=");
    if (index <= 0) {
      throw new Error(`expected key=value, got '${item}'`);
    }
    args[item.slice(0, index)] = item.slice(index + 1);
  }
  return args;
}

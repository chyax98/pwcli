import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

function profileStateDir() {
  return resolve(".pwcli", "profiles", "state");
}

function profileStatePath(name: string) {
  return resolve(profileStateDir(), `${name}.json`);
}

export function resolveProfileStatePath(name: string) {
  return profileStatePath(name);
}

export async function ensureProfileStateDir() {
  await mkdir(profileStateDir(), { recursive: true });
}

export async function listProfileStates() {
  await ensureProfileStateDir();
  const entries = await readdir(profileStateDir(), { withFileTypes: true });
  const profiles = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = resolve(profileStateDir(), entry.name);
    const info = await stat(path);
    profiles.push({
      name: entry.name.replace(/\.json$/, ""),
      path,
      sizeBytes: info.size,
      modifiedAt: info.mtime.toISOString(),
    });
  }
  profiles.sort((a, b) => a.name.localeCompare(b.name));
  return profiles;
}

export async function removeProfileState(name: string) {
  const path = profileStatePath(name);
  await rm(path, { force: true });
  return { name, path, removed: true };
}

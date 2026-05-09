import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

function cacheDir() {
  return resolve(homedir(), ".pwcli", "auth-cache");
}

function cachePath(provider: string, key: string) {
  return resolve(cacheDir(), `${provider}-${key}.json`);
}

function makeCacheKey(parts: Record<string, string>): string {
  const sorted = Object.entries(parts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

export async function loadAuthCache(provider: string, args: Record<string, string>) {
  const path = cachePath(provider, makeCacheKey(args));
  try {
    const text = await readFile(path, "utf8");
    return { path, state: JSON.parse(text), found: true };
  } catch {
    return { path, found: false };
  }
}

export async function saveAuthCache(
  provider: string,
  args: Record<string, string>,
  state: unknown,
) {
  const dir = cacheDir();
  await mkdir(dir, { recursive: true });
  const path = cachePath(provider, makeCacheKey(args));
  await writeFile(path, JSON.stringify(state, null, 2), "utf8");
  return { path, saved: true };
}

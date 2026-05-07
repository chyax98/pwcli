import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ensureRuntimeDir } from "./runtime-dir.js";

type StoredProfile = {
  url: string;
  values: Record<string, string>;
};

function authProfileDir() {
  return resolve(".pwcli", "profiles", "auth");
}

function authProfilePath(name: string) {
  return resolve(authProfileDir(), `${name}.json.enc`);
}

function vaultKey() {
  const raw = process.env.PWCLI_VAULT_KEY?.trim();
  if (!raw) {
    throw new Error("PWCLI_VAULT_KEY is required for auth profile storage");
  }
  return createHash("sha256").update(raw).digest();
}

function encryptJson(value: StoredProfile) {
  const key = vaultKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: body.toString("base64"),
  };
}

function decryptJson(text: string): StoredProfile {
  const payload = JSON.parse(text) as { iv: string; tag: string; ciphertext: string };
  const key = vaultKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const body = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(body.toString("utf8")) as StoredProfile;
}

export async function saveAuthProfile(name: string, profile: StoredProfile) {
  await ensureRuntimeDir();
  await mkdir(authProfileDir(), { recursive: true });
  const path = authProfilePath(name);
  await writeFile(path, JSON.stringify(encryptJson(profile), null, 2), "utf8");
  return { name, path, saved: true, url: profile.url };
}

export async function loadAuthProfile(name: string) {
  const path = authProfilePath(name);
  const text = await readFile(path, "utf8");
  return { name, path, profile: decryptJson(text) };
}

export async function listAuthProfiles() {
  await ensureRuntimeDir();
  await mkdir(authProfileDir(), { recursive: true });
  const entries = await readdir(authProfileDir(), { withFileTypes: true });
  const profiles = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json.enc")) continue;
    const path = resolve(authProfileDir(), entry.name);
    const info = await stat(path);
    profiles.push({
      name: entry.name.replace(/\.json\.enc$/, ""),
      path,
      sizeBytes: info.size,
      modifiedAt: info.mtime.toISOString(),
    });
  }
  profiles.sort((a, b) => a.name.localeCompare(b.name));
  return profiles;
}

export async function removeAuthProfile(name: string) {
  const path = authProfilePath(name);
  await rm(path, { force: true });
  return { name, path, removed: true };
}

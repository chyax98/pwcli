import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export function runtimeDir(baseDir: string = process.cwd(), ...segments: string[]): string {
  return resolve(baseDir, ".pwcli", ...segments);
}

export async function ensureRuntimeDir(baseDir: string = process.cwd()): Promise<void> {
  const dir = resolve(baseDir, ".pwcli");
  await mkdir(dir, { recursive: true });
  const gitignorePath = resolve(dir, ".gitignore");
  try {
    await access(gitignorePath);
  } catch {
    await writeFile(gitignorePath, "*\n", "utf8");
  }
}

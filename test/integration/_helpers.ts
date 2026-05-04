import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export type CliResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  json: unknown;
};

export const repoRoot = resolve(import.meta.dirname, "..", "..");
export const cliPath = resolve(repoRoot, "dist", "cli.js");

export function uniqueSessionName(prefix: string) {
  return `${prefix}${Date.now().toString(36).slice(-5)}`;
}

export async function createWorkspace(prefix: string) {
  return await mkdtemp(join(tmpdir(), prefix));
}

export async function removeWorkspace(path: string) {
  await rm(path, { recursive: true, force: true });
}

export function parseJsonText(text: string) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type RunPwOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
};

export function runPw(args: string[], options: RunPwOptions = {}) {
  return new Promise<CliResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: [options.input ? "pipe" : "ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    if (options.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    }
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolveResult({
        code,
        stdout,
        stderr,
        json: parseJsonText(stdout.trim()),
      });
    });
  });
}

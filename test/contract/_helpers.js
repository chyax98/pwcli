import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

export const repoRoot = resolve(import.meta.dirname, "../..");
export const cliPath = resolve(repoRoot, "dist", "cli.js");

export function uniqueSessionName(prefix) {
  return `${prefix}${Date.now().toString(36).slice(-6)}`;
}

export function dataUrl(html) {
  return `data:text/html,${encodeURIComponent(html)}`;
}

export function runPwSync(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    ...options,
  });
}

export function runPw(args, options = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: [options.input ? "pipe" : "ignore", "pipe", "pipe"],
      ...options,
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
      resolveResult({ code, stdout, stderr });
    });
  });
}

export function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} did not return JSON: ${error.message}\n${text}`);
  }
}

export function parseJsonResult(result, label) {
  return parseJson(result.stdout || result.stderr, label);
}

export function runPwJsonSync(args, options = {}) {
  const result = runPwSync([...args, "--output", "json"], options);
  return { result, data: parseJsonResult(result, args.join(" ")) };
}

export function assertOk(result, label) {
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with status ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }
}

export function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} did not include ${expected}\n${text}`);
  }
}

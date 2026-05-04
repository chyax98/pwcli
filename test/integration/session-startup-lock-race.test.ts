import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type CliResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  json: unknown;
};

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-session-startup-race-"));
const sessionName = `r${Date.now().toString(36).slice(-5)}`;

function runPw(args: string[], extraEnv?: Record<string, string>) {
  return new Promise<CliResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: workspaceDir,
      env: {
        ...process.env,
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const trimmed = stdout.trim();
      let json: unknown = null;
      if (trimmed) {
        try {
          json = JSON.parse(trimmed);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse JSON output for ${args.join(" ")}: ${
                error instanceof Error ? error.message : String(error)
              }\nstdout=${stdout}\nstderr=${stderr}`,
            ),
          );
          return;
        }
      }
      resolveResult({ code, stdout, stderr, json });
    });
  });
}

try {
  const env = {
    PWCLI_SESSION_STARTUP_LOCK_HOLD_MS: "350",
  };

  const [first, second] = await Promise.all([
    runPw(
      ["session", "create", sessionName, "--headless", "--open", "about:blank", "--output", "json"],
      env,
    ),
    runPw(
      ["session", "create", sessionName, "--headless", "--open", "about:blank", "--output", "json"],
      env,
    ),
  ]);

  const results = [first, second];
  const successes = results.filter(
    (result): result is CliResult & { json: { ok: true } } =>
      result.code === 0 &&
      !!result.json &&
      typeof result.json === "object" &&
      (result.json as { ok?: boolean }).ok === true,
  );
  const failures = results.filter(
    (result): result is CliResult & { json: { ok: false; error: { code: string } } } =>
      result.code !== 0 &&
      !!result.json &&
      typeof result.json === "object" &&
      (result.json as { ok?: boolean }).ok === false,
  );

  assert.equal(successes.length, 1, `expected exactly one success, got ${JSON.stringify(results)}`);
  assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(results)}`);
  assert.equal(
    (failures[0].json as { error: { code: string } }).error.code,
    "SESSION_BUSY",
    `expected SESSION_BUSY, got ${JSON.stringify(failures[0])}`,
  );
  assert.ok(
    !failures[0].stdout.includes("EADDRINUSE") && !failures[0].stderr.includes("EADDRINUSE"),
    `raw EADDRINUSE leaked:\nstdout=${failures[0].stdout}\nstderr=${failures[0].stderr}`,
  );

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"]);
  assert.equal(closeResult.code, 0, `session close failed: ${JSON.stringify(closeResult)}`);
} finally {
  await rm(workspaceDir, { recursive: true, force: true });
}

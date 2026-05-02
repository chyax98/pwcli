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

type ErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    recovery?: {
      kind: string;
      commands: string[];
    };
  };
};

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-recovery-envelope-"));

function runPw(args: string[]) {
  return new Promise<CliResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: workspaceDir,
      env: {
        ...process.env,
        NODE_TEST_CONTEXT: undefined,
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
  // Keep the missing session name within the 16-char contract so status reaches SESSION_NOT_FOUND.
  const missingSession = await runPw([
    "session",
    "status",
    "missing-xyz",
    "--output",
    "json",
  ]);
  assert.notEqual(
    missingSession.code,
    0,
    `expected missing session status to fail: ${JSON.stringify(missingSession)}`,
  );
  const missingEnvelope = missingSession.json as ErrorEnvelope;
  assert.equal(missingEnvelope.ok, false);
  assert.equal(missingEnvelope.error.code, "SESSION_NOT_FOUND");
  assert.equal(missingEnvelope.error.recovery?.kind, "inspect");
  assert.ok(
    Array.isArray(missingEnvelope.error.recovery?.commands) &&
      missingEnvelope.error.recovery.commands.length > 0,
    `expected SESSION_NOT_FOUND to include recovery commands: ${JSON.stringify(missingEnvelope)}`,
  );

  const tooLongSession = await runPw([
    "session",
    "create",
    "verylongnamethatisinvalid",
    "--open",
    "about:blank",
    "--output",
    "json",
  ]);
  assert.notEqual(
    tooLongSession.code,
    0,
    `expected long session name to fail: ${JSON.stringify(tooLongSession)}`,
  );
  const tooLongEnvelope = tooLongSession.json as ErrorEnvelope;
  assert.equal(tooLongEnvelope.ok, false);
  assert.equal(tooLongEnvelope.error.code, "SESSION_NAME_TOO_LONG");
  assert.equal(tooLongEnvelope.error.recovery?.kind, "inspect");
} finally {
  await rm(workspaceDir, { recursive: true, force: true });
}

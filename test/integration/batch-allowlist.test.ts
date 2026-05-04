import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-batch-allowlist-"));

function runBatchJson(stdinData: string) {
  return new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
    json: unknown;
  }>((resolveResult, reject) => {
    const child = spawn(
      process.execPath,
      [cliPath, "batch", "--session", "ghost", "--stdin-json", "--output", "json"],
      {
        cwd: workspaceDir,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
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
              `Failed to parse JSON output: ${error instanceof Error ? error.message : String(error)}\nstdout=${stdout}\nstderr=${stderr}`,
            ),
          );
          return;
        }
      }
      resolveResult({ code, stdout, stderr, json });
    });
    child.stdin.write(stdinData);
    child.stdin.end();
  });
}

try {
  const allowedCases: Array<{ label: string; stdin: string; expectedReasonCode: string }> = [
    { label: "fill", stdin: '[["fill","--selector","#x","val"]]', expectedReasonCode: "SESSION_NOT_FOUND" },
    { label: "check", stdin: '[["check","--selector","#x"]]', expectedReasonCode: "SESSION_NOT_FOUND" },
    { label: "select", stdin: '[["select","--selector","#x","opt"]]', expectedReasonCode: "SESSION_NOT_FOUND" },
    { label: "hover", stdin: '[["hover","--selector","#x"]]', expectedReasonCode: "SESSION_NOT_FOUND" },
    { label: "press", stdin: '[["press","Enter"]]', expectedReasonCode: "SESSION_NOT_FOUND" },
    { label: "scroll", stdin: '[["scroll","down","300"]]', expectedReasonCode: "SESSION_NOT_FOUND" },
    { label: "type", stdin: '[["type","--selector","#x","hello"]]', expectedReasonCode: "SESSION_NOT_FOUND" },
  ];

  for (const { label, stdin, expectedReasonCode } of allowedCases) {
    const result = await runBatchJson(stdin);
    assert.notEqual(result.code, 0, `${label}: expected non-zero exit`);
    const envelope = result.json as {
      ok: false;
      error: {
        code: string;
        details?: {
          summary?: {
            firstFailureReasonCode: string | null;
            firstFailedCommand: string | null;
          };
        };
      };
    };
    assert.ok(envelope && !envelope.ok, `${label}: expected error envelope`);
    assert.equal(envelope.error.code, "BATCH_STEP_FAILED", `${label}: expected BATCH_STEP_FAILED`);
    assert.equal(
      envelope.error.details?.summary?.firstFailureReasonCode,
      expectedReasonCode,
      `${label}: expected ${expectedReasonCode}`,
    );
    assert.notEqual(
      envelope.error.details?.summary?.firstFailedCommand,
      null,
      `${label}: expected a failed command`,
    );
  }

  const blockedCases: Array<{ label: string; stdin: string; expectedMessage: string }> = [
    {
      label: "session create",
      stdin: '[["session","create","foo"]]',
      expectedMessage: "batch does not support session lifecycle",
    },
    {
      label: "auth",
      stdin: '[["auth","dc"]]',
      expectedMessage: "batch does not support auth provider execution",
    },
  ];

  for (const { label, stdin, expectedMessage } of blockedCases) {
    const result = await runBatchJson(stdin);
    assert.notEqual(result.code, 0, `${label}: expected non-zero exit`);
    const envelope = result.json as {
      ok: false;
      error: { code: string; message: string };
    };
    assert.ok(envelope && !envelope.ok, `${label}: expected error envelope`);
    assert.equal(envelope.error.code, "BATCH_STEP_FAILED", `${label}: expected BATCH_STEP_FAILED`);
    assert.ok(
      envelope.error.message.includes(expectedMessage),
      `${label}: message '${envelope.error.message}' should include '${expectedMessage}'`,
    );
  }
} finally {
  await rm(workspaceDir, { recursive: true, force: true });
}

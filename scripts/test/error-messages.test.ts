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
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-error-messages-"));

function runPw(args: string[]) {
  return new Promise<CliResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: workspaceDir,
      env: process.env,
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
  // Create a session so that tab select fails with tab-level error (not SESSION_NOT_FOUND).
  const sessionName = `err-${Date.now().toString(36).slice(-4)}`;
  const createResult = await runPw([
    "session",
    "create",
    sessionName,
    "--headless",
    "--open",
    "about:blank",
    "--output",
    "json",
  ]);
  assert.equal(createResult.code, 0, `session create failed: ${JSON.stringify(createResult)}`);

  const tabSelect = await runPw([
    "tab",
    "select",
    "nonexistent-id",
    "--session",
    sessionName,
    "--output",
    "json",
  ]);
  assert.notEqual(tabSelect.code, 0, "tab select should fail");
  const tabEnvelope = tabSelect.json as {
    ok: false;
    error: { code: string; message: string; suggestions?: string[] };
  };
  assert.ok(tabEnvelope && !tabEnvelope.ok);
  assert.ok(
    tabEnvelope.error.suggestions?.some((s) => s.includes("pw page list")),
    `tab select suggestions should include 'pw page list': ${JSON.stringify(tabEnvelope.error.suggestions)}`,
  );

  // Clean up the temporary session.
  await runPw(["session", "close", sessionName, "--output", "json"]);

  const sessionRecreate = await runPw([
    "session",
    "recreate",
    "ghost",
    "--output",
    "json",
  ]);
  assert.notEqual(sessionRecreate.code, 0, "session recreate should fail");
  const recreateEnvelope = sessionRecreate.json as {
    ok: false;
    error: {
      code: string;
      suggestions?: string[];
      recovery?: { kind: string; commands: string[] };
    };
  };
  assert.ok(recreateEnvelope && !recreateEnvelope.ok);
  assert.equal(recreateEnvelope.error.code, "SESSION_NOT_FOUND");
  assert.ok(
    Array.isArray(recreateEnvelope.error.suggestions) &&
      recreateEnvelope.error.suggestions.length > 0,
    `session recreate should have suggestions: ${JSON.stringify(recreateEnvelope.error)}`,
  );

  const code = await runPw([
    "code",
    "while(true){}",
    "--session",
    "ghost",
    "--output",
    "json",
  ]);
  assert.notEqual(code.code, 0, "code should fail");
  const codeEnvelope = code.json as { ok: false; error: { code: string } };
  assert.ok(codeEnvelope && !codeEnvelope.ok);
  assert.equal(codeEnvelope.error.code, "SESSION_NOT_FOUND");

  const mouseClick = await runPw([
    "mouse",
    "click",
    "--x",
    "100",
    "--y",
    "200",
    "--session",
    "ghost",
    "--output",
    "json",
  ]);
  assert.notEqual(mouseClick.code, 0, "mouse click should fail");
  const mouseEnvelope = mouseClick.json as { ok: false; error: { code: string } };
  assert.ok(mouseEnvelope && !mouseEnvelope.ok);
  assert.equal(mouseEnvelope.error.code, "SESSION_NOT_FOUND");

  const videoStart = await runPw([
    "video",
    "start",
    "--session",
    "ghost",
    "--output",
    "json",
  ]);
  assert.notEqual(videoStart.code, 0, "video start should fail");
  const videoEnvelope = videoStart.json as { ok: false; error: { code: string } };
  assert.ok(videoEnvelope && !videoEnvelope.ok);
  assert.equal(videoEnvelope.error.code, "SESSION_NOT_FOUND");

  const accessibility = await runPw([
    "accessibility",
    "--session",
    "ghost",
    "--output",
    "json",
  ]);
  assert.notEqual(accessibility.code, 0, "accessibility should fail");
  const accessibilityEnvelope = accessibility.json as { ok: false; error: { code: string } };
  assert.ok(accessibilityEnvelope && !accessibilityEnvelope.ok);
  assert.equal(accessibilityEnvelope.error.code, "SESSION_NOT_FOUND");

  const harReplay = await runPw([
    "har",
    "replay",
    "/nonexistent.har",
    "--session",
    "ghost",
    "--output",
    "json",
  ]);
  assert.notEqual(harReplay.code, 0, "har replay should fail");
  const harEnvelope = harReplay.json as { ok: false; error: { code: string; message: string } };
  assert.ok(harEnvelope && !harEnvelope.ok);
  // Should be SESSION_NOT_FOUND since session doesn't exist; if it ever changes to file-not-found,
  // the assertion still passes as long as it's one of the expected codes.
  assert.ok(
    harEnvelope.error.code === "SESSION_NOT_FOUND" ||
      harEnvelope.error.message.toLowerCase().includes("file") ||
      harEnvelope.error.message.toLowerCase().includes("exist"),
    `har replay unexpected error: ${JSON.stringify(harEnvelope.error)}`,
  );
} finally {
  await rm(workspaceDir, { recursive: true, force: true });
}

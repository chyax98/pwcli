import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-verify-failure-run-"));
const sessionName = `vf${Date.now().toString(36).slice(-5)}`;
const bundleDir = resolve(workspaceDir, "bundle");
const screenshotPath = resolve(workspaceDir, "before-verify.png");

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
  const html = encodeURIComponent(
    "<!doctype html><title>Verify Failure</title><main>present</main>",
  );
  const create = await runPw([
    "session",
    "create",
    sessionName,
    "--no-headed",
    "--open",
    `data:text/html,${html}`,
    "--output",
    "json",
  ]);
  assert.equal(create.code, 0, `session create failed: ${JSON.stringify(create)}`);

  const screenshot = await runPw([
    "screenshot",
    "--session",
    sessionName,
    "--path",
    screenshotPath,
    "--output",
    "json",
  ]);
  assert.equal(screenshot.code, 0, `screenshot failed: ${JSON.stringify(screenshot)}`);
  assert.equal(existsSync(screenshotPath), true);

  const verify = await runPw([
    "verify",
    "text",
    "--session",
    sessionName,
    "--text",
    "missing-marker",
    "--output",
    "json",
  ]);
  assert.notEqual(verify.code, 0, "verify should fail for missing text");
  const verifyEnvelope = verify.json as {
    ok: boolean;
    error?: { code?: string };
  };
  assert.equal(verifyEnvelope.ok, false);
  assert.equal(verifyEnvelope.error?.code, "VERIFY_FAILED");

  const bundle = await runPw([
    "diagnostics",
    "bundle",
    "--session",
    sessionName,
    "--out",
    bundleDir,
    "--task",
    "verify failure handoff",
    "--output",
    "json",
  ]);
  assert.equal(bundle.code, 0, `diagnostics bundle failed: ${JSON.stringify(bundle)}`);
  assert.equal(existsSync(resolve(bundleDir, "manifest.json")), true);
  assert.equal(existsSync(resolve(bundleDir, "handoff.md")), true);
  const manifest = JSON.parse(await readFile(resolve(bundleDir, "manifest.json"), "utf8")) as {
    schemaVersion?: string;
    session?: string;
    task?: string;
    commands?: string[];
    runIds?: string[];
    artifacts?: Array<{ type?: string; path?: string; sizeBytes?: number }>;
    summary?: {
      status?: string;
      highSignalFindings?: string[];
    };
    auditConclusion?: {
      status?: string;
      failedCommand?: string;
      failureKind?: string;
      failureSummary?: string;
    };
    latestRunEvents?: { events?: Array<{ command?: string; failure?: { code?: string } }> };
  };
  assert.equal(manifest.auditConclusion?.status, "failed_or_risky");
  assert.equal(manifest.auditConclusion?.failedCommand, "verify");
  assert.equal(manifest.auditConclusion?.failureKind, "VERIFY_FAILED");
  assert.equal(manifest.auditConclusion?.failureSummary, "verify text failed");
  assert.ok(
    manifest.latestRunEvents?.events?.some(
      (event) => event.command === "verify" && event.failure?.code === "VERIFY_FAILED",
    ),
    "bundle should include the verify failure run event",
  );
  assert.equal(manifest.schemaVersion, "1.0");
  assert.equal(manifest.session, sessionName);
  assert.equal(manifest.task, "verify failure handoff");
  assert.equal(manifest.summary?.status, "fail");
  assert.ok(manifest.summary?.highSignalFindings?.includes("verify text failed"));
  assert.ok(manifest.commands?.includes("screenshot"));
  assert.ok(manifest.commands?.includes("verify"));
  assert.ok((manifest.runIds?.length ?? 0) >= 2);
  assert.ok(
    manifest.artifacts?.some(
      (artifact) =>
        artifact.type === "screenshot" &&
        artifact.path === screenshotPath &&
        typeof artifact.sizeBytes === "number" &&
        artifact.sizeBytes > 0,
    ),
    "bundle should include screenshot artifact metadata",
  );
  const handoff = await readFile(resolve(bundleDir, "handoff.md"), "utf8");
  assert.ok(handoff.includes("schemaVersion: 1.0"));
  assert.ok(handoff.includes("verify failure handoff"));
  assert.ok(handoff.includes("verify text failed"));

  const close = await runPw(["session", "close", sessionName, "--output", "json"]);
  assert.equal(close.code, 0, `session close failed: ${JSON.stringify(close)}`);
} finally {
  await runPw(["session", "close", sessionName, "--output", "json"]).catch(() => undefined);
  await rm(workspaceDir, { recursive: true, force: true });
}

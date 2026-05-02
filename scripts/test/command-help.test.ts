import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-command-help-"));

function runHelp(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolveResult, reject) => {
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
        resolveResult({ code, stdout, stderr });
      });
    },
  );
}

try {
  const accessibility = await runHelp(["accessibility", "--help"]);
  assert.equal(accessibility.code, 0, `accessibility --help failed: ${accessibility.stderr}`);
  assert.ok(
    accessibility.stdout.includes("--interactive-only"),
    `accessibility --help missing --interactive-only: ${accessibility.stdout}`,
  );
  assert.ok(
    accessibility.stdout.includes("--root"),
    `accessibility --help missing --root: ${accessibility.stdout}`,
  );

  const mouse = await runHelp(["mouse", "--help"]);
  assert.equal(mouse.code, 0, `mouse --help failed: ${mouse.stderr}`);
  assert.ok(mouse.stdout.includes("move"), `mouse --help missing move: ${mouse.stdout}`);
  assert.ok(mouse.stdout.includes("click"), `mouse --help missing click: ${mouse.stdout}`);
  assert.ok(mouse.stdout.includes("wheel"), `mouse --help missing wheel: ${mouse.stdout}`);
  assert.ok(mouse.stdout.includes("drag"), `mouse --help missing drag: ${mouse.stdout}`);

  const video = await runHelp(["video", "--help"]);
  assert.equal(video.code, 0, `video --help failed: ${video.stderr}`);
  assert.ok(video.stdout.includes("start"), `video --help missing start: ${video.stdout}`);
  assert.ok(video.stdout.includes("stop"), `video --help missing stop: ${video.stdout}`);

  const har = await runHelp(["har", "--help"]);
  assert.equal(har.code, 0, `har --help failed: ${har.stderr}`);
  assert.ok(har.stdout.includes("replay"), `har --help missing replay: ${har.stdout}`);

  const network = await runHelp(["network", "--help"]);
  assert.equal(network.code, 0, `network --help failed: ${network.stderr}`);
  assert.ok(
    network.stdout.includes("--include-body"),
    `network --help missing --include-body: ${network.stdout}`,
  );

  const locate = await runHelp(["locate", "--help"]);
  assert.equal(locate.code, 0, `locate --help failed: ${locate.stderr}`);
  assert.ok(
    locate.stdout.includes("--return-ref"),
    `locate --help missing --return-ref: ${locate.stdout}`,
  );

  const get = await runHelp(["get", "--help"]);
  assert.equal(get.code, 0, `get --help failed: ${get.stderr}`);
  assert.ok(get.stdout.includes("--return-ref"), `get --help missing --return-ref: ${get.stdout}`);

  const stateDiff = await runHelp(["state", "diff", "--help"]);
  assert.equal(stateDiff.code, 0, `state diff --help failed: ${stateDiff.stderr}`);
  assert.ok(
    stateDiff.stdout.includes("--include-values"),
    `state diff --help missing --include-values: ${stateDiff.stdout}`,
  );

  // batch --help does not list supported commands, so verify via a failed batch run that exposes
  // the supportedTopLevel list in the error envelope.
  const batch = await runHelp(["batch", "--help"]);
  assert.equal(batch.code, 0, `batch --help failed: ${batch.stderr}`);

  const batchRun = await new Promise<{
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
        } catch {
          // ignore parse failure
        }
      }
      resolveResult({ code, stdout, stderr, json });
    });
    child.stdin.write('[["fill","--selector","#x","val"]]');
    child.stdin.end();
  });

  const batchEnvelope = batchRun.json as {
    ok: false;
    error: {
      details: {
        analysis: { supportedTopLevel: string[] };
      };
    };
  };
  assert.ok(batchEnvelope && !batchEnvelope.ok, "expected batch to fail");
  const supportedTopLevel = batchEnvelope.error.details.analysis.supportedTopLevel;
  assert.ok(supportedTopLevel.includes("fill"), `supportedTopLevel missing fill: ${supportedTopLevel.join(", ")}`);
  assert.ok(supportedTopLevel.includes("check"), `supportedTopLevel missing check: ${supportedTopLevel.join(", ")}`);
  assert.ok(
    supportedTopLevel.includes("select"),
    `supportedTopLevel missing select: ${supportedTopLevel.join(", ")}`,
  );
} finally {
  await rm(workspaceDir, { recursive: true, force: true });
}

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
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-attachable-id-"));
const sourceSessionName = `src${Date.now().toString(36).slice(-5)}`;
const attachedSessionName = `att${Date.now().toString(36).slice(-5)}`;

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
        json = JSON.parse(trimmed);
      }
      resolveResult({ code, stdout, stderr, json });
    });
  });
}

try {
  const createResult = await runPw([
    "session",
    "create",
    sourceSessionName,
    "--headless",
    "--open",
    "about:blank",
    "--output",
    "json",
  ]);
  assert.equal(createResult.code, 0);

  const listResult = await runPw(["session", "list", "--attachable", "--output", "json"]);
  assert.equal(listResult.code, 0, `session list failed: ${listResult.stderr}`);
  const attachableList = listResult.json as {
    data: {
      attachable?: {
        servers: Array<{ id: string; title: string; canConnect: boolean }>;
      };
    };
  };
  const attachableId = attachableList.data.attachable?.servers.find(
    (server) => server.canConnect && server.title === sourceSessionName,
  )?.id;
  assert.ok(attachableId, "expected a connectable attachable server for the source session");

  const attachResult = await runPw([
    "session",
    "attach",
    attachedSessionName,
    "--attachable-id",
    attachableId!,
    "--output",
    "json",
  ]);
  assert.equal(attachResult.code, 0, `session attach failed: ${attachResult.stderr}`);
  const attachJson = attachResult.json as {
    ok: boolean;
    data: { attached: boolean; resolvedVia: string };
  };
  assert.equal(attachJson.ok, true);
  assert.equal(attachJson.data.attached, true);
  assert.equal(attachJson.data.resolvedVia, "attachable-id");

  const statusResult = await runPw(["session", "status", attachedSessionName, "--output", "json"]);
  assert.equal(statusResult.code, 0);
  const statusJson = statusResult.json as { data: { active: boolean } };
  assert.equal(statusJson.data.active, true);

  await runPw(["session", "close", attachedSessionName, "--output", "json"]);
  await runPw(["session", "close", sourceSessionName, "--output", "json"]);
} finally {
  await rm(workspaceDir, { recursive: true, force: true });
}

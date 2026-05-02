import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it, before, after } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");

function runPw(args: string[], cwd?: string) {
  return new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
    json: unknown;
  }>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: cwd ?? repoRoot,
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
        } catch {
          json = null;
        }
      }
      resolveResult({ code, stdout, stderr, json });
    });
  });
}

function makeSessionName() {
  return `it${Date.now().toString().slice(-6)}`;
}

describe("session lifecycle", { concurrency: false }, () => {
  let sessionName: string;
  const sessionsToClean: string[] = [];

  before(() => {
    sessionName = makeSessionName();
  });

  after(async () => {
    for (const name of sessionsToClean) {
      try {
        await runPw(["session", "close", name, "--output", "json"]);
      } catch {
        // ignore
      }
    }
  });

  it("create → status → close happy path", async () => {
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
    assert.equal(createResult.code, 0, `create failed: ${createResult.stderr}`);
    const createJson = createResult.json as Record<string, unknown>;
    assert.equal(createJson.ok, true);
    assert.equal((createJson as { command: string }).command, "session create");
    assert.equal(
      (createJson as { session: { name: string } }).session.name,
      sessionName,
    );
    assert.equal(
      (createJson as { data: { created: boolean } }).data.created,
      true,
    );
    sessionsToClean.push(sessionName);

    const statusResult = await runPw([
      "session",
      "status",
      sessionName,
      "--output",
      "json",
    ]);
    assert.equal(statusResult.code, 0, `status failed: ${statusResult.stderr}`);
    const statusJson = statusResult.json as Record<string, unknown>;
    assert.equal(statusJson.ok, true);
    assert.equal(
      (statusJson as { data: { active: boolean } }).data.active,
      true,
    );
    assert.ok(
      (statusJson as { data: { socketPath: string } }).data.socketPath,
    );
    assert.ok(
      (statusJson as { data: { version: string } }).data.version,
    );

    const closeResult = await runPw([
      "session",
      "close",
      sessionName,
      "--output",
      "json",
    ]);
    assert.equal(closeResult.code, 0, `close failed: ${closeResult.stderr}`);
    const closeJson = closeResult.json as Record<string, unknown>;
    assert.equal(closeJson.ok, true);
    assert.equal(
      (closeJson as { data: { closed: boolean } }).data.closed,
      true,
    );
    sessionsToClean.pop();
  });

  it("duplicate create does not error (reuses/resets session)", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);

    const r1 = await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "about:blank",
      "--output",
      "json",
    ]);
    assert.equal(r1.code, 0);

    const r2 = await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "about:blank",
      "--output",
      "json",
    ]);
    assert.equal(r2.code, 0, `duplicate create failed: ${r2.stderr}`);
    const json = r2.json as Record<string, unknown>;
    assert.equal(json.ok, true);
    assert.equal(
      (json as { data: { created: boolean } }).data.created,
      true,
    );
    // NOTE: pwcli currently does not return SESSION_ALREADY_EXISTS;
    // it silently recreates/resets the session.
  });

  it("recreate makes session available again", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);

    const createResult = await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "about:blank",
      "--output",
      "json",
    ]);
    assert.equal(createResult.code, 0);

    const recreateResult = await runPw([
      "session",
      "recreate",
      name,
      "--output",
      "json",
    ]);
    assert.equal(
      recreateResult.code,
      0,
      `recreate failed: ${recreateResult.stderr}`,
    );
    const recJson = recreateResult.json as Record<string, unknown>;
    assert.equal(recJson.ok, true);
    assert.equal(
      (recJson as { data: { recreated: boolean } }).data.recreated,
      true,
    );

    const statusResult = await runPw([
      "session",
      "status",
      name,
      "--output",
      "json",
    ]);
    assert.equal(statusResult.code, 0);
    const stJson = statusResult.json as Record<string, unknown>;
    assert.equal(stJson.ok, true);
    assert.equal(
      (stJson as { data: { active: boolean } }).data.active,
      true,
    );
  });

  it("list includes newly created session", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);

    await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "about:blank",
      "--output",
      "json",
    ]);

    const listResult = await runPw(["session", "list", "--output", "json"]);
    assert.equal(listResult.code, 0, `list failed: ${listResult.stderr}`);
    const listJson = listResult.json as {
      ok: boolean;
      data: {
        sessions: Array<{ name: string; alive: boolean }>;
      };
    };
    assert.equal(listJson.ok, true);
    const found = listJson.data.sessions.find((s) => s.name === name);
    assert.ok(found, `session ${name} not found in list`);
    assert.equal(found.alive, true);
  });

  it("close --all cleans sessions", async () => {
    const nameA = makeSessionName();
    const nameB = makeSessionName();
    sessionsToClean.push(nameA, nameB);

    await runPw([
      "session",
      "create",
      nameA,
      "--headless",
      "--open",
      "about:blank",
      "--output",
      "json",
    ]);
    await runPw([
      "session",
      "create",
      nameB,
      "--headless",
      "--open",
      "about:blank",
      "--output",
      "json",
    ]);

    const closeResult = await runPw([
      "session",
      "close",
      "--all",
      "--output",
      "json",
    ]);
    assert.equal(closeResult.code, 0, `close --all failed: ${closeResult.stderr}`);
    const closeJson = closeResult.json as {
      ok: boolean;
      data: {
        all: boolean;
        closedCount: number;
        sessions: Array<{ name: string; closed: boolean }>;
      };
    };
    assert.equal(closeJson.ok, true);
    assert.equal(closeJson.data.all, true);
    assert.ok(closeJson.data.closedCount >= 2);
    const closedNames = closeJson.data.sessions
      .filter((s) => s.closed)
      .map((s) => s.name);
    assert.ok(closedNames.includes(nameA), "nameA should be closed");
    assert.ok(closedNames.includes(nameB), "nameB should be closed");

    // Verify individual status returns not-found
    const statusA = await runPw([
      "session",
      "status",
      nameA,
      "--output",
      "json",
    ]);
    assert.equal(statusA.code, 1, "expected status for closed session to fail");
    const stJson = statusA.json as { ok: boolean; error?: { code: string } };
    assert.equal(stJson.ok, false);
    assert.equal(stJson.error?.code, "SESSION_NOT_FOUND");
  });
});

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it, after } from "node:test";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");

function runPw(args: string[]) {
  return new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
    json: unknown;
  }>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
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

describe("mouse", { concurrency: false }, () => {
  const sessionsToClean: string[] = [];

  after(async () => {
    for (const name of sessionsToClean) {
      try {
        await runPw(["session", "close", name, "--output", "json"]);
      } catch {
        // ignore
      }
    }
  });

  it("mouse move executes without error", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);

    await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "https://example.com",
      "--output",
      "json",
    ]);

    const result = await runPw([
      "mouse",
      "move",
      "--x",
      "100",
      "--y",
      "100",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `mouse move failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      command: string;
      session: { name: string };
      data: { x: number; y: number; acted: boolean };
    };
    assert.equal(json.ok, true);
    assert.equal(json.command, "mouse move");
    assert.equal(json.session.name, name);
    assert.equal(json.data.x, 100);
    assert.equal(json.data.y, 100);
    assert.equal(json.data.acted, true);
  });

  it("mouse click executes without error", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);

    await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "https://example.com",
      "--output",
      "json",
    ]);

    const result = await runPw([
      "mouse",
      "click",
      "--x",
      "100",
      "--y",
      "100",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `mouse click failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      command: string;
      session: { name: string };
      data: { x: number; y: number; button: string; acted: boolean };
    };
    assert.equal(json.ok, true);
    assert.equal(json.command, "mouse click");
    assert.equal(json.session.name, name);
    assert.equal(json.data.x, 100);
    assert.equal(json.data.y, 100);
    assert.equal(json.data.button, "left");
    assert.equal(json.data.acted, true);
  });
});

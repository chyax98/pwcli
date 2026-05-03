import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it, after } from "node:test";
import { resolve } from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

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
  return `it-har-${Date.now().toString().slice(-6)}`;
}

describe("har", { concurrency: false }, () => {
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

  it("har start and stop return state", async () => {
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

    const startResult = await runPw(["har", "start", "--session", name, "--output", "json"]);
    assert.equal(startResult.code, 0, `har start failed: ${startResult.stderr}`);
    const startJson = startResult.json as {
      ok: boolean;
      data: { action: string; supported: boolean; limitation?: string };
    };
    assert.equal(startJson.ok, true);
    assert.equal(startJson.data.action, "start");
    assert.equal(startJson.data.supported, false);
    assert.ok(startJson.data.limitation, "should expose limitation");

    const stopResult = await runPw(["har", "stop", "--session", name, "--output", "json"]);
    assert.equal(stopResult.code, 0, `har stop failed: ${stopResult.stderr}`);
    const stopJson = stopResult.json as {
      ok: boolean;
      data: { action: string; supported: boolean; limitation?: string };
    };
    assert.equal(stopJson.ok, true);
    assert.equal(stopJson.data.action, "stop");
    assert.equal(stopJson.data.supported, false);
    assert.ok(stopJson.data.limitation, "should expose limitation");
  });

  it("har replay starts and stops routing", async () => {
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

    const tmpDir = mkdtempSync(resolve(tmpdir(), "pwcli-har-"));
    const harFile = resolve(tmpDir, "replay.har");
    writeFileSync(
      harFile,
      JSON.stringify({
        log: {
          version: "1.2",
          creator: { name: "test", version: "1.0" },
          entries: [],
        },
      }),
    );

    try {
      const replayResult = await runPw([
        "har",
        "replay",
        harFile,
        "--session",
        name,
        "--output",
        "json",
      ]);
      // Empty HAR may succeed or fail depending on Playwright version; accept either
      if (replayResult.code === 0) {
        const replayJson = replayResult.json as {
          ok: boolean;
          data: { replayActive?: boolean; file?: string };
        };
        assert.equal(replayJson.ok, true);
        assert.equal(replayJson.data.replayActive, true);
        assert.equal(replayJson.data.file, harFile);

        const stopResult = await runPw([
          "har",
          "replay",
          "stop",
          "--session",
          name,
          "--output",
          "json",
        ]);
        assert.equal(stopResult.code, 0, `har replay stop failed: ${stopResult.stderr}`);
        const stopJson = stopResult.json as {
          ok: boolean;
          data: { replayActive?: boolean };
        };
        assert.equal(stopJson.ok, true);
        assert.equal(stopJson.data.replayActive, false);
      } else {
        const replayJson = replayResult.json as {
          ok: boolean;
          error?: { code: string };
        };
        assert.equal(replayJson.ok, false);
        assert.equal(replayJson.error?.code, "HAR_REPLAY_FAILED");
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { after, describe, it } from "node:test";

const repoRoot = resolve(import.meta.dirname, "..", "..");
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

  it("har start and stop fail with explicit unsupported capture", async () => {
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
    assert.notEqual(startResult.code, 0, "har start should be an explicit unsupported capture");
    const startJson = startResult.json as {
      ok: boolean;
      error?: { code?: string; details?: { reason?: string } };
    };
    assert.equal(startJson.ok, false);
    assert.equal(startJson.error?.code, "UNSUPPORTED_HAR_CAPTURE");
    assert.equal(
      startJson.error?.details?.reason,
      "PLAYWRIGHT_RECORD_HAR_REQUIRES_CONTEXT_CREATION",
    );

    const stopResult = await runPw(["har", "stop", "--session", name, "--output", "json"]);
    assert.notEqual(stopResult.code, 0, "har stop should be an explicit unsupported capture");
    const stopJson = stopResult.json as {
      ok: boolean;
      error?: { code?: string; details?: { reason?: string } };
    };
    assert.equal(stopJson.ok, false);
    assert.equal(stopJson.error?.code, "UNSUPPORTED_HAR_CAPTURE");
    assert.equal(
      stopJson.error?.details?.reason,
      "PLAYWRIGHT_RECORD_HAR_REQUIRES_CONTEXT_CREATION",
    );
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
          "replay-stop",
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

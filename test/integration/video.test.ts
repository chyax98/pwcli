import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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
  return `it-video-${Date.now().toString().slice(-6)}`;
}

describe("video", { concurrency: false }, () => {
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

  it("video start and stop returns video path", async () => {
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

    const startResult = await runPw(["video", "start", "--session", name, "--output", "json"]);
    assert.equal(startResult.code, 0, `video start failed: ${startResult.stderr}`);
    const startJson = startResult.json as {
      ok: boolean;
      data: { started: boolean };
    };
    assert.equal(startJson.ok, true);
    assert.equal(startJson.data.started, true);

    await runPw(["open", "https://example.com", "--session", name, "--output", "json"]);

    const stopResult = await runPw(["video", "stop", "--session", name, "--output", "json"]);
    assert.equal(stopResult.code, 0, `video stop failed: ${stopResult.stderr}`);
    const stopJson = stopResult.json as {
      ok: boolean;
      data: { stopped: boolean; videoPath?: string; noVideo?: boolean };
    };
    assert.equal(stopJson.ok, true);
    assert.equal(stopJson.data.stopped, true);

    if (stopJson.data.videoPath) {
      const fullPath = resolve(repoRoot, stopJson.data.videoPath);
      assert.ok(existsSync(fullPath), `video file should exist at ${fullPath}`);
    } else {
      assert.equal(stopJson.data.noVideo, true, "should indicate no video when path absent");
    }
  });
});

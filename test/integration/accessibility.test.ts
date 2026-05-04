import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
  return `it-a11y-${Date.now().toString().slice(-6)}`;
}

describe("accessibility", { concurrency: false }, () => {
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

  it("basic accessibility returns ARIA YAML", async () => {
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

    await runPw([
      "code",
      "--session",
      name,
      'async page => { await page.setContent(`<button>Click me</button><a href="#">Link</a>`); }',
      "--output",
      "json",
    ]);

    const result = await runPw(["accessibility", "--session", name, "--output", "json"]);
    assert.equal(result.code, 0, `accessibility failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { format: string; empty: boolean; snapshot: string };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.format, "aria-yaml");
    assert.equal(json.data.empty, false);
    assert.ok(json.data.snapshot.includes('button "Click me"'), "snapshot should contain button");
    assert.ok(json.data.snapshot.includes('link "Link"'), "snapshot should contain link");
  });

  it("--interactive-only returns only interactive nodes", async () => {
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

    await runPw([
      "code",
      "--session",
      name,
      "async page => { await page.setContent(`<button>Click me</button><p>Static text</p>`); }",
      "--output",
      "json",
    ]);

    const result = await runPw([
      "accessibility",
      "--session",
      name,
      "--interactive-only",
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `accessibility --interactive-only failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { format: string; empty: boolean; snapshot: string };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.format, "aria-yaml");
    assert.equal(json.data.empty, false);
    assert.ok(json.data.snapshot.includes('button "Click me"'), "snapshot should contain button");
  });

  it("empty page returns empty snapshot", async () => {
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

    const result = await runPw(["accessibility", "--session", name, "--output", "json"]);
    assert.equal(result.code, 0, `accessibility empty page failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { format: string; empty: boolean; snapshot: string };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.format, "aria-yaml");
    assert.equal(json.data.empty, true);
    assert.equal(json.data.snapshot, "");
  });
});

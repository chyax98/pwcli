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

describe("diagnostics", { concurrency: false }, () => {
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

  it("console returns summary after opening a page", async () => {
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
      "console",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `console failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { summary: { total: number; sample: unknown[] } };
    };
    assert.equal(json.ok, true);
    assert.ok(typeof json.data.summary.total === "number");
    assert.ok(Array.isArray(json.data.summary.sample));
  });

  it("network shows request records", async () => {
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
      "network",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `network failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        summary: {
          total: number;
          sample: Array<{ kind: string; url: string; method: string }>;
        };
      };
    };
    assert.equal(json.ok, true);
    assert.ok(json.data.summary.total > 0, "expected at least one network record");
    assert.ok(json.data.summary.sample.length > 0);
    assert.ok(json.data.summary.sample[0].kind);
    assert.ok(json.data.summary.sample[0].url);
  });

  it("errors recent returns empty when no errors", async () => {
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
      "errors",
      "recent",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `errors failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        action: string;
        summary: { total: number; visible: number; matched: number };
        errors: unknown[];
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.action, "recent");
    assert.equal(json.data.summary.total, 0);
    assert.ok(Array.isArray(json.data.errors));
  });

  it("diagnostics digest --session returns structure", async () => {
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
      "diagnostics",
      "digest",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `digest failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        source: string;
        summary: {
          pageCount: number;
          consoleErrorCount: number;
          failedRequestCount: number;
        };
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.source, "session");
    assert.ok(typeof json.data.summary.pageCount === "number");
    assert.ok(typeof json.data.summary.consoleErrorCount === "number");
    assert.ok(typeof json.data.summary.failedRequestCount === "number");
  });

  it("doctor --session returns health info", async () => {
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

    const result = await runPw([
      "doctor",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `doctor failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      diagnostics: Array<{
        kind: string;
        status: string;
        summary: string;
        details?: unknown;
      }>;
    };
    assert.equal(json.ok, true);
    assert.ok(Array.isArray(json.diagnostics));
    const envDiag = json.diagnostics.find((d) => d.kind === "environment");
    const sessionDiag = json.diagnostics.find((d) => d.kind === "session-substrate");
    assert.ok(envDiag, "expected environment diagnostic");
    assert.ok(sessionDiag, "expected session-substrate diagnostic");
    assert.ok(["ok", "warn", "error"].includes(envDiag.status));
    assert.ok(["ok", "warn", "error"].includes(sessionDiag.status));
  });

  it("doctor without session returns environment pre-check", async () => {
    const result = await runPw(["doctor", "--output", "json"]);
    assert.equal(result.code, 0, `doctor failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      diagnostics: Array<{
        kind: string;
        status: string;
        summary: string;
        details?: { items?: Array<{ label: string; status: string; detail?: string }> };
      }>;
    };
    assert.equal(json.ok, true);
    assert.ok(Array.isArray(json.diagnostics));
    const envDiag = json.diagnostics.find((d) => d.kind === "environment");
    assert.ok(envDiag, "expected environment diagnostic");
    assert.ok(envDiag.details?.items?.some((i) => i.label.includes("Node")) || envDiag.details?.items?.some((i) => i.label.includes("Playwright")));
  });
});

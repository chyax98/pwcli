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
  return `it-net-${Date.now().toString().slice(-6)}`;
}

describe("network --include-body", { concurrency: false }, () => {
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

  it("default network does not include full body fields", async () => {
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

    const result = await runPw(["network", "--session", name, "--output", "json"]);
    assert.equal(result.code, 0, `network failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        summary: {
          sample: Array<{
            requestBody?: unknown;
            responseBody?: unknown;
            responseBodySnippet?: string;
          }>;
        };
      };
    };
    assert.equal(json.ok, true);
    const responseRecord = json.data.summary.sample.find(
      (r) => r.responseBodySnippet !== undefined,
    );
    assert.ok(responseRecord, "should have a response record");
    assert.equal(responseRecord.requestBody, undefined, "default should not include requestBody");
    assert.equal(responseRecord.responseBody, undefined, "default should not include responseBody");
    assert.ok(responseRecord.responseBodySnippet, "should have snippet");
  });

  it("--include-body returns requestBody and responseBody", async () => {
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
      "--include-body",
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `network --include-body failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        summary: {
          sample: Array<{
            requestBody?: string;
            responseBody?: string;
            responseBodyTruncated?: boolean;
            responseBodySnippet?: string;
          }>;
        };
      };
    };
    assert.equal(json.ok, true);
    const responseRecord = json.data.summary.sample.find(
      (r) => r.responseBodySnippet !== undefined,
    );
    assert.ok(responseRecord, "should have a response record");
    assert.ok(
      typeof responseRecord.responseBody === "string",
      "should include responseBody string",
    );
    assert.ok(
      responseRecord.responseBody.length > responseRecord.responseBodySnippet?.length,
      "responseBody should be longer than snippet",
    );
  });
});

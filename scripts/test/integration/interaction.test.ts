import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it, after } from "node:test";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");

function runPw(args: string[], input?: string) {
  return new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
    json: unknown;
  }>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: [input ? "pipe" : "ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
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

describe("interaction", { concurrency: false }, () => {
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

  it("fill writes into a form field", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);

    await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "https://httpbin.org/forms/post",
      "--output",
      "json",
    ]);

    const result = await runPw([
      "fill",
      "--selector",
      'input[name="custname"]',
      "Test User",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `fill failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { filled: boolean; value: string };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.filled, true);
    assert.equal(json.data.value, "Test User");
  });

  it("select chooses an option value", async () => {
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
      'async page => { await page.setContent(\'<select id=\\"s\\"><option value=\\"a\\">A</option><option value=\\"b\\">B</option></select>\'); }',
      "--output",
      "json",
    ]);

    const result = await runPw([
      "select",
      "--selector",
      "#s",
      "b",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `select failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { selected: boolean; values: string[] };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.selected, true);
    assert.deepEqual(json.data.values, ["b"]);
  });

  it("check checks a checkbox", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);

    await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "https://httpbin.org/forms/post",
      "--output",
      "json",
    ]);

    const result = await runPw([
      "check",
      "--selector",
      'input[value="bacon"]',
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `check failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { checked: boolean; acted: boolean };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.checked, true);
    assert.equal(json.data.acted, true);
  });

  it("uncheck unchecks a checkbox", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);

    await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "https://httpbin.org/forms/post",
      "--output",
      "json",
    ]);

    // First check it
    await runPw([
      "check",
      "--selector",
      'input[value="bacon"]',
      "--session",
      name,
      "--output",
      "json",
    ]);

    // Then uncheck
    const result = await runPw([
      "uncheck",
      "--selector",
      'input[value="bacon"]',
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `uncheck failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { checked: boolean; acted: boolean };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.checked, false);
    assert.equal(json.data.acted, true);
  });

  it("click submits a form button", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);

    await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "https://httpbin.org/forms/post",
      "--output",
      "json",
    ]);

    const result = await runPw([
      "click",
      "--text",
      "Submit order",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `click failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { acted: boolean };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.acted, true);
  });

  it("locate --selector finds elements", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);

    await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "https://httpbin.org/forms/post",
      "--output",
      "json",
    ]);

    const result = await runPw([
      "locate",
      "--selector",
      'input[name="custname"]',
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `locate failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { count: number; candidates: Array<{ tagName: string; visible: boolean; role: string }> };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.count, 1);
    assert.equal(json.data.candidates[0].tagName, "input");
    assert.equal(json.data.candidates[0].visible, true);
    assert.equal(json.data.candidates[0].role, "textbox");
  });

  it("get text reads element text", async () => {
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
      "get",
      "text",
      "--selector",
      "h1",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `get text failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { fact: string; value: string; count: number };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.fact, "text");
    assert.equal(json.data.value, "Example Domain");
    assert.equal(json.data.count, 1);
  });

  it("batch executes fill and click", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);

    await runPw([
      "session",
      "create",
      name,
      "--headless",
      "--open",
      "https://httpbin.org/forms/post",
      "--output",
      "json",
    ]);

    const batchInput = JSON.stringify([
      ["fill", "--selector", 'input[name="custname"]', "Batch User"],
      ["click", "--text", "Submit order"],
    ]);

    const result = await runPw(
      [
        "batch",
        "--session",
        name,
        "--stdin-json",
        "--include-results",
        "--output",
        "json",
      ],
      batchInput,
    );
    assert.equal(result.code, 0, `batch failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        completed: boolean;
        results: Array<{
          ok: boolean;
          step: string;
          data: { filled?: boolean; acted?: boolean };
        }>;
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.completed, true);
    assert.equal(json.data.results.length, 2);
    assert.equal(json.data.results[0].ok, true);
    assert.ok(json.data.results[0].step.startsWith("fill"));
    assert.equal(json.data.results[0].data.data.filled, true);
    assert.equal(json.data.results[1].ok, true);
    assert.ok(json.data.results[1].step.startsWith("click"));
    assert.equal(json.data.results[1].data.data.acted, true);
  });
});

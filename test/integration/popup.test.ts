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

describe("popup", { concurrency: false }, () => {
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

  it("click on target=_blank link opens popup and page list contains it", async () => {
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

    // Inject a link with target="_blank"
    await runPw([
      "code",
      "--session",
      name,
      'async page => { await page.setContent(\'<a id=\\"pop\\" href=\\"about:blank\\" target=\\"_blank\\">open</a>\'); }',
      "--output",
      "json",
    ]);

    // Click the link
    const clickResult = await runPw([
      "click",
      "--selector",
      "#pop",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(clickResult.code, 0, `click failed: ${clickResult.stderr}`);
    const clickJson = clickResult.json as {
      ok: boolean;
      data: {
        acted: boolean;
        openedPage: { pageId: string; url: string } | null;
      };
    };
    assert.equal(clickJson.ok, true);
    assert.equal(clickJson.data.acted, true);
    assert.ok(clickJson.data.openedPage, "expected openedPage to be present");
    assert.ok(clickJson.data.openedPage.pageId.startsWith("p"));

    // Verify page list contains the new page
    const listResult = await runPw([
      "page",
      "list",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(listResult.code, 0, `page list failed: ${listResult.stderr}`);
    const listJson = listResult.json as {
      ok: boolean;
      data: {
        pageCount: number;
        pages: Array<{ pageId: string; openerPageId: string | null }>;
      };
    };
    assert.equal(listJson.ok, true);
    assert.equal(listJson.data.pageCount, 2);
    const popupPage = listJson.data.pages.find(
      (p) => p.pageId === clickJson.data.openedPage.pageId,
    );
    assert.ok(popupPage, "popup page should appear in page list");
    assert.equal(popupPage.openerPageId, "p1");
  });
});

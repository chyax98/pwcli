import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, describe, it } from "node:test";
import { runPw, uniqueSessionName } from "./_helpers.ts";

const makeSessionName = () => uniqueSessionName("it");

describe("page reading", { concurrency: false }, () => {
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

  it("observe status returns current page url", async () => {
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

    const result = await runPw(["observe", "status", "--session", name, "--output", "json"]);
    assert.equal(result.code, 0, `observe failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      page: { url: string; title: string };
      data: {
        summary: { pageCount: number };
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.page.url, "https://example.com/");
    assert.equal(json.page.title, "Example Domain");
    assert.equal(json.data.summary.pageCount, 1);
  });

  it("read-text returns non-empty text containing Example Domain", async () => {
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

    const result = await runPw(["read-text", "--session", name, "--output", "json"]);
    assert.equal(result.code, 0, `read-text failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { text: string; charCount: number; truncated: boolean };
    };
    assert.equal(json.ok, true);
    assert.ok(json.data.text.includes("Example Domain"));
    assert.ok(json.data.charCount > 0);
    assert.equal(json.data.truncated, false);
  });

  it("text alias returns the read-text envelope", async () => {
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
      "async page => { await page.setContent(`<main><h1>Alias Marker</h1><p>Visible alias text.</p></main>`); }",
      "--output",
      "json",
    ]);

    const result = await runPw(["text", "--session", name, "--output", "json"]);
    assert.equal(result.code, 0, `text alias failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      command: string;
      data: { text: string; charCount: number };
    };
    assert.equal(json.ok, true);
    assert.equal(json.command, "read-text");
    assert.ok(json.data.text.includes("Visible alias text."));
    assert.ok(json.data.charCount > 0);
  });

  it("snapshot returns non-empty structure", async () => {
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

    const result = await runPw(["snapshot", "--session", name, "--output", "json"]);
    assert.equal(result.code, 0, `snapshot failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { mode: string; snapshot: string };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.mode, "ai");
    assert.ok(json.data.snapshot.length > 0);
    assert.ok(json.data.snapshot.includes("Example Domain"));
  });

  it("snapshot status returns a single JSON envelope", async () => {
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
      'async page => { await page.setContent(`<button type="button">Stable Action</button>`); }',
      "--output",
      "json",
    ]);

    const snapshotResult = await runPw(["snapshot", "-i", "--session", name, "--output", "json"]);
    assert.equal(snapshotResult.code, 0, `snapshot failed: ${snapshotResult.stderr}`);

    const result = await runPw(["snapshot", "status", "--session", name, "--output", "json"]);
    assert.equal(result.code, 0, `snapshot status failed: ${result.stderr}`);
    const json = JSON.parse(result.stdout.trim()) as {
      ok: boolean;
      command: string;
      data: { status: string; refCount: number };
    };
    assert.equal(json.ok, true);
    assert.equal(json.command, "snapshot status");
    assert.equal(json.data.status, "fresh");
    assert.ok(json.data.refCount > 0);
  });

  it("locate --return-ref returns refs for checked controls", async () => {
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
      'async page => { await page.setContent(`<label><input type="checkbox" checked />Remember me</label>`); }',
      "--output",
      "json",
    ]);

    const result = await runPw([
      "locate",
      "--session",
      name,
      "--text",
      "Remember me",
      "--return-ref",
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `locate --return-ref failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { ref?: string; candidates: Array<{ text: string }> };
    };
    assert.equal(json.ok, true);
    assert.ok(json.data.candidates.some((candidate) => candidate.text.includes("Remember me")));
    assert.match(json.data.ref ?? "", /^e\d+$/);
  });

  it("page current returns pageId and url", async () => {
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

    const result = await runPw(["page", "current", "--session", name, "--output", "json"]);
    assert.equal(result.code, 0, `page current failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        activePageId: string;
        pageCount: number;
        currentPage: { pageId: string; url: string };
      };
    };
    assert.equal(json.ok, true);
    assert.ok(json.data.activePageId.startsWith("p"));
    assert.equal(json.data.pageCount, 1);
    assert.equal(json.data.currentPage.pageId, json.data.activePageId);
    assert.equal(json.data.currentPage.url, "https://example.com/");
  });

  it("tab select and close use stable pageId", async () => {
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
      'async page => { await page.setContent(`<a id="pop" href="about:blank" target="_blank">Open Tab</a>`); }',
      "--output",
      "json",
    ]);

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
      data: { openedPage: { pageId: string } | null };
    };
    assert.equal(clickJson.ok, true);
    const pageId = clickJson.data.openedPage?.pageId;
    assert.match(pageId ?? "", /^p\d+$/);

    const selectResult = await runPw([
      "tab",
      "select",
      pageId ?? "",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(selectResult.code, 0, `tab select failed: ${selectResult.stderr}`);
    const selectJson = selectResult.json as {
      ok: boolean;
      data: { selected: boolean; activePageId: string };
    };
    assert.equal(selectJson.ok, true);
    assert.equal(selectJson.data.selected, true);
    assert.equal(selectJson.data.activePageId, pageId);

    const closeResult = await runPw([
      "tab",
      "close",
      pageId ?? "",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(closeResult.code, 0, `tab close failed: ${closeResult.stderr}`);
    const closeJson = closeResult.json as {
      ok: boolean;
      data: { closed: boolean; closedPageId: string; activePageId: string; pageCount: number };
    };
    assert.equal(closeJson.ok, true);
    assert.equal(closeJson.data.closed, true);
    assert.equal(closeJson.data.closedPageId, pageId);
    assert.equal(closeJson.data.activePageId, "p1");
    assert.equal(closeJson.data.pageCount, 1);
  });

  it("accessibility returns ARIA tree with role field", async () => {
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
      'async page => { await page.setContent(`<main><h1>Accessible Demo</h1><button>Submit Order</button><a href="/help">Help</a></main>`); }',
      "--output",
      "json",
    ]);

    const result = await runPw(["accessibility", "--session", name, "--output", "json"]);
    assert.equal(result.code, 0, `accessibility failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { format: string; snapshot: string; empty: boolean };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.format, "aria-yaml");
    assert.equal(json.data.empty, false);
    assert.match(json.data.snapshot, /heading "Accessible Demo"/);
    assert.match(json.data.snapshot, /button "Submit Order"/);
    assert.match(json.data.snapshot, /link "Help"/);
  });

  it("screenshot generates file", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    const screenshotPath = `/tmp/pwcli-it-screenshot-${Date.now()}.png`;

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
      "screenshot",
      "--session",
      name,
      "--path",
      screenshotPath,
      "--output",
      "json",
    ]);
    assert.equal(result.code, 0, `screenshot failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { path: string; captured: boolean };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.captured, true);
    assert.equal(json.data.path, screenshotPath);
    assert.ok(existsSync(screenshotPath), "screenshot file should exist");
  });

  it("pdf generates file", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    const pdfPath = `/tmp/pwcli-it-pdf-${Date.now()}.pdf`;

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
      "async page => { await page.setContent(`<main><h1>PDF Marker</h1><p>Document evidence.</p></main>`); }",
      "--output",
      "json",
    ]);

    const result = await runPw(["pdf", "--session", name, "--path", pdfPath, "--output", "json"]);
    assert.equal(result.code, 0, `pdf failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { path: string; saved: boolean };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.saved, true);
    assert.equal(json.data.path, pdfPath);
    assert.ok(existsSync(pdfPath), "pdf file should exist");
  });
});

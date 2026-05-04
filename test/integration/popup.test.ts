import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { runPw, uniqueSessionName } from "./_helpers.ts";

const makeSessionName = () => uniqueSessionName("it");

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
    const listResult = await runPw(["page", "list", "--session", name, "--output", "json"]);
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

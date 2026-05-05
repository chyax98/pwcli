import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { runPw, uniqueSessionName } from "./_helpers.ts";

const makeSessionName = () => uniqueSessionName("it-state-");

describe("state checks", { concurrency: false }, () => {
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

  it("locate, get, is, verify, and wait provide read-only workflow facts", async () => {
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
      `async page => {
        await page.setContent(\`
          <main>
            <h1>State Marker</h1>
            <button id="ready">Ready Button</button>
            <label><input id="agree" type="checkbox" checked>Agree</label>
            <div id="hidden-target" style="display:none">Hidden marker</div>
          </main>
        \`);
      }`,
      "--output",
      "json",
    ]);

    const locate = await runPw([
      "locate",
      "--selector",
      "#ready",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(locate.code, 0, `locate failed: ${locate.stderr}`);
    const locateJson = locate.json as { ok: boolean; data: { count: number } };
    assert.equal(locateJson.ok, true);
    assert.equal(locateJson.data.count, 1);

    const get = await runPw([
      "get",
      "text",
      "--selector",
      "h1",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(get.code, 0, `get failed: ${get.stderr}`);
    const getJson = get.json as { ok: boolean; data: { fact: string; value: string } };
    assert.equal(getJson.ok, true);
    assert.equal(getJson.data.fact, "text");
    assert.equal(getJson.data.value, "State Marker");

    const isVisible = await runPw([
      "is",
      "visible",
      "--selector",
      "#ready",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(isVisible.code, 0, `is visible failed: ${isVisible.stderr}`);
    const isVisibleJson = isVisible.json as {
      ok: boolean;
      data: { state: string; value: boolean };
    };
    assert.equal(isVisibleJson.ok, true);
    assert.equal(isVisibleJson.data.state, "visible");
    assert.equal(isVisibleJson.data.value, true);

    const isChecked = await runPw([
      "is",
      "checked",
      "--selector",
      "#agree",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(isChecked.code, 0, `is checked failed: ${isChecked.stderr}`);
    const isCheckedJson = isChecked.json as {
      ok: boolean;
      data: { state: string; value: boolean };
    };
    assert.equal(isCheckedJson.ok, true);
    assert.equal(isCheckedJson.data.state, "checked");
    assert.equal(isCheckedJson.data.value, true);

    const verify = await runPw([
      "verify",
      "text",
      "--text",
      "State Marker",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(verify.code, 0, `verify failed: ${verify.stderr}`);
    const verifyJson = verify.json as { ok: boolean; data: { passed: boolean } };
    assert.equal(verifyJson.ok, true);
    assert.equal(verifyJson.data.passed, true);

    const wait = await runPw([
      "wait",
      "--selector",
      "#hidden-target",
      "--state",
      "hidden",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(wait.code, 0, `wait failed: ${wait.stderr}`);
    const waitJson = wait.json as { ok: boolean; data: { matched: boolean } };
    assert.equal(waitJson.ok, true);
    assert.equal(waitJson.data.matched, true);
  });
});

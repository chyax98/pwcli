import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { after, describe, it } from "node:test";
import { runPw, uniqueSessionName } from "./_helpers.ts";

const makeSessionName = () => uniqueSessionName("it");

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

  it("wait --state hidden honors selector state", async () => {
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
      'async page => { await page.setContent(\'<div id="hidden-target" style="display:none">Hidden</div>\'); }',
      "--output",
      "json",
    ]);

    const result = await runPw([
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
    assert.equal(result.code, 0, `wait hidden failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: { matched: boolean; condition: { kind: string; selector: string; state: string } };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.matched, true);
    assert.equal(json.data.condition.kind, "selector");
    assert.equal(json.data.condition.selector, "#hidden-target");
    assert.equal(json.data.condition.state, "hidden");
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

  it("direct action commands cover keyboard, pointer, viewport, file, drag, and download flows", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    const uploadPath = `/tmp/pwcli-it-upload-${Date.now()}.txt`;
    const downloadPath = `/tmp/pwcli-it-download-${Date.now()}.txt`;
    await writeFile(uploadPath, "upload marker", "utf8");

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
          <style>
            body { height: 2200px; }
            #hoverTarget:hover + #hoverState { color: rgb(255, 0, 0); }
            #dragSource, #dropTarget { width: 80px; height: 40px; margin: 8px; border: 1px solid #333; }
          </style>
          <input id="i" value="">
          <button id="hoverTarget">Hover me</button><span id="hoverState">hover state</span>
          <div id="dragSource" draggable="true">Drag</div>
          <div id="dropTarget">Drop</div>
          <input id="file" type="file">
          <a id="download" download="sample.txt" href="data:text/plain,sample-download">Download</a>
        \`);
      }`,
      "--output",
      "json",
    ]);

    const typeResult = await runPw([
      "type",
      "--selector",
      "#i",
      "abc",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(typeResult.code, 0, `type failed: ${typeResult.stderr}`);
    const typeJson = typeResult.json as { ok: boolean; data: { typed: boolean; value: string } };
    assert.equal(typeJson.ok, true);
    assert.equal(typeJson.data.typed, true);
    assert.equal(typeJson.data.value, "abc");

    const pressResult = await runPw(["press", "Enter", "--session", name, "--output", "json"]);
    assert.equal(pressResult.code, 0, `press failed: ${pressResult.stderr}`);
    const pressJson = pressResult.json as { ok: boolean; data: { pressed: boolean; key: string } };
    assert.equal(pressJson.ok, true);
    assert.equal(pressJson.data.pressed, true);
    assert.equal(pressJson.data.key, "Enter");

    const hoverResult = await runPw([
      "hover",
      "--selector",
      "#hoverTarget",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(hoverResult.code, 0, `hover failed: ${hoverResult.stderr}`);
    const hoverJson = hoverResult.json as { ok: boolean; data: { acted: boolean } };
    assert.equal(hoverJson.ok, true);
    assert.equal(hoverJson.data.acted, true);

    const scrollResult = await runPw([
      "scroll",
      "down",
      "300",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(scrollResult.code, 0, `scroll failed: ${scrollResult.stderr}`);
    const scrollJson = scrollResult.json as {
      ok: boolean;
      data: { scrolled: boolean; direction: string };
    };
    assert.equal(scrollJson.ok, true);
    assert.equal(scrollJson.data.scrolled, true);
    assert.equal(scrollJson.data.direction, "down");

    const resizeResult = await runPw([
      "resize",
      "--width",
      "800",
      "--height",
      "600",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(resizeResult.code, 0, `resize failed: ${resizeResult.stderr}`);
    const resizeJson = resizeResult.json as {
      ok: boolean;
      data: { resized: boolean; width: number; height: number };
    };
    assert.equal(resizeJson.ok, true);
    assert.equal(resizeJson.data.resized, true);
    assert.equal(resizeJson.data.width, 800);
    assert.equal(resizeJson.data.height, 600);

    const uploadResult = await runPw([
      "upload",
      "--selector",
      "#file",
      uploadPath,
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(uploadResult.code, 0, `upload failed: ${uploadResult.stderr}`);
    const uploadJson = uploadResult.json as {
      ok: boolean;
      data: { uploaded: boolean; settle: { fileCount: number; settled: boolean } };
    };
    assert.equal(uploadJson.ok, true);
    assert.equal(uploadJson.data.uploaded, true);
    assert.equal(uploadJson.data.settle.fileCount, 1);
    assert.equal(uploadJson.data.settle.settled, true);

    const dragResult = await runPw([
      "drag",
      "--from-selector",
      "#dragSource",
      "--to-selector",
      "#dropTarget",
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(dragResult.code, 0, `drag failed: ${dragResult.stderr}`);
    const dragJson = dragResult.json as { ok: boolean; data: { dragged: boolean } };
    assert.equal(dragJson.ok, true);
    assert.equal(dragJson.data.dragged, true);

    const downloadResult = await runPw([
      "download",
      "--selector",
      "#download",
      "--path",
      downloadPath,
      "--session",
      name,
      "--output",
      "json",
    ]);
    assert.equal(downloadResult.code, 0, `download failed: ${downloadResult.stderr}`);
    const downloadJson = downloadResult.json as {
      ok: boolean;
      data: { downloaded: boolean; savedAs: string };
    };
    assert.equal(downloadJson.ok, true);
    assert.equal(downloadJson.data.downloaded, true);
    assert.equal(downloadJson.data.savedAs, downloadPath);
    assert.ok(existsSync(downloadPath), "download file should exist");
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
      data: {
        count: number;
        candidates: Array<{ tagName: string; visible: boolean; role: string }>;
      };
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
      ["batch", "--session", name, "--stdin-json", "--include-results", "--output", "json"],
      { input: batchInput },
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

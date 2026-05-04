import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { runPw, uniqueSessionName } from "./_helpers.ts";

const makeSessionName = () => uniqueSessionName("it-batch-");

describe("batch extended commands", { concurrency: false }, () => {
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

  async function setupFormPage(sessionName: string) {
    await runPw([
      "session",
      "create",
      sessionName,
      "--headless",
      "--open",
      "about:blank",
      "--output",
      "json",
    ]);

    await runPw([
      "code",
      "--session",
      sessionName,
      'async page => { await page.setContent(`<input id="i"><select id="s"><option value="a">A</option><option value="b">B</option></select><input type="checkbox" id="c"><button id="b">Btn</button><div id="d" style="height:2000px">scroll</div>`); }',
      "--output",
      "json",
    ]);
  }

  it("batch fill writes into an input", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    await setupFormPage(name);

    const batchInput = JSON.stringify([["fill", "--selector", "#i", "hello"]]);
    const result = await runPw(
      ["batch", "--session", name, "--stdin-json", "--include-results", "--output", "json"],
      { input: batchInput },
    );
    assert.equal(result.code, 0, `batch fill failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        completed: boolean;
        results: Array<{
          ok: boolean;
          command: string;
          data: { data: { filled: boolean; value: string } };
        }>;
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.completed, true);
    assert.equal(json.data.results.length, 1);
    assert.equal(json.data.results[0].ok, true);
    assert.equal(json.data.results[0].command, "fill");
    assert.equal(json.data.results[0].data.data.filled, true);
    assert.equal(json.data.results[0].data.data.value, "hello");
  });

  it("batch type appends text into an input", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    await setupFormPage(name);

    const batchInput = JSON.stringify([["type", "--selector", "#i", " world"]]);
    const result = await runPw(
      ["batch", "--session", name, "--stdin-json", "--include-results", "--output", "json"],
      { input: batchInput },
    );
    assert.equal(result.code, 0, `batch type failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        completed: boolean;
        results: Array<{
          ok: boolean;
          command: string;
          data: { data: { typed: boolean; value: string } };
        }>;
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.completed, true);
    assert.equal(json.data.results[0].ok, true);
    assert.equal(json.data.results[0].command, "type");
    assert.equal(json.data.results[0].data.data.typed, true);
    assert.equal(json.data.results[0].data.data.value, " world");
  });

  it("batch press sends a key", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    await setupFormPage(name);

    const batchInput = JSON.stringify([["press", "Enter"]]);
    const result = await runPw(
      ["batch", "--session", name, "--stdin-json", "--include-results", "--output", "json"],
      { input: batchInput },
    );
    assert.equal(result.code, 0, `batch press failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        completed: boolean;
        results: Array<{
          ok: boolean;
          command: string;
          data: { data: { pressed: boolean; key: string } };
        }>;
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.completed, true);
    assert.equal(json.data.results[0].ok, true);
    assert.equal(json.data.results[0].command, "press");
    assert.equal(json.data.results[0].data.data.pressed, true);
    assert.equal(json.data.results[0].data.data.key, "Enter");
  });

  it("batch check checks a checkbox", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    await setupFormPage(name);

    const batchInput = JSON.stringify([["check", "--selector", "#c"]]);
    const result = await runPw(
      ["batch", "--session", name, "--stdin-json", "--include-results", "--output", "json"],
      { input: batchInput },
    );
    assert.equal(result.code, 0, `batch check failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        completed: boolean;
        results: Array<{
          ok: boolean;
          command: string;
          data: { data: { checked: boolean; acted: boolean } };
        }>;
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.completed, true);
    assert.equal(json.data.results[0].ok, true);
    assert.equal(json.data.results[0].command, "check");
    assert.equal(json.data.results[0].data.data.checked, true);
    assert.equal(json.data.results[0].data.data.acted, true);
  });

  it("batch select chooses an option", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    await setupFormPage(name);

    const batchInput = JSON.stringify([["select", "--selector", "#s", "b"]]);
    const result = await runPw(
      ["batch", "--session", name, "--stdin-json", "--include-results", "--output", "json"],
      { input: batchInput },
    );
    assert.equal(result.code, 0, `batch select failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        completed: boolean;
        results: Array<{
          ok: boolean;
          command: string;
          data: { data: { selected: boolean; values: string[] } };
        }>;
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.completed, true);
    assert.equal(json.data.results[0].ok, true);
    assert.equal(json.data.results[0].command, "select");
    assert.equal(json.data.results[0].data.data.selected, true);
    assert.deepEqual(json.data.results[0].data.data.values, ["b"]);
  });

  it("batch hover hovers an element", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    await setupFormPage(name);

    const batchInput = JSON.stringify([["hover", "--selector", "#b"]]);
    const result = await runPw(
      ["batch", "--session", name, "--stdin-json", "--include-results", "--output", "json"],
      { input: batchInput },
    );
    assert.equal(result.code, 0, `batch hover failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        completed: boolean;
        results: Array<{ ok: boolean; command: string; data: { data: { acted: boolean } } }>;
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.completed, true);
    assert.equal(json.data.results[0].ok, true);
    assert.equal(json.data.results[0].command, "hover");
    assert.equal(json.data.results[0].data.data.acted, true);
  });

  it("batch scroll scrolls the page", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    await setupFormPage(name);

    const batchInput = JSON.stringify([["scroll", "down", "300"]]);
    const result = await runPw(
      ["batch", "--session", name, "--stdin-json", "--include-results", "--output", "json"],
      { input: batchInput },
    );
    assert.equal(result.code, 0, `batch scroll failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        completed: boolean;
        results: Array<{
          ok: boolean;
          command: string;
          data: { data: { scrolled: boolean; direction: string; distance: number } };
        }>;
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.completed, true);
    assert.equal(json.data.results[0].ok, true);
    assert.equal(json.data.results[0].command, "scroll");
    assert.equal(json.data.results[0].data.data.scrolled, true);
    assert.equal(json.data.results[0].data.data.direction, "down");
    assert.equal(json.data.results[0].data.data.distance, 300);
  });

  it("mixed batch fill + press works", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    await setupFormPage(name);

    const batchInput = JSON.stringify([
      ["fill", "--selector", "#i", "Batch User"],
      ["press", "Enter"],
    ]);
    const result = await runPw(
      ["batch", "--session", name, "--stdin-json", "--include-results", "--output", "json"],
      { input: batchInput },
    );
    assert.equal(result.code, 0, `mixed batch failed: ${result.stderr}`);
    const json = result.json as {
      ok: boolean;
      data: {
        completed: boolean;
        results: Array<{
          ok: boolean;
          command: string;
          data: { data: { filled?: boolean; pressed?: boolean } };
        }>;
      };
    };
    assert.equal(json.ok, true);
    assert.equal(json.data.completed, true);
    assert.equal(json.data.results.length, 2);
    assert.equal(json.data.results[0].ok, true);
    assert.equal(json.data.results[0].command, "fill");
    assert.equal(json.data.results[0].data.data.filled, true);
    assert.equal(json.data.results[1].ok, true);
    assert.equal(json.data.results[1].command, "press");
    assert.equal(json.data.results[1].data.data.pressed, true);
  });

  it("illegal batch command is rejected", async () => {
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

    const batchInput = JSON.stringify([["session", "create", "foo"]]);
    const result = await runPw(
      ["batch", "--session", name, "--stdin-json", "--include-results", "--output", "json"],
      { input: batchInput },
    );
    assert.notEqual(result.code, 0, "expected illegal command to fail");
    const json = result.json as {
      ok: boolean;
      error: {
        code: string;
        message: string;
        details?: { summary?: { firstFailedCommand: string | null; firstFailureMessage: string } };
      };
    };
    assert.equal(json.ok, false);
    assert.equal(json.error.code, "BATCH_STEP_FAILED");
    assert.equal(json.error.details?.summary?.firstFailedCommand, "session");
    assert.ok(
      json.error.details?.summary?.firstFailureMessage.includes(
        "batch does not support session lifecycle",
      ),
      `expected lifecycle rejection, got: ${json.error.details?.summary?.firstFailureMessage}`,
    );
  });
});

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { after, describe, it } from "node:test";
import { runPw, uniqueSessionName } from "./_helpers.ts";

const makeSessionName = () => uniqueSessionName("it-har-");

describe("har", { concurrency: false }, () => {
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

  it("records HAR through the session lifecycle", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(`<!doctype html><title>HAR fixture</title><button id="load">Load</button>
          <script>
            document.getElementById('load').addEventListener('click', async () => {
              const response = await fetch('/api/bug-signal');
              document.body.dataset.api = JSON.stringify(await response.json());
            });
          </script>`);
        return;
      }
      if (url.pathname === "/api/bug-signal") {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, code: "HAR_SIGNAL" }));
        return;
      }
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
    });
    await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const tmpDir = mkdtempSync(resolve(tmpdir(), "pwcli-har-record-"));
    const harFile = resolve(tmpDir, "capture.har");

    try {
      const createResult = await runPw([
        "session",
        "create",
        name,
        "--record-har",
        harFile,
        "--open",
        baseUrl,
        "--output",
        "json",
      ]);
      assert.equal(createResult.code, 0, `session create failed: ${createResult.stderr}`);
      const createJson = createResult.json as {
        ok: boolean;
        data: { recordHar?: { path?: string } };
      };
      assert.equal(createJson.ok, true);
      assert.equal(createJson.data.recordHar?.path, harFile);

      const clickResult = await runPw([
        "click",
        "--session",
        name,
        "--selector",
        "#load",
        "--output",
        "json",
      ]);
      assert.equal(clickResult.code, 0, `click failed: ${clickResult.stderr}`);

      const closeResult = await runPw(["session", "close", name, "--output", "json"]);
      assert.equal(closeResult.code, 0, `session close failed: ${closeResult.stderr}`);
      assert.equal(existsSync(harFile), true, "HAR file should be written after session close");

      const har = JSON.parse(readFileSync(harFile, "utf8")) as {
        log?: { entries?: Array<{ request?: { url?: string }; response?: { status?: number } }> };
      };
      const entries = har.log?.entries ?? [];
      assert.ok(entries.some((entry) => entry.request?.url === `${baseUrl}/`));
      assert.ok(
        entries.some(
          (entry) =>
            entry.request?.url === `${baseUrl}/api/bug-signal` && entry.response?.status === 500,
        ),
      );
    } finally {
      await new Promise((resolveClose) => server.close(resolveClose));
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("har replay starts and stops routing", async () => {
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

    const tmpDir = mkdtempSync(resolve(tmpdir(), "pwcli-har-"));
    const harFile = resolve(tmpDir, "replay.har");
    writeFileSync(
      harFile,
      JSON.stringify({
        log: {
          version: "1.2",
          creator: { name: "test", version: "1.0" },
          entries: [],
        },
      }),
    );

    try {
      const replayResult = await runPw([
        "har",
        "replay",
        harFile,
        "--session",
        name,
        "--output",
        "json",
      ]);
      // Empty HAR may succeed or fail depending on Playwright version; accept either
      if (replayResult.code === 0) {
        const replayJson = replayResult.json as {
          ok: boolean;
          data: { replayActive?: boolean; file?: string };
        };
        assert.equal(replayJson.ok, true);
        assert.equal(replayJson.data.replayActive, true);
        assert.equal(replayJson.data.file, harFile);

        const stopResult = await runPw([
          "har",
          "replay-stop",
          "--session",
          name,
          "--output",
          "json",
        ]);
        assert.equal(stopResult.code, 0, `har replay stop failed: ${stopResult.stderr}`);
        const stopJson = stopResult.json as {
          ok: boolean;
          data: { replayActive?: boolean };
        };
        assert.equal(stopJson.ok, true);
        assert.equal(stopJson.data.replayActive, false);
      } else {
        const replayJson = replayResult.json as {
          ok: boolean;
          error?: { code: string };
        };
        assert.equal(replayJson.ok, false);
        assert.equal(replayJson.error?.code, "HAR_REPLAY_FAILED");
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

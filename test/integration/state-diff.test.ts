import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-state-diff-");
const sessionName = uniqueSessionName("diff");
const beforePath = resolve(workspaceDir, "before.json");
const afterPath = resolve(workspaceDir, "after.json");
const valueBeforePath = resolve(workspaceDir, "value-before.json");
const valueChangedPath = resolve(workspaceDir, "value-changed.json");

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><title>State Diff Fixture</title><main>state-diff</main>`);
});

await new Promise<void>((resolveStart) => {
  server.listen(0, "127.0.0.1", () => resolveStart());
});

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("failed to bind state diff fixture");
}
const startUrl = `http://127.0.0.1:${address.port}/`;

try {
  const createResult = await runPw(
    ["session", "create", sessionName, "--headless", "--open", startUrl, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(createResult.code, 0, `session create failed: ${JSON.stringify(createResult)}`);

  const baselineResult = await runPw(
    ["state", "diff", "--session", sessionName, "--before", beforePath, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(baselineResult.code, 0, `baseline diff failed: ${JSON.stringify(baselineResult)}`);
  const baselineEnvelope = baselineResult.json as {
    ok: boolean;
    data: { baselineCreated: boolean; beforePath: string };
  };
  assert.equal(baselineEnvelope.ok, true);
  assert.equal(baselineEnvelope.data.baselineCreated, true);
  await stat(beforePath);

  const mutateResult = await runPw(
    [
      "code",
      "--session",
      sessionName,
      `async page => {
      await page.evaluate(() => {
        document.cookie = 'session_id=next; path=/';
        localStorage.setItem('featureFlag', 'enabled');
        sessionStorage.setItem('workspaceId', 'wk_123');
      });
      await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
          const request = indexedDB.open('app-db', 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('sessions'))
              db.createObjectStore('sessions', { keyPath: 'id' });
          };
          request.onerror = () => reject(request.error ?? new Error('open failed'));
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('sessions', 'readwrite');
            tx.objectStore('sessions').put({ id: 'current-session', userId: 'u_123' });
            tx.oncomplete = () => {
              db.close();
              resolve(undefined);
            };
            tx.onerror = () => reject(tx.error ?? new Error('tx failed'));
          };
        });
      });
      return { mutated: true };
    }`,
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(mutateResult.code, 0, `mutation failed: ${JSON.stringify(mutateResult)}`);

  const diffResult = await runPw(
    [
      "state",
      "diff",
      "--session",
      sessionName,
      "--before",
      beforePath,
      "--after",
      afterPath,
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(diffResult.code, 0, `state diff failed: ${JSON.stringify(diffResult)}`);

  const diffEnvelope = diffResult.json as {
    ok: boolean;
    data: {
      summary: {
        changed: boolean;
        changedBuckets: string[];
        beforeSource: string;
        afterSource: string;
      };
      cookies: { added: Array<{ name: string }> };
      localStorage: { added: string[] };
      sessionStorage: { added: string[] };
      indexeddb: {
        databasesAdded: string[];
        storesChanged: Array<{ database: string; store: string }>;
      };
    };
  };
  assert.equal(diffEnvelope.ok, true);
  assert.equal(diffEnvelope.data.summary.changed, true);
  assert.ok(diffEnvelope.data.summary.changedBuckets.includes("cookies"));
  assert.ok(diffEnvelope.data.summary.changedBuckets.includes("localStorage"));
  assert.ok(diffEnvelope.data.summary.changedBuckets.includes("sessionStorage"));
  assert.ok(diffEnvelope.data.summary.changedBuckets.includes("indexeddb"));
  assert.equal(diffEnvelope.data.summary.beforeSource, beforePath);
  assert.equal(diffEnvelope.data.summary.afterSource, afterPath);
  assert.ok(diffEnvelope.data.cookies.added.some((entry) => entry.name === "session_id"));
  assert.ok(diffEnvelope.data.localStorage.added.includes("featureFlag"));
  assert.ok(diffEnvelope.data.sessionStorage.added.includes("workspaceId"));
  assert.ok(
    diffEnvelope.data.indexeddb.databasesAdded.includes("app-db") ||
      diffEnvelope.data.indexeddb.storesChanged.some(
        (entry) => entry.database === "app-db" && entry.store === "sessions",
      ),
  );
  await stat(afterPath);

  const compareSavedResult = await runPw(
    ["state", "diff", "--before", beforePath, "--after", afterPath, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(
    compareSavedResult.code,
    0,
    `saved snapshot diff failed: ${JSON.stringify(compareSavedResult)}`,
  );
  const compareEnvelope = compareSavedResult.json as {
    ok: boolean;
    data: { summary: { changed: boolean; changedBuckets: string[] } };
  };
  assert.equal(compareEnvelope.ok, true);
  assert.equal(compareEnvelope.data.summary.changed, true);
  assert.ok(compareEnvelope.data.summary.changedBuckets.includes("indexeddb"));

  const valueBaselineResult = await runPw(
    [
      "state",
      "diff",
      "--session",
      sessionName,
      "--before",
      valueBeforePath,
      "--include-values",
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(
    valueBaselineResult.code,
    0,
    `value baseline failed: ${JSON.stringify(valueBaselineResult)}`,
  );
  const valueBaselineEnvelope = valueBaselineResult.json as {
    ok: boolean;
    data: { baselineCreated: boolean };
  };
  assert.equal(valueBaselineEnvelope.ok, true);
  assert.equal(valueBaselineEnvelope.data.baselineCreated, true);
  await stat(valueBeforePath);

  const mutateValuesResult = await runPw(
    [
      "code",
      "--session",
      sessionName,
      `async page => {
      await page.evaluate(() => {
        document.cookie = 'session_id=changed; path=/';
        localStorage.setItem('featureFlag', 'disabled');
        sessionStorage.setItem('workspaceId', 'wk_456');
      });
      return { valuesChanged: true };
    }`,
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(
    mutateValuesResult.code,
    0,
    `value mutation failed: ${JSON.stringify(mutateValuesResult)}`,
  );

  const valueDiffResult = await runPw(
    [
      "state",
      "diff",
      "--session",
      sessionName,
      "--before",
      valueBeforePath,
      "--after",
      valueChangedPath,
      "--include-values",
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(valueDiffResult.code, 0, `value diff failed: ${JSON.stringify(valueDiffResult)}`);
  const valueDiffEnvelope = valueDiffResult.json as {
    ok: boolean;
    data: {
      summary: { changed: boolean; changedBuckets: string[] };
      cookies: { changed: Array<{ name: string; changedFields: string[] }> };
      localStorage: { changed: Array<{ key: string; before?: string; after?: string }> };
      sessionStorage: { changed: Array<{ key: string; before?: string; after?: string }> };
    };
  };
  assert.equal(valueDiffEnvelope.ok, true);
  assert.equal(valueDiffEnvelope.data.summary.changed, true);
  assert.ok(valueDiffEnvelope.data.summary.changedBuckets.includes("cookies"));
  assert.ok(valueDiffEnvelope.data.summary.changedBuckets.includes("localStorage"));
  assert.ok(valueDiffEnvelope.data.summary.changedBuckets.includes("sessionStorage"));
  assert.ok(
    valueDiffEnvelope.data.cookies.changed.some(
      (entry) => entry.name === "session_id" && entry.changedFields.includes("value"),
    ),
  );
  assert.ok(
    valueDiffEnvelope.data.localStorage.changed.some(
      (entry) =>
        entry.key === "featureFlag" && entry.before === "enabled" && entry.after === "disabled",
    ),
  );
  assert.ok(
    valueDiffEnvelope.data.sessionStorage.changed.some(
      (entry) =>
        entry.key === "workspaceId" && entry.before === "wk_123" && entry.after === "wk_456",
    ),
  );
  await stat(valueChangedPath);

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(closeResult.code, 0, `session close failed: ${JSON.stringify(closeResult)}`);

  const savedBaseline = JSON.parse(await readFile(beforePath, "utf8")) as { version: number };
  const savedAfter = JSON.parse(await readFile(afterPath, "utf8")) as { version: number };
  assert.equal(savedBaseline.version, 1);
  assert.equal(savedAfter.version, 1);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolveClose();
    });
  });
  await removeWorkspace(workspaceDir);
}

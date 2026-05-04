import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-storage-indexeddb-");
const sessionName = uniqueSessionName("idb");

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><title>pwcli indexeddb fixture</title><main>indexeddb</main>`);
});

await new Promise<void>((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve());
});

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("failed to bind fixture server");
}
const startUrl = `http://127.0.0.1:${address.port}/`;

const seedScript = `async page => {
  return await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('app-db', 3);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('sessions')) {
          const store = database.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
        }
      };
      request.onerror = () => reject(request.error || new Error('open failed'));
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');
      store.put({ id: 'current-session', userId: 'u-123', featureFlags: ['alpha'], nested: { ready: true } });
      store.put({ id: 'backup-session', userId: 'u-999', featureFlags: ['beta'], nested: { ready: false } });
      tx.oncomplete = () => resolve(null);
      tx.onerror = () => reject(tx.error || new Error('seed failed'));
      tx.onabort = () => reject(tx.error || new Error('seed aborted'));
    });
    db.close();
    return { seeded: true };
  });
}`;

try {
  const createResult = await runPw(
    ["session", "create", sessionName, "--headless", "--open", startUrl, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(createResult.code, 0, `session create failed: ${JSON.stringify(createResult)}`);

  const seedResult = await runPw(
    ["code", seedScript, "--session", sessionName, "--output", "json"],
    {
      cwd: workspaceDir,
    },
  );
  assert.equal(seedResult.code, 0, `seed code failed: ${JSON.stringify(seedResult)}`);

  const exportResult = await runPw(
    [
      "storage",
      "indexeddb",
      "export",
      "--session",
      sessionName,
      "--database",
      "app-db",
      "--store",
      "sessions",
      "--limit",
      "1",
      "--include-records",
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(exportResult.code, 0, `indexeddb export failed: ${JSON.stringify(exportResult)}`);

  const envelope = exportResult.json as {
    ok: boolean;
    data: {
      origin: string;
      databaseCount: number;
      databases: Array<{
        name: string;
        version: number;
        stores: Array<{
          name: string;
          indexNames: string[];
          countEstimate: number;
          sampledRecords?: Array<{ preview: Record<string, unknown> }>;
        }>;
      }>;
    };
  };

  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.origin, startUrl.slice(0, -1));
  assert.equal(envelope.data.databaseCount, 1);
  assert.equal(envelope.data.databases.length, 1);
  assert.equal(envelope.data.databases[0]?.name, "app-db");
  assert.equal(envelope.data.databases[0]?.version, 3);
  assert.equal(envelope.data.databases[0]?.stores.length, 1);
  assert.equal(envelope.data.databases[0]?.stores[0]?.name, "sessions");
  assert.deepEqual(envelope.data.databases[0]?.stores[0]?.indexNames, ["userId"]);
  assert.equal(envelope.data.databases[0]?.stores[0]?.countEstimate, 2);
  assert.equal(envelope.data.databases[0]?.stores[0]?.sampledRecords?.length, 1);
  assert.equal(
    envelope.data.databases[0]?.stores[0]?.sampledRecords?.[0]?.preview.id,
    "backup-session",
  );

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(closeResult.code, 0, `session close failed: ${JSON.stringify(closeResult)}`);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  await removeWorkspace(workspaceDir);
}

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, describe, it } from "node:test";
import { runPw, uniqueSessionName } from "./_helpers.ts";

const makeSessionName = () => uniqueSessionName("it-store-");

describe("storage and cookies", { concurrency: false }, () => {
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

  it("reads and mutates localStorage, sessionStorage, and cookies on an explicit origin", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>Storage Cookie Fixture</title><main>storage</main>");
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const name = makeSessionName();
    sessionsToClean.push(name);

    try {
      await runPw(["session", "create", name, "--headless", "--open", baseUrl, "--output", "json"]);

      const localSet = await runPw([
        "storage",
        "local",
        "set",
        "token",
        "local-value",
        "--session",
        name,
        "--output",
        "json",
      ]);
      assert.equal(localSet.code, 0, `storage local set failed: ${localSet.stderr}`);
      const localSetJson = localSet.json as {
        ok: boolean;
        data: { kind: string; operation: string; value: string; changed: boolean };
      };
      assert.equal(localSetJson.ok, true);
      assert.equal(localSetJson.data.kind, "local");
      assert.equal(localSetJson.data.operation, "set");
      assert.equal(localSetJson.data.value, "local-value");
      assert.equal(localSetJson.data.changed, true);

      const localRead = await runPw(["storage", "local", "--session", name, "--output", "json"]);
      assert.equal(localRead.code, 0, `storage local read failed: ${localRead.stderr}`);
      const localReadJson = localRead.json as {
        ok: boolean;
        data: { accessible: boolean; entries: Record<string, string> };
      };
      assert.equal(localReadJson.ok, true);
      assert.equal(localReadJson.data.accessible, true);
      assert.equal(localReadJson.data.entries.token, "local-value");

      const sessionSet = await runPw([
        "storage",
        "session",
        "set",
        "nonce",
        "session-value",
        "--session",
        name,
        "--output",
        "json",
      ]);
      assert.equal(sessionSet.code, 0, `storage session set failed: ${sessionSet.stderr}`);
      const sessionRead = await runPw([
        "storage",
        "session",
        "--session",
        name,
        "--output",
        "json",
      ]);
      assert.equal(sessionRead.code, 0, `storage session read failed: ${sessionRead.stderr}`);
      const sessionReadJson = sessionRead.json as {
        ok: boolean;
        data: { accessible: boolean; entries: Record<string, string> };
      };
      assert.equal(sessionReadJson.ok, true);
      assert.equal(sessionReadJson.data.accessible, true);
      assert.equal(sessionReadJson.data.entries.nonce, "session-value");

      const localDelete = await runPw([
        "storage",
        "local",
        "delete",
        "token",
        "--session",
        name,
        "--output",
        "json",
      ]);
      assert.equal(localDelete.code, 0, `storage local delete failed: ${localDelete.stderr}`);
      const localDeleteJson = localDelete.json as {
        ok: boolean;
        data: { operation: string; deleted: boolean };
      };
      assert.equal(localDeleteJson.ok, true);
      assert.equal(localDeleteJson.data.operation, "delete");
      assert.equal(localDeleteJson.data.deleted, true);

      const cookieSet = await runPw([
        "cookies",
        "set",
        "pwcli_cookie",
        "cookie-value",
        "--domain",
        "127.0.0.1",
        "--session",
        name,
        "--output",
        "json",
      ]);
      assert.equal(cookieSet.code, 0, `cookies set failed: ${cookieSet.stderr}`);
      const cookieSetJson = cookieSet.json as {
        ok: boolean;
        data: { set: boolean; cookie: { name: string; value: string } | null };
      };
      assert.equal(cookieSetJson.ok, true);
      assert.equal(cookieSetJson.data.set, true);
      assert.equal(cookieSetJson.data.cookie?.name, "pwcli_cookie");
      assert.equal(cookieSetJson.data.cookie?.value, "cookie-value");

      const cookieList = await runPw([
        "cookies",
        "list",
        "--domain",
        "127.0.0.1",
        "--session",
        name,
        "--output",
        "json",
      ]);
      assert.equal(cookieList.code, 0, `cookies list failed: ${cookieList.stderr}`);
      const cookieListJson = cookieList.json as {
        ok: boolean;
        data: { count: number; cookies: Array<{ name: string; value: string }> };
      };
      assert.equal(cookieListJson.ok, true);
      assert.ok(cookieListJson.data.count >= 1);
      assert.ok(
        cookieListJson.data.cookies.some(
          (cookie) => cookie.name === "pwcli_cookie" && cookie.value === "cookie-value",
        ),
      );

      const cookieDelete = await runPw([
        "cookies",
        "delete",
        "pwcli_cookie",
        "--domain",
        "127.0.0.1",
        "--session",
        name,
        "--output",
        "json",
      ]);
      assert.equal(cookieDelete.code, 0, `cookies delete failed: ${cookieDelete.stderr}`);
      const cookieDeleteJson = cookieDelete.json as {
        ok: boolean;
        data: { deleted: boolean; matchedCount: number; remainingCount: number };
      };
      assert.equal(cookieDeleteJson.ok, true);
      assert.equal(cookieDeleteJson.data.deleted, true);
      assert.equal(cookieDeleteJson.data.matchedCount, 1);
      assert.equal(cookieDeleteJson.data.remainingCount, 0);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});

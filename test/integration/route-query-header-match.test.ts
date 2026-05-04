import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-route-match-");
const sessionName = uniqueSessionName("route");

const server = createServer((request, response) => {
  if (request.url === "/page") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html><head><title>Route Match Fixture</title></head>
      <body>
        <main><div id="status">idle</div><button id="trigger">Start fetch</button></main>
        <script>
          document.querySelector('#trigger').addEventListener('click', async () => {
            const response = await fetch('/api/items?tenant=alpha', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-tenant': 'alpha',
              },
              body: JSON.stringify({ tenant: 'alpha' }),
            });
            document.querySelector('#status').textContent = await response.text();
          });
        </script>
      </body></html>`);
    return;
  }
  if (request.url?.startsWith("/api/items")) {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ source: "fallback" }));
    return;
  }
  response.writeHead(404).end("not found");
});

await new Promise<void>((resolveStart) => server.listen(0, "127.0.0.1", () => resolveStart()));
const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("failed to bind fixture server");
}
const pageUrl = `http://127.0.0.1:${address.port}/page`;
const mergeHeadersPath = resolve(workspaceDir, "merge-headers.json");
const matchQueryPath = resolve(workspaceDir, "match-query.json");
const matchHeadersPath = resolve(workspaceDir, "match-headers.json");
const matchJsonPath = resolve(workspaceDir, "match-json.json");
const patchTextPath = resolve(workspaceDir, "patch-text.json");

await writeFile(mergeHeadersPath, JSON.stringify({ "x-from-test": "yes" }, null, 2), "utf8");
await writeFile(matchQueryPath, JSON.stringify({ tenant: "alpha" }, null, 2), "utf8");
await writeFile(matchHeadersPath, JSON.stringify({ "x-tenant": "alpha" }, null, 2), "utf8");
await writeFile(matchJsonPath, JSON.stringify({ tenant: "alpha" }, null, 2), "utf8");
await writeFile(patchTextPath, JSON.stringify({ fallback: "mocked" }, null, 2), "utf8");

try {
  const createResult = await runPw(
    ["session", "create", sessionName, "--headless", "--open", pageUrl, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(createResult.code, 0);

  const routeResult = await runPw(
    [
      "route",
      "add",
      "**/api/items**",
      "--session",
      sessionName,
      "--method",
      "POST",
      "--match-query-file",
      matchQueryPath,
      "--match-headers-file",
      matchHeadersPath,
      "--match-json-file",
      matchJsonPath,
      "--patch-status",
      "201",
      "--merge-headers-file",
      mergeHeadersPath,
      "--patch-text-file",
      patchTextPath,
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(routeResult.code, 0, `route add failed: ${routeResult.stderr}`);
  const listResult = await runPw(["route", "list", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(listResult.code, 0);
  const routeList = listResult.json as {
    data: {
      routes: Array<{
        pattern: string;
        matchQuery?: Record<string, string>;
        matchHeaders?: Record<string, string>;
        matchJson?: Record<string, string>;
        mergeHeaders?: Record<string, string>;
        patchText?: Record<string, string>;
      }>;
    };
  };
  assert.equal(routeList.data.routes.length, 1);
  assert.deepEqual(routeList.data.routes[0]?.matchQuery, { tenant: "alpha" });
  assert.deepEqual(routeList.data.routes[0]?.matchHeaders, { "x-tenant": "alpha" });
  assert.deepEqual(routeList.data.routes[0]?.matchJson, { tenant: "alpha" });
  assert.deepEqual(routeList.data.routes[0]?.mergeHeaders, { "x-from-test": "yes" });
  assert.deepEqual(routeList.data.routes[0]?.patchText, { fallback: "mocked" });

  const clickResult = await runPw(
    ["click", "--session", sessionName, "--selector", "#trigger", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(clickResult.code, 0, `click failed: ${clickResult.stderr}\n${clickResult.stdout}`);

  const waitResult = await runPw(
    ["wait", "--session", sessionName, "--text", "mocked", "--output", "json"],
    {
      cwd: workspaceDir,
    },
  );
  assert.equal(waitResult.code, 0, `wait failed: ${waitResult.stderr}\n${waitResult.stdout}`);

  const statusResult = await runPw(["session", "status", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(statusResult.code, 0);
  assert.equal((statusResult.json as { data: { active: boolean } }).data.active, true);

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(closeResult.code, 0);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  await removeWorkspace(workspaceDir);
}

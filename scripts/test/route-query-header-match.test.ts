import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type CliResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  json: unknown;
};

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-route-match-"));
const sessionName = `route${Date.now().toString(36).slice(-5)}`;

function runPw(args: string[]) {
  return new Promise<CliResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: workspaceDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const trimmed = stdout.trim();
      let json: unknown = null;
      if (trimmed) {
        json = JSON.parse(trimmed);
      }
      resolveResult({ code, stdout, stderr, json });
    });
  });
}

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
  const createResult = await runPw([
    "session",
    "create",
    sessionName,
    "--headless",
    "--open",
    pageUrl,
    "--output",
    "json",
  ]);
  assert.equal(createResult.code, 0);

  const routeResult = await runPw([
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
  ]);
  assert.equal(routeResult.code, 0, `route add failed: ${routeResult.stderr}`);
  const listResult = await runPw(["route", "list", "--session", sessionName, "--output", "json"]);
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

  const clickResult = await runPw([
    "click",
    "--session",
    sessionName,
    "--selector",
    "#trigger",
    "--output",
    "json",
  ]);
  assert.equal(clickResult.code, 0, `click failed: ${clickResult.stderr}\n${clickResult.stdout}`);

  const waitResult = await runPw([
    "wait",
    "--session",
    sessionName,
    "--text",
    "mocked",
    "--output",
    "json",
  ]);
  assert.equal(waitResult.code, 0, `wait failed: ${waitResult.stderr}\n${waitResult.stdout}`);

  const statusResult = await runPw(["session", "status", sessionName, "--output", "json"]);
  assert.equal(statusResult.code, 0);
  assert.equal((statusResult.json as { data: { active: boolean } }).data.active, true);

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"]);
  assert.equal(closeResult.code, 0);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  await rm(workspaceDir, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

type CliResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  json: unknown;
};

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-sse-observation-"));
const sessionName = `sse${Date.now().toString(36).slice(-5)}`;

function runPw(args: string[]) {
  return new Promise<CliResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: workspaceDir,
      env: {
        ...process.env,
        NODE_TEST_CONTEXT: undefined,
        PLAYWRIGHT_DAEMON_SESSION_DIR: resolve(workspaceDir, ".pwcli", "playwright-daemon"),
        PLAYWRIGHT_SERVER_REGISTRY: resolve(workspaceDir, ".pwcli", "playwright-registry"),
      },
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
        try {
          json = JSON.parse(trimmed);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse JSON output for ${args.join(" ")}: ${
                error instanceof Error ? error.message : String(error)
              }\nstdout=${stdout}\nstderr=${stderr}`,
            ),
          );
          return;
        }
      }
      resolveResult({ code, stdout, stderr, json });
    });
  });
}

const server = createServer((request, response) => {
  if (request.url === "/events") {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    response.write('data: {"type":"ping"}\n\n');
    setTimeout(() => {
      response.write('data: {"type":"pong"}\n\n');
    }, 100);
    setTimeout(() => {
      response.end();
    }, 2000);
    return;
  }

  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
    <html>
      <head><title>SSE Fixture</title></head>
      <body>
        <script>
          const es = new EventSource('/events');
          es.onmessage = (event) => console.log(event.data);
        </script>
      </body>
    </html>`);
});

async function listenOnLoopback() {
  await new Promise<void>((resolveStart, reject) => {
    const onListening = () => {
      server.off("error", onError);
      resolveStart();
    };
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    server.once("listening", onListening);
    server.once("error", onError);
    server.listen(0, "127.0.0.1");
  });
}

await listenOnLoopback();

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("failed to bind SSE fixture server");
}
const startUrl = `http://127.0.0.1:${address.port}/`;

try {
  const createResult = await runPw([
    "session",
    "create",
    sessionName,
    "--headless",
    "--open",
    startUrl,
    "--output",
    "json",
  ]);
  assert.equal(createResult.code, 0, `session create failed: ${JSON.stringify(createResult)}`);

  await delay(1500);

  const sseResult = await runPw(["sse", "--session", sessionName, "--output", "json"]);
  assert.equal(sseResult.code, 0, `sse failed: ${JSON.stringify(sseResult)}`);
  const sseEnvelope = sseResult.json as {
    ok: boolean;
    data: {
      count: number;
      records: Array<{
        url?: string;
      }>;
    };
  };
  assert.equal(sseEnvelope.ok, true);
  assert.ok(sseEnvelope.data.count >= 1, `expected SSE records: ${JSON.stringify(sseEnvelope)}`);
  assert.ok(Array.isArray(sseEnvelope.data.records));
  assert.ok(
    typeof sseEnvelope.data.records[0]?.url === "string",
    `expected first SSE record to include url: ${JSON.stringify(sseEnvelope)}`,
  );

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"]);
  assert.equal(closeResult.code, 0, `session close failed: ${JSON.stringify(closeResult)}`);
} finally {
  await runPw(["session", "close", sessionName, "--output", "json"]).catch(() => {});
  server.closeAllConnections();
  const address = server.address();
  if (address) {
    await new Promise<void>((resolveClose, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolveClose();
      });
    });
  }
  await rm(workspaceDir, { recursive: true, force: true });
}

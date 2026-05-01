import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-mcp-serve-"));
const sessionName = `mcp${Date.now().toString(36).slice(-5)}`;

function frame(message: unknown) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

const server = createServer((request, response) => {
  if (request.url === "/article") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>MCP Fixture Article</title></head>
        <body>
          <main><article><h1>MCP Fixture Title</h1><p>Stable MCP body marker.</p></article></main>
        </body>
      </html>`);
    return;
  }
  response.writeHead(404).end("not found");
});

await new Promise<void>((resolveStart) => {
  server.listen(0, "127.0.0.1", () => resolveStart());
});
const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("failed to bind MCP fixture server");
}
const url = `http://127.0.0.1:${address.port}/article`;

const child = spawn(process.execPath, [cliPath, "mcp", "serve"], {
  cwd: workspaceDir,
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"],
});

let stdoutBuffer = Buffer.alloc(0);
child.stdout.on("data", (chunk) => {
  stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
});

function parseNextResponse(): Promise<any> {
  return new Promise((resolveResult, reject) => {
    const deadline = Date.now() + 10_000;
    const timer = setInterval(() => {
      const headerEnd = stdoutBuffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        if (Date.now() > deadline) {
          clearInterval(timer);
          reject(new Error("timed out waiting for MCP response header"));
        }
        return;
      }
      const headerText = stdoutBuffer.subarray(0, headerEnd).toString("utf8");
      const match = headerText.match(/content-length:\s*(\d+)/i);
      if (!match) {
        clearInterval(timer);
        reject(new Error("missing Content-Length in MCP response"));
        return;
      }
      const contentLength = Number(match[1]);
      const totalLength = headerEnd + 4 + contentLength;
      if (stdoutBuffer.length < totalLength) {
        if (Date.now() > deadline) {
          clearInterval(timer);
          reject(new Error("timed out waiting for MCP response body"));
        }
        return;
      }
      const body = stdoutBuffer.subarray(headerEnd + 4, totalLength).toString("utf8");
      stdoutBuffer = stdoutBuffer.subarray(totalLength);
      clearInterval(timer);
      resolveResult(JSON.parse(body));
    }, 50);
  });
}

async function send(message: unknown) {
  child.stdin.write(frame(message));
  return await parseNextResponse();
}

try {
  const initialize = await send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {},
  });
  assert.equal(initialize.result.protocolVersion, "2024-11-05");
  assert.deepEqual(initialize.result.serverInfo, {
    name: "pwcli",
    version: "0.0.0-dev",
  });
  assert.deepEqual(initialize.result.capabilities, {
    tools: {
      listChanged: false,
    },
  });

  const toolsList = await send({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });
  const toolNames = toolsList.result.tools.map((tool: { name: string }) => tool.name);
  assert.ok(toolNames.includes("session_create"));
  assert.ok(toolNames.includes("page_assess"));
  const sessionListTool = toolsList.result.tools.find(
    (tool: { name: string }) => tool.name === "session_list",
  );
  assert.ok(sessionListTool);
  assert.equal(sessionListTool.inputSchema.additionalProperties, false);
  assert.equal(sessionListTool.annotations.readOnlyHint, true);
  const openTool = toolsList.result.tools.find((tool: { name: string }) => tool.name === "open");
  assert.ok(openTool);
  assert.equal(openTool.inputSchema.additionalProperties, false);
  assert.equal(openTool.annotations.readOnlyHint, false);

  const invalidArgs = await send({
    jsonrpc: "2.0",
    id: 99,
    method: "tools/call",
    params: {
      name: "session_list",
      arguments: {
        unexpected: true,
      },
    },
  });
  assert.equal(invalidArgs.error.code, -32000);
  assert.match(
    invalidArgs.error.message,
    /unknown argument\(s\) for tool 'session_list': unexpected/,
  );

  const createResult = await send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "session_create",
      arguments: {
        sessionName,
        url,
      },
    },
  });
  assert.equal(createResult.result.structuredContent.data.created, true);

  const attachableResult = await send({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "session_attachable_list",
      arguments: {},
    },
  });
  assert.equal(
    attachableResult.result.structuredContent.data.capability.capability,
    "existing-browser-attach",
  );
  assert.ok(Array.isArray(attachableResult.result.structuredContent.data.attachable.servers));

  const assessResult = await send({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "page_assess",
      arguments: {
        sessionName,
      },
    },
  });
  assert.equal(assessResult.result.structuredContent.page.title, "MCP Fixture Article");
  assert.ok(assessResult.result.structuredContent.data.summary);
  assert.ok(Array.isArray(assessResult.result.structuredContent.data.nextSteps));
} finally {
  child.kill("SIGTERM");
  server.closeAllConnections();
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  await rm(workspaceDir, { recursive: true, force: true });
}

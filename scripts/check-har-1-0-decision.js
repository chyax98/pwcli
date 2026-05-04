import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-har-decision-"));
const sessionName = `har${Date.now().toString(36).slice(-5)}`;
const harFile = resolve(workspaceDir, "fixture.har");
const targetUrl = "http://pwcli-har.local/api/data";

function runPw(args) {
  return new Promise((resolveResult, reject) => {
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
      let json = null;
      if (trimmed) {
        try {
          json = JSON.parse(trimmed);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse JSON for ${args.join(" ")}: ${error.message}\nstdout=${stdout}\nstderr=${stderr}`,
            ),
          );
          return;
        }
      }
      resolveResult({ code, stdout, stderr, json });
    });
  });
}

function harFixture(url) {
  const body = JSON.stringify({ ok: true, source: "har-fixture" });
  return {
    log: {
      version: "1.2",
      creator: { name: "pwcli-check", version: "1.0" },
      entries: [
        {
          startedDateTime: "2026-05-04T00:00:00.000Z",
          time: 1,
          request: {
            method: "GET",
            url,
            httpVersion: "HTTP/1.1",
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: 0,
          },
          response: {
            status: 200,
            statusText: "OK",
            httpVersion: "HTTP/1.1",
            cookies: [],
            headers: [{ name: "content-type", value: "application/json" }],
            content: {
              size: Buffer.byteLength(body),
              mimeType: "application/json",
              text: body,
            },
            redirectURL: "",
            headersSize: -1,
            bodySize: Buffer.byteLength(body),
          },
          cache: {},
          timings: { send: 0, wait: 1, receive: 0 },
        },
      ],
    },
  };
}

try {
  await writeFile(harFile, `${JSON.stringify(harFixture(targetUrl), null, 2)}\n`, "utf8");

  const create = await runPw([
    "session",
    "create",
    sessionName,
    "--open",
    "about:blank",
    "--output",
    "json",
  ]);
  assert.equal(create.code, 0, `session create failed: ${JSON.stringify(create)}`);

  const start = await runPw([
    "har",
    "start",
    "--session",
    sessionName,
    "--path",
    resolve(workspaceDir, "record.har"),
    "--output",
    "json",
  ]);
  assert.notEqual(start.code, 0, "har start must not pretend to be supported");
  assert.equal(start.json?.ok, false);
  assert.equal(start.json?.error?.code, "UNSUPPORTED_HAR_CAPTURE");
  assert.equal(
    start.json?.error?.details?.reason,
    "PLAYWRIGHT_RECORD_HAR_REQUIRES_CONTEXT_CREATION",
  );

  const replay = await runPw([
    "har",
    "replay",
    harFile,
    "--session",
    sessionName,
    "--output",
    "json",
  ]);
  assert.equal(replay.code, 0, `har replay failed: ${JSON.stringify(replay)}`);
  assert.equal(replay.json?.data?.replayActive, true);
  assert.equal(replay.json?.data?.file, harFile);

  const open = await runPw(["open", targetUrl, "--session", sessionName, "--output", "json"]);
  assert.equal(open.code, 0, `open replay URL failed: ${JSON.stringify(open)}`);

  const text = await runPw([
    "read-text",
    "--session",
    sessionName,
    "--max-chars",
    "500",
    "--output",
    "json",
  ]);
  assert.equal(text.code, 0, `read-text failed: ${JSON.stringify(text)}`);
  assert.match(text.json?.data?.text ?? "", /har-fixture/);

  const stop = await runPw(["har", "replay-stop", "--session", sessionName, "--output", "json"]);
  assert.equal(stop.code, 0, `har replay-stop failed: ${JSON.stringify(stop)}`);
  assert.equal(stop.json?.data?.replayActive, false);
} finally {
  await runPw(["session", "close", sessionName, "--output", "json"]).catch(() => undefined);
  await rm(workspaceDir, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
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
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-page-assess-"));
const sessionName = `assess${Date.now().toString(36).slice(-5)}`;

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
  if (request.url === "/article") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head>
          <title>Fixture Article</title>
        </head>
        <body>
          <main>
            <article>
              <h1>Fixture Title Marker</h1>
              <p>Stable body marker paragraph for page assess.</p>
              <p>Another visible paragraph to keep density high.</p>
              <a href="/next">Primary CTA Marker</a>
            </article>
          </main>
        </body>
      </html>`);
    return;
  }
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("not found");
});

await new Promise<void>((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve());
});

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("failed to bind fixture server");
}
const startUrl = `http://127.0.0.1:${address.port}/article`;

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

  const assessResult = await runPw([
    "page",
    "assess",
    "--session",
    sessionName,
    "--output",
    "json",
  ]);
  assert.equal(assessResult.code, 0, `page assess failed: ${JSON.stringify(assessResult)}`);

  const envelope = assessResult.json as {
    ok: boolean;
    data: {
      summary: {
        pageKind: string;
        visibleTextDensity: string;
        hasDialog: boolean;
        hasFrames: boolean;
        hasForms: boolean;
        hasTableLikeRegions: boolean;
        hasFeedLikeRegions: boolean;
      };
      dataHints: {
        domReadable: boolean;
        accessibilityReadable: boolean;
        runtimeProbeRecommended: boolean;
        storageProbeRecommended: boolean;
        networkProbeRecommended: boolean;
      };
      complexityHints: {
        overlayHeavyPageLikely: boolean;
        virtualizedUiLikely: boolean;
      };
      nextSteps: string[];
      evidence: {
        derivedFrom: string[];
      };
    };
    page: {
      url: string;
      title: string;
    };
  };

  assert.equal(envelope.ok, true);
  assert.equal(envelope.page.url, startUrl);
  assert.equal(envelope.page.title, "Fixture Article");
  assert.equal(envelope.data.summary.pageKind, "document");
  assert.equal(envelope.data.summary.visibleTextDensity, "high");
  assert.equal(envelope.data.summary.hasDialog, false);
  assert.equal(envelope.data.summary.hasFrames, false);
  assert.equal(envelope.data.summary.hasForms, false);
  assert.equal(envelope.data.summary.hasTableLikeRegions, false);
  assert.equal(envelope.data.summary.hasFeedLikeRegions, false);
  assert.equal(envelope.data.dataHints.domReadable, true);
  assert.equal(envelope.data.dataHints.accessibilityReadable, true);
  assert.equal(envelope.data.dataHints.runtimeProbeRecommended, false);
  assert.equal(envelope.data.dataHints.storageProbeRecommended, false);
  assert.equal(envelope.data.dataHints.networkProbeRecommended, false);
  assert.equal(envelope.data.complexityHints.overlayHeavyPageLikely, false);
  assert.equal(envelope.data.complexityHints.virtualizedUiLikely, false);
  assert.deepEqual(envelope.data.nextSteps, [
    `pw read-text -s ${sessionName}`,
    `pw snapshot -i -s ${sessionName}`,
  ]);
  assert.deepEqual(envelope.data.evidence.derivedFrom, [
    "page current",
    "read-text-lite",
    "interactive summary",
    "frame/dialog projection",
  ]);

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"]);
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
  await rm(workspaceDir, { recursive: true, force: true });
}

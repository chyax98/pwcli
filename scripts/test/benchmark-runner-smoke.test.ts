import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type ProcessResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

const repoRoot = resolve(import.meta.dirname, "..", "..");
const suiteRunnerPath = resolve(repoRoot, "benchmark", "runners", "suite", "run-suite.mjs");
const taskPath = resolve(
  repoRoot,
  "benchmark",
  "tasks",
  "perception",
  "fixture-perception-basic-001.json",
);
const tempRoot = await mkdtemp(join(tmpdir(), "pwcli-benchmark-runner-"));
const reportsDir = resolve(tempRoot, "reports");
const artifactsDir = resolve(tempRoot, "artifacts");
const workspaceDir = resolve(tempRoot, "workspace");

function runNode(args: string[]) {
  return new Promise<ProcessResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
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
      resolveResult({ code, stdout, stderr });
    });
  });
}

const server = createServer((request, response) => {
  if (request.url === "/article") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>Fixture Article</title></head>
        <body>
          <main>
            <article>
              <h1>Fixture Title Marker</h1>
              <p>Stable body marker paragraph for benchmark runner smoke test.</p>
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

await new Promise<void>((resolveStart) => {
  server.listen(0, "127.0.0.1", () => resolveStart());
});

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("failed to bind benchmark fixture server");
}

try {
  const result = await runNode([
    suiteRunnerPath,
    "--task",
    taskPath,
    "--port",
    String(address.port),
    "--reports-dir",
    reportsDir,
    "--artifacts-dir",
    artifactsDir,
    "--workspace-dir",
    workspaceDir,
  ]);

  assert.equal(result.code, 0, `suite runner failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);

  const summaryJsonPath = resolve(reportsDir, "latest", "summary.json");
  const summaryMdPath = resolve(reportsDir, "latest", "summary.md");

  await stat(summaryJsonPath);
  await stat(summaryMdPath);

  const summaryJson = JSON.parse(await readFile(summaryJsonPath, "utf8")) as {
    totals: { total: number; passed: number; failed: number };
    tasks: Array<{ id: string; status: string; artifactDir: string }>;
  };
  const summaryMd = await readFile(summaryMdPath, "utf8");

  assert.equal(summaryJson.totals.total, 1);
  assert.equal(summaryJson.totals.passed, 1);
  assert.equal(summaryJson.totals.failed, 0);
  assert.equal(summaryJson.tasks.length, 1);
  assert.equal(summaryJson.tasks[0]?.id, "fixture-perception-basic-001");
  assert.equal(summaryJson.tasks[0]?.status, "passed");
  assert.match(summaryMd, /fixture-perception-basic-001/);
  assert.match(summaryMd, /Passed: 1/);

  const taskSummaryPath = resolve(summaryJson.tasks[0]!.artifactDir, "task-summary.json");
  const commandsPath = resolve(summaryJson.tasks[0]!.artifactDir, "commands.jsonl");
  const stdoutPath = resolve(summaryJson.tasks[0]!.artifactDir, "stdout.json");

  await stat(taskSummaryPath);
  await stat(commandsPath);
  await stat(stdoutPath);
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
  await rm(tempRoot, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateMatrix } from "../../benchmark/scripts/generate-matrix.mjs";
import { startFixtureServer } from "../../benchmark/fixtures/server.mjs";
import { runSuite } from "../../benchmark/runners/suite/run-suite.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const tempRoot = await mkdtemp(join(tmpdir(), "pwcli-benchmark-runner-"));
const reportsDir = resolve(tempRoot, "reports");
const artifactsDir = resolve(tempRoot, "artifacts");
const workspaceDir = resolve(tempRoot, "workspace");
const generatedRoot = resolve(tempRoot, "generated");

const fixture = await startFixtureServer();

try {
  await generateMatrix({ outputDir: generatedRoot });
  const taskPaths = [
    resolve(generatedRoot, "perception", "fixture-perception-00.json"),
    resolve(generatedRoot, "diagnostics", "fixture-diagnostics-00.json"),
    resolve(generatedRoot, "auth-state", "fixture-auth-00.json"),
    resolve(generatedRoot, "extraction", "fixture-extract-00.json"),
  ];

  const summary = await runSuite({
    tasks: taskPaths,
    port: String(fixture.port),
    reportsDir,
    artifactsDir,
    workspaceDir,
  });

  assert.equal(summary.totals.total, 4);
  assert.equal(summary.totals.passed, 4);
  assert.equal(summary.totals.failed, 0);
  assert.deepEqual(summary.failureFamilies, {});

  const summaryJsonPath = resolve(reportsDir, "latest", "summary.json");
  const summaryMdPath = resolve(reportsDir, "latest", "summary.md");

  await stat(summaryJsonPath);
  await stat(summaryMdPath);

  const summaryJson = JSON.parse(await readFile(summaryJsonPath, "utf8")) as {
    totals: { total: number; passed: number; failed: number };
    tasks: Array<{ id: string; status: string; artifactDir: string }>;
  };
  const summaryMd = await readFile(summaryMdPath, "utf8");

  assert.equal(summaryJson.totals.total, 4);
  assert.equal(summaryJson.totals.passed, 4);
  assert.equal(summaryJson.totals.failed, 0);
  assert.match(summaryMd, /fixture-perception-00/);
  assert.match(summaryMd, /fixture-diagnostics-00/);
  assert.match(summaryMd, /fixture-auth-00/);
  assert.match(summaryMd, /fixture-extract-00/);

  for (const task of summaryJson.tasks) {
    const taskSummaryPath = resolve(task.artifactDir, "task-summary.json");
    const commandsPath = resolve(task.artifactDir, "commands.jsonl");
    const stdoutPath = resolve(task.artifactDir, "stdout.json");
    await stat(taskSummaryPath);
    await stat(commandsPath);
    await stat(stdoutPath);
    assert.equal(task.status, "passed");
  }
} finally {
  await fixture.close();
  await rm(tempRoot, { recursive: true, force: true });
}

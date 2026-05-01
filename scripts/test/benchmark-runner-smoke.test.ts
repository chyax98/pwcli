import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateMatrix } from "../../benchmark/scripts/generate-matrix.mjs";
import { startFixtureServer } from "../../benchmark/fixtures/server.mjs";
import { runSuite } from "../../benchmark/runners/suite/run-suite.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..");

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), "pwcli-benchmark-runner-"));
  const reportsDir = resolve(tempRoot, "reports");
  const artifactsDir = resolve(tempRoot, "artifacts");
  const workspaceDir = resolve(tempRoot, "workspace");
  const generatedRoot = resolve(tempRoot, "generated");
  const suiteRoot = resolve(tempRoot, "suite-input");
  const fixture = await startFixtureServer();

  try {
    const manifest = await generateMatrix({ outputDir: generatedRoot });
    const selectedTasks = [
      ["perception", "fixture-perception-00.json"],
      ["diagnostics", "fixture-diagnostics-00.json"],
      ["auth-state", "fixture-auth-00.json"],
      ["extraction", "fixture-extract-00.json"],
    ] as const;

    for (const [category, filename] of selectedTasks) {
      const targetDir = resolve(suiteRoot, category);
      await mkdir(targetDir, { recursive: true });
      await writeFile(
        resolve(targetDir, filename),
        await readFile(resolve(generatedRoot, category, filename), "utf8"),
        "utf8",
      );
    }
    await writeFile(
      resolve(suiteRoot, "manifest.json"),
      JSON.stringify({ ...manifest, total: selectedTasks.length }, null, 2),
      "utf8",
    );

    const summary = await runSuite({
      tasks: [suiteRoot],
      port: String(fixture.port),
      reportsDir,
      artifactsDir,
      workspaceDir,
      surface: {
        kind: "nightly",
        name: "nightly-regression-pack",
      },
      manifest: {
        ...manifest,
        total: selectedTasks.length,
      },
      reportTitle: "Nightly Regression Summary",
    });

    assert.equal(summary.totals.total, 4);
    assert.equal(summary.totals.passed, 4);
    assert.equal(summary.totals.failed, 0);
    assert.deepEqual(summary.failureFamilies, {});
    assert.equal(summary.contractVersion, 1);
    assert.equal(summary.surface.kind, "nightly");
    assert.equal(summary.surface.name, "nightly-regression-pack");

    const summaryJsonPath = resolve(reportsDir, "latest", "summary.json");
    const summaryMdPath = resolve(reportsDir, "latest", "summary.md");
    const scoreJsonPath = resolve(reportsDir, "latest", "score.json");

    await stat(summaryJsonPath);
    await stat(summaryMdPath);
    await stat(scoreJsonPath);

    const summaryJson = JSON.parse(await readFile(summaryJsonPath, "utf8")) as {
      contractVersion: number;
      surface: { kind: string; name: string };
      totals: { total: number; passed: number; failed: number };
      manifest: { total: number };
      tasks: Array<{ id: string; status: string; artifactDir: string }>;
    };
    const summaryMd = await readFile(summaryMdPath, "utf8");

    assert.equal(summaryJson.contractVersion, 1);
    assert.equal(summaryJson.surface.kind, "nightly");
    assert.equal(summaryJson.surface.name, "nightly-regression-pack");
    assert.equal(summaryJson.totals.total, 4);
    assert.equal(summaryJson.totals.passed, 4);
    assert.equal(summaryJson.totals.failed, 0);
    assert.equal(summaryJson.manifest.total, 4);
    assert.match(summaryMd, /Nightly Regression Summary/);
    assert.match(summaryMd, /nightly-regression-pack/);
    assert.match(summaryMd, /fixture-perception-00/);
    assert.match(summaryMd, /fixture-diagnostics-00/);
    assert.match(summaryMd, /fixture-auth-00/);
    assert.match(summaryMd, /fixture-extract-00/);
    const scoreJson = JSON.parse(await readFile(scoreJsonPath, "utf8")) as {
      contractVersion: number;
      verdict: string;
      overallScore: number;
      passRate: number;
      categories: Record<string, { passRate: number }>;
      failureFamilies: Record<string, number>;
      surface: { kind: string; name: string };
    };
    assert.equal(scoreJson.contractVersion, 1);
    assert.equal(scoreJson.verdict, "pass");
    assert.equal(scoreJson.overallScore, 100);
    assert.equal(scoreJson.passRate, 100);
    assert.equal(scoreJson.surface.kind, "nightly");
    assert.equal(scoreJson.surface.name, "nightly-regression-pack");
    assert.deepEqual(scoreJson.failureFamilies, {});
    assert.equal(scoreJson.categories["perception"]?.passRate, 100);

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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

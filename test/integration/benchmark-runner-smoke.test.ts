import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startFixtureServer } from "../../benchmark/fixtures/server.mjs";
import { runSuite } from "../../benchmark/runners/suite/run-suite.mjs";
import { generateMatrix } from "../../benchmark/scripts/generate-matrix.mjs";

const _repoRoot = resolve(import.meta.dirname, "..", "..");

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
    });

    assert.deepEqual(summary, {
      total: 4,
      passed: 4,
      failed: 0,
      failures: [],
    });

    const summaryJsonPath = resolve(reportsDir, "latest", "summary.json");

    await stat(summaryJsonPath);

    const summaryJson = JSON.parse(await readFile(summaryJsonPath, "utf8")) as {
      total: number;
      passed: number;
      failed: number;
      failures: Array<unknown>;
    };

    assert.deepEqual(summaryJson, {
      total: 4,
      passed: 4,
      failed: 0,
      failures: [],
    });

    const taskArtifactDirs = selectedTasks.map(([_category, filename]) =>
      resolve(artifactsDir, filename.replace(/\.json$/u, "")),
    );
    for (const taskArtifactDir of taskArtifactDirs) {
      const runDirs = await stat(taskArtifactDir).then(
        () => true,
        () => false,
      );
      assert.equal(runDirs, true);
    }

    const taskSummaries = [
      "fixture-perception-00",
      "fixture-diagnostics-00",
      "fixture-auth-00",
      "fixture-extract-00",
    ];
    for (const taskId of taskSummaries) {
      const artifactRoot = resolve(artifactsDir, taskId);
      const runEntries = await readdir(artifactRoot);
      assert.equal(runEntries.length, 1);
      const artifactDir = resolve(artifactRoot, runEntries[0]);
      const taskSummaryPath = resolve(artifactDir, "task-summary.json");
      const commandsPath = resolve(artifactDir, "commands.jsonl");
      const stdoutPath = resolve(artifactDir, "stdout.json");
      await stat(taskSummaryPath);
      await stat(commandsPath);
      await stat(stdoutPath);
      const taskSummary = JSON.parse(await readFile(taskSummaryPath, "utf8")) as {
        status: string;
      };
      assert.equal(taskSummary.status, "passed");
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

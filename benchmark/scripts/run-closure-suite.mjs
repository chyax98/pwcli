import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateMatrix } from "./generate-matrix.mjs";
import { startFixtureServer } from "../fixtures/server.mjs";
import { createClosureSessionName, runLoadedTask, spawnPw } from "../runners/task/run-task.mjs";
import { discoverTaskPaths, loadTaskList } from "../shared/load-task.mjs";
import {
  createBenchmarkSummary,
  computeBenchmarkScore,
  renderBenchmarkReport,
} from "../shared/score.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..");

function parseArgs(argv) {
  return {
    resume: argv.includes("--resume"),
  };
}

function groupTasks(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const key = task.task.category;
    const existing = groups.get(key) ?? [];
    existing.push(task);
    groups.set(key, existing);
  }
  return groups;
}

async function runGroupedTasks(tasks, context) {
  const summaries = [];
  const groups = groupTasks(tasks);
  for (const [category, group] of groups.entries()) {
    const sessionName = createClosureSessionName(category.slice(0, 2));
    const createResult = await spawnPw(
      ["session", "create", sessionName, "--headless", "--open", "about:blank"],
      context.workspaceDir,
    );
    if (createResult.code !== 0 || createResult.parsed?.ok !== true) {
      throw new Error(`closure suite could not create pooled session for ${category}`);
    }
    try {
      for (const task of group) {
        const summary = await runLoadedTask({
          task: task.task,
          taskPath: task.taskPath,
          artifactsDir: context.artifactsDir,
          workspaceDir: context.workspaceDir,
          sessionName,
          manageLifecycle: false,
        });
        summaries.push(summary);
      }
    } finally {
      await spawnPw(["session", "close", sessionName], context.workspaceDir).catch(() => null);
    }
  }
  return summaries;
}

export async function runClosureSuite(options = {}) {
  const resume = options.resume === true;
  const manifest = await generateMatrix();
  const fixture = await startFixtureServer();
  const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-benchmark-closure-"));
  const reportsDir = resolve(repoRoot, "benchmark", "reports", "closure");
  const artifactsDir = resolve(repoRoot, "benchmark", "artifacts", "closure");
  try {
    if (!resume) {
      await rm(reportsDir, { recursive: true, force: true });
      await rm(artifactsDir, { recursive: true, force: true });
    }
    const taskPaths = (await discoverTaskPaths([resolve(repoRoot, "benchmark", "tasks", "generated")])).filter(
      (taskPath) => !taskPath.endsWith("/manifest.json"),
    );
    const allTasks = (await loadTaskList(taskPaths, { port: String(fixture.port) })).filter(
      (task) => typeof task.task?.category === "string",
    );
    const existingSummaries = resume ? await loadExistingSummaries(artifactsDir) : [];
    const completedIds = new Set(existingSummaries.map((summary) => summary.id));
    const pendingTasks = allTasks.filter((task) => !completedIds.has(task.task.id));
    const newSummaries = await runGroupedTasks(pendingTasks, { workspaceDir, artifactsDir });
    const summaries = [...existingSummaries, ...newSummaries];
    const generatedAt = new Date().toISOString();
    const summary = createBenchmarkSummary(summaries, {
      generatedAt,
      surface: {
        kind: "closure",
        name: "closure-suite",
      },
      manifest,
    });
    const score = computeBenchmarkScore(summaries, {
      generatedAt,
      surface: summary.surface,
    });
    const latestDir = resolve(reportsDir, "latest");
    await mkdir(latestDir, { recursive: true });
    await writeFile(resolve(latestDir, "summary.json"), JSON.stringify(summary, null, 2));
    await writeFile(
      resolve(latestDir, "summary.md"),
      await renderBenchmarkReport(summary, {
        score,
        reportTitle: "Closure Benchmark Summary",
      }),
    );
    await writeFile(resolve(latestDir, "score.json"), JSON.stringify(score, null, 2));
    return {
      manifest,
      port: fixture.port,
      summary: {
        ...summary,
        score,
      },
    };
  } finally {
    await fixture.close();
    await rm(workspaceDir, { recursive: true, force: true });
  }
}

async function loadExistingSummaries(artifactsDir) {
  const results = [];
  let taskDirs = [];
  try {
    taskDirs = await readdir(artifactsDir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const taskDir of taskDirs) {
    if (!taskDir.isDirectory()) {
      continue;
    }
    const taskPath = resolve(artifactsDir, taskDir.name);
    const runDirs = await readdir(taskPath, { withFileTypes: true });
    const runSummaries = [];
    for (const runDir of runDirs) {
      if (!runDir.isDirectory()) {
        continue;
      }
      const summaryPath = resolve(taskPath, runDir.name, "task-summary.json");
      try {
        const summary = JSON.parse(await readFile(summaryPath, "utf8"));
        runSummaries.push(summary);
      } catch {
        continue;
      }
    }
    runSummaries.sort((left, right) => String(left.runId).localeCompare(String(right.runId)));
    const latest = runSummaries.at(-1);
    if (latest) {
      results.push(latest);
    }
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runClosureSuite(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.summary.totals.failed === 0 ? 0 : 1;
}

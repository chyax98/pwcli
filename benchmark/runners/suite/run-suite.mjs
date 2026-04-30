import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { discoverTaskPaths } from "../../shared/load-task.mjs";
import { runTask } from "../task/run-task.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");

function parseArgs(argv) {
  const parsed = {
    tasks: [],
    port: null,
    reportsDir: resolve(repoRoot, "benchmark", "reports"),
    artifactsDir: resolve(repoRoot, "benchmark", "artifacts"),
    workspaceDir: resolve(repoRoot, ".pwcli", "benchmark-workspace"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--task") {
      parsed.tasks.push(value);
      index += 1;
      continue;
    }
    if (arg === "--tasks-dir") {
      parsed.tasks.push(value);
      index += 1;
      continue;
    }
    if (arg === "--port") {
      parsed.port = value;
      index += 1;
      continue;
    }
    if (arg === "--reports-dir") {
      parsed.reportsDir = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--artifacts-dir") {
      parsed.artifactsDir = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--workspace-dir") {
      parsed.workspaceDir = resolve(value);
      index += 1;
    }
  }

  if (parsed.tasks.length === 0) {
    throw new Error("run-suite requires at least one --task <path> or --tasks-dir <dir>");
  }
  return parsed;
}

function renderSummaryMarkdown(summary) {
  const lines = [
    "# Benchmark Summary",
    "",
    `Total: ${summary.totals.total}`,
    `Passed: ${summary.totals.passed}`,
    `Failed: ${summary.totals.failed}`,
    "",
    "| Task | Status | Failure Family |",
    "|---|---|---|",
    ...summary.tasks.map(
      (task) => `| ${task.id} | ${task.status} | ${task.failureFamily ?? "-"} |`,
    ),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export async function runSuite(input) {
  const taskPaths = await discoverTaskPaths(input.tasks);
  const tasks = [];
  for (const taskPath of taskPaths) {
    const taskResult = await runTask({
      task: taskPath,
      port: input.port,
      reportsDir: input.reportsDir,
      artifactsDir: input.artifactsDir,
      workspaceDir: input.workspaceDir,
    });
    tasks.push(taskResult);
  }

  const totals = {
    total: tasks.length,
    passed: tasks.filter((task) => task.status === "passed").length,
    failed: tasks.filter((task) => task.status !== "passed").length,
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    totals,
    tasks,
  };

  const latestDir = resolve(input.reportsDir, "latest");
  await mkdir(latestDir, { recursive: true });
  await writeFile(resolve(latestDir, "summary.json"), JSON.stringify(summary, null, 2));
  await writeFile(resolve(latestDir, "summary.md"), renderSummaryMarkdown(summary));

  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  const result = await runSuite(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.totals.failed === 0 ? 0 : 1;
}

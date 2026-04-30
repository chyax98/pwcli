import { access, appendFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { loadTask } from "../../shared/load-task.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const sourceCliPath = resolve(repoRoot, "src", "cli.ts");

function parseArgs(argv) {
  const parsed = {
    task: null,
    port: null,
    reportsDir: resolve(repoRoot, "benchmark", "reports"),
    artifactsDir: resolve(repoRoot, "benchmark", "artifacts"),
    workspaceDir: resolve(repoRoot, ".pwcli", "benchmark-workspace"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--task") {
      parsed.task = value;
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
  if (!parsed.task) {
    throw new Error("run-task requires --task <path>");
  }
  return parsed;
}

function createRunId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSessionName() {
  return `bm${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 5)}`.slice(
    0,
    16,
  );
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return typeof value === "string" ? value : null;
}

function assertAllowed(task, family) {
  const allowed = Array.isArray(task.allowedCommands) ? task.allowedCommands : [];
  if (!allowed.includes(family)) {
    throw new Error(`task ${task.id} does not allow command family '${family}'`);
  }
}

function buildPerceptionPlan(task, sessionName, screenshotPath) {
  assertAllowed(task, "session");
  assertAllowed(task, "observe");
  assertAllowed(task, "page");
  assertAllowed(task, "read-text");
  assertAllowed(task, "snapshot");
  assertAllowed(task, "locate");
  assertAllowed(task, "screenshot");
  assertAllowed(task, "diagnostics");

  return [
    {
      family: "session",
      label: "session create",
      args: ["session", "create", sessionName, "--headless", "--open", task.site.startUrl],
    },
    {
      family: "observe",
      label: "observe status",
      args: ["observe", "status", "--session", sessionName],
    },
    {
      family: "page",
      label: "page current",
      args: ["page", "current", "--session", sessionName],
    },
    {
      family: "read-text",
      label: "read-text excerpt",
      args: ["read-text", "--session", sessionName, "--max-chars", "4000"],
    },
    {
      family: "snapshot",
      label: "snapshot -i",
      args: ["snapshot", "-i", "--session", sessionName],
    },
    {
      family: "locate",
      label: "locate cta",
      args: ["locate", "--session", sessionName, "--text", "Primary CTA Marker"],
    },
    {
      family: "screenshot",
      label: "screenshot",
      args: ["screenshot", "--session", sessionName, "--path", screenshotPath],
    },
    {
      family: "diagnostics",
      label: "diagnostics digest",
      args: ["diagnostics", "digest", "--session", sessionName, "--limit", "10"],
    },
  ];
}

function planForTask(task, sessionName, screenshotPath) {
  if (task.id === "fixture-perception-basic-001") {
    return buildPerceptionPlan(task, sessionName, screenshotPath);
  }
  throw new Error(`RUNNER_UNSUPPORTED_TASK:${task.id}`);
}

function evaluatePerceptionTask(task, commandOutputs) {
  const pageCurrent = commandOutputs["page current"];
  const readText = commandOutputs["read-text excerpt"];
  const locate = commandOutputs["locate cta"];
  const diagnostics = commandOutputs["diagnostics digest"];

  const pageTitle = asString(pageCurrent?.page?.title) ?? asString(pageCurrent?.data?.title) ?? "";
  const readTextValue = asString(readText?.data?.text) ?? "";
  const ctaCount = Number(locate?.data?.count ?? 0);
  const diagnosticsOk = diagnostics?.ok === true;

  const checks = [
    {
      id: "title-visible",
      passed: pageTitle.includes("Fixture Article"),
      detail: pageTitle,
    },
    {
      id: "body-visible",
      passed: readTextValue.includes("Stable body marker paragraph"),
      detail: readTextValue.slice(0, 120),
    },
    {
      id: "cta-visible",
      passed: ctaCount === 1,
      detail: `count=${ctaCount}`,
    },
    {
      id: "diagnostics-readable",
      passed: diagnosticsOk,
      detail: diagnosticsOk ? "ok" : "missing",
    },
  ];

  const passed = checks.every((check) => check.passed);
  return {
    passed,
    checks,
    failureFamily: passed ? null : "VERIFY_FAILED",
    evidenceSummary: {
      required: asArray(task.evidenceRequired),
      captured: Object.keys(commandOutputs),
    },
  };
}

function evaluateTask(task, commandOutputs) {
  if (task.id === "fixture-perception-basic-001") {
    return evaluatePerceptionTask(task, commandOutputs);
  }
  return {
    passed: false,
    checks: [],
    failureFamily: "RUNNER_UNSUPPORTED_TASK",
    evidenceSummary: {
      required: asArray(task.evidenceRequired),
      captured: Object.keys(commandOutputs),
    },
  };
}

async function resolveCliInvocation() {
  try {
    await access(cliPath);
    return {
      command: process.execPath,
      argsPrefix: [cliPath],
    };
  } catch {
    return {
      command: "pnpm",
      argsPrefix: ["exec", "tsx", sourceCliPath],
    };
  }
}

async function spawnPw(args, workspaceDir) {
  const invocation = await resolveCliInvocation();
  return new Promise((resolveResult, reject) => {
    const child = spawn(invocation.command, [...invocation.argsPrefix, ...args, "--output", "json"], {
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
      let parsed = null;
      const trimmed = stdout.trim();
      if (trimmed) {
        try {
          parsed = JSON.parse(trimmed);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse JSON for ${args.join(" ")}: ${
                error instanceof Error ? error.message : String(error)
              }\nstdout=${stdout}\nstderr=${stderr}`,
            ),
          );
          return;
        }
      }
      resolveResult({ code, stdout, stderr, parsed });
    });
  });
}

async function recordCommand(logPath, commandRecord) {
  await appendFile(logPath, `${JSON.stringify(commandRecord)}\n`, "utf8");
}

export async function runTask(input) {
  const { task } = await loadTask(input.task, { port: input.port });
  const runId = createRunId();
  const sessionName = createSessionName();
  const artifactDir = resolve(input.artifactsDir, task.id, runId);
  const screenshotPath = resolve(artifactDir, "page.png");
  const commandLogPath = resolve(artifactDir, "commands.jsonl");
  const stdoutPath = resolve(artifactDir, "stdout.json");

  await mkdir(artifactDir, { recursive: true });
  await mkdir(input.workspaceDir, { recursive: true });

  const commandOutputs = {};
  const stdoutRecords = [];
  const plan = planForTask(task, sessionName, screenshotPath);
  let taskError = null;

  try {
    for (const step of plan) {
      const result = await spawnPw(step.args, input.workspaceDir);
      const commandRecord = {
        label: step.label,
        args: step.args,
        code: result.code,
        ok: result.parsed?.ok === true,
        output: result.parsed,
        stderr: result.stderr.trim(),
      };
      commandOutputs[step.label] = result.parsed;
      stdoutRecords.push({
        label: step.label,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      await recordCommand(commandLogPath, commandRecord);
      if (result.code !== 0 || result.parsed?.ok !== true) {
        throw new Error(`command failed: ${step.label}`);
      }
    }
  } catch (error) {
    taskError = error instanceof Error ? error.message : String(error);
  } finally {
    const closeResult = await spawnPw(["session", "close", sessionName], input.workspaceDir).catch(
      (error) => ({
        code: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        parsed: null,
      }),
    );
    stdoutRecords.push({
      label: "session close",
      stdout: closeResult.stdout,
      stderr: closeResult.stderr,
    });
    await recordCommand(commandLogPath, {
      label: "session close",
      args: ["session", "close", sessionName],
      code: closeResult.code,
      ok: closeResult.parsed?.ok === true,
      output: closeResult.parsed,
      stderr: closeResult.stderr.trim(),
    });
  }

  await writeFile(stdoutPath, JSON.stringify(stdoutRecords, null, 2));

  const evaluation =
    taskError === null
      ? evaluateTask(task, commandOutputs)
      : {
          passed: false,
          checks: [],
          failureFamily: "TASK_RUNNER_FAILED",
          evidenceSummary: {
            required: asArray(task.evidenceRequired),
            captured: Object.keys(commandOutputs),
          },
        };

  const summary = {
    id: task.id,
    title: task.title,
    category: task.category,
    status: evaluation.passed ? "passed" : "failed",
    runId,
    taskPath: input.task,
    artifactDir,
    sessionName,
    requestedUrl: task.site?.startUrl ?? null,
    failureFamily: evaluation.failureFamily,
    runnerError: taskError,
    checks: evaluation.checks,
    evidenceSummary: evaluation.evidenceSummary,
  };

  await writeFile(resolve(artifactDir, "task-summary.json"), JSON.stringify(summary, null, 2));
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  const result = await runTask(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "passed" ? 0 : 1;
}

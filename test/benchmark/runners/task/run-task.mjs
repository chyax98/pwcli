import { spawn } from "node:child_process";
import { access, appendFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadTask } from "../../shared/load-task.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const sourceCliPath = resolve(repoRoot, "src", "cli.ts");
const tsxCliPath = resolve(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

function parseArgs(argv) {
  const parsed = {
    task: null,
    port: null,
    reportsDir: resolve(repoRoot, "test", "benchmark", "reports"),
    artifactsDir: resolve(repoRoot, "test", "benchmark", "artifacts"),
    workspaceDir: resolve(repoRoot, ".pwcli", "test-benchmark-workspace"),
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

function createClosureSessionName(prefix) {
  return `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 4)}`.slice(
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

function _asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function assertAllowed(task, family) {
  const allowed = Array.isArray(task.allowedCommands) ? task.allowedCommands : [];
  if (!allowed.includes(family)) {
    throw new Error(`task ${task.id} does not allow command family '${family}'`);
  }
}

function buildPerceptionPlan(task, sessionName, screenshotPath, options = {}) {
  const expected = task.benchmark?.expectations ?? {};
  assertAllowed(task, "session");
  assertAllowed(task, "page");
  assertAllowed(task, "read-text");
  assertAllowed(task, "locate");
  assertAllowed(task, "screenshot");
  assertAllowed(task, "diagnostics");
  return [
    navigationStep(task, sessionName, options.manageLifecycle),
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
      family: "locate",
      label: "locate cta",
      args: ["locate", "--session", sessionName, "--text", expected.cta],
    },
    {
      family: "screenshot",
      label: "screenshot",
      args: ["screenshot", "--session", sessionName, "--path", screenshotPath],
    },
    {
      family: "diagnostics",
      label: "diagnostics digest",
      args: ["diagnostics", "digest", "--session", sessionName, "--limit", "5"],
    },
  ];
}

function buildDiagnosticsPlan(task, sessionName, screenshotPath, options = {}) {
  const expected = task.benchmark?.expectations ?? {};
  assertAllowed(task, "session");
  assertAllowed(task, "wait");
  assertAllowed(task, "network");
  assertAllowed(task, "diagnostics");
  assertAllowed(task, "screenshot");
  return [
    navigationStep(task, sessionName, options.manageLifecycle),
    {
      family: "wait",
      label: "wait ready",
      args: ["wait", "--session", sessionName, "--text", expected.readyText],
    },
    {
      family: "network",
      label: "network 500",
      args: [
        "network",
        "--session",
        sessionName,
        "--status",
        String(expected.status),
        "--limit",
        "10",
      ],
    },
    {
      family: "diagnostics",
      label: "diagnostics digest",
      args: ["diagnostics", "digest", "--session", sessionName, "--limit", "5"],
    },
    {
      family: "screenshot",
      label: "screenshot",
      args: ["screenshot", "--session", sessionName, "--path", screenshotPath],
    },
  ];
}

function buildAuthPlan(task, sessionName, options = {}) {
  assertAllowed(task, "session");
  assertAllowed(task, "auth");
  assertAllowed(task, "page");
  assertAllowed(task, "open");
  return [
    navigationStep(task, sessionName, options.manageLifecycle),
    {
      family: "page",
      label: "page current",
      args: ["page", "current", "--session", sessionName],
    },
    {
      family: "auth",
      label: "auth probe",
      args: ["auth", "probe", "--session", sessionName],
    },
  ];
}

function navigationStep(task, sessionName, manageLifecycle = true) {
  return manageLifecycle
    ? {
        family: "session",
        label: "session create",
        args: ["session", "create", sessionName, "--headless", "--open", task.site.startUrl],
      }
    : {
        family: "open",
        label: "open",
        args: ["open", task.site.startUrl, "--session", sessionName],
      };
}

function planForTask(task, sessionName, screenshotPath, options = {}) {
  switch (task.benchmark?.planKind) {
    case "perception-article":
      return buildPerceptionPlan(task, sessionName, screenshotPath, options);
    case "diagnostics-api500":
      return buildDiagnosticsPlan(task, sessionName, screenshotPath, options);
    case "auth-state":
      return buildAuthPlan(task, sessionName, options);
    default:
      throw new Error(`RUNNER_UNSUPPORTED_TASK:${task.id}`);
  }
}

function evaluatePerceptionTask(task, commandOutputs) {
  const expected = task.benchmark?.expectations ?? {};
  const pageCurrent = commandOutputs["page current"];
  const readText = commandOutputs["read-text excerpt"];
  const locate = commandOutputs["locate cta"];
  const pageTitle = asString(pageCurrent?.page?.title) ?? asString(pageCurrent?.data?.title) ?? "";
  const readTextValue = asString(readText?.data?.text) ?? "";
  const ctaCount = Number(locate?.data?.count ?? 0);
  const checks = [
    { id: "title-visible", passed: pageTitle.includes(expected.title), detail: pageTitle },
    {
      id: "body-visible",
      passed: readTextValue.includes(expected.body),
      detail: readTextValue.slice(0, 160),
    },
    { id: "cta-visible", passed: ctaCount === 1, detail: `count=${ctaCount}` },
  ];
  return finalizeEvaluation(task, commandOutputs, checks, "VERIFY_FAILED");
}

function evaluateDiagnosticsTask(task, commandOutputs) {
  const expected = task.benchmark?.expectations ?? {};
  const network = commandOutputs["network 500"];
  const digest = commandOutputs["diagnostics digest"];
  const sample = asArray(network?.data?.summary?.sample);
  const status = expected.status;
  const seenMatch = sample.some((record) => Number(record?.status ?? 0) === status);
  const digestOk = digest?.ok === true;
  const checks = [
    { id: "api-500-observed", passed: seenMatch, detail: `records=${sample.length}` },
    { id: "diagnostics-readable", passed: digestOk, detail: digestOk ? "ok" : "missing" },
  ];
  return finalizeEvaluation(task, commandOutputs, checks, "API_5XX");
}

function evaluateAuthTask(task, commandOutputs) {
  const expected = task.benchmark?.expectations ?? {};
  const probe = commandOutputs["auth probe"];
  const pageCurrent = commandOutputs["page current"];
  const status = asString(probe?.data?.status) ?? "";
  const pageTitle = asString(pageCurrent?.page?.title) ?? "";
  const checks = [
    { id: "auth-status", passed: status === expected.status, detail: status },
    { id: "heading-visible", passed: pageTitle.includes(expected.heading), detail: pageTitle },
  ];
  return finalizeEvaluation(task, commandOutputs, checks, "AUTH_NOT_REUSED");
}

function finalizeEvaluation(task, commandOutputs, checks, failureFamily) {
  const passed = checks.every((check) => check.passed);
  return {
    passed,
    checks,
    failureFamily: passed ? null : failureFamily,
    evidenceSummary: {
      required: asArray(task.evidenceRequired),
      captured: Object.keys(commandOutputs),
    },
  };
}

function evaluateTask(task, commandOutputs) {
  switch (task.benchmark?.planKind) {
    case "perception-article":
      return evaluatePerceptionTask(task, commandOutputs);
    case "diagnostics-api500":
      return evaluateDiagnosticsTask(task, commandOutputs);
    case "auth-state":
      return evaluateAuthTask(task, commandOutputs);
    default:
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
}

async function resolveCliInvocation() {
  try {
    await access(cliPath);
    return {
      command: process.execPath,
      argsPrefix: [cliPath],
    };
  } catch {
    await access(tsxCliPath);
    return {
      command: process.execPath,
      argsPrefix: [tsxCliPath, sourceCliPath],
    };
  }
}

async function spawnPw(args, workspaceDir) {
  const invocation = await resolveCliInvocation();
  return new Promise((resolveResult, reject) => {
    const child = spawn(
      invocation.command,
      [...invocation.argsPrefix, ...args, "--output", "json"],
      {
        cwd: workspaceDir,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
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

export async function runLoadedTask(input) {
  const task = input.task;
  const runId = createRunId();
  const sessionName = input.sessionName ?? createSessionName();
  const artifactDir = resolve(input.artifactsDir, task.id, runId);
  const screenshotPath = resolve(artifactDir, "page.png");
  const commandLogPath = resolve(artifactDir, "commands.jsonl");
  const stdoutPath = resolve(artifactDir, "stdout.json");

  await mkdir(artifactDir, { recursive: true });
  await mkdir(input.workspaceDir, { recursive: true });

  const commandOutputs = {};
  const stdoutRecords = [];
  const plan = planForTask(task, sessionName, screenshotPath, {
    manageLifecycle: input.manageLifecycle !== false,
  });
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
    if (input.manageLifecycle !== false) {
      const closeResult = await spawnPw(
        ["session", "close", sessionName],
        input.workspaceDir,
      ).catch((error) => ({
        code: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        parsed: null,
      }));
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
    taskPath: input.taskPath,
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

export async function runTask(input) {
  const { task, taskPath } = await loadTask(input.task, { port: input.port });
  return await runLoadedTask({
    task,
    taskPath,
    artifactsDir: input.artifactsDir,
    workspaceDir: input.workspaceDir,
  });
}

export { createClosureSessionName, spawnPw };

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  const result = await runTask(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "passed" ? 0 : 1;
}

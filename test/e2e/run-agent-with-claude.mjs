import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [taskFile] = process.argv.slice(2);

if (!taskFile) {
  throw new Error("task file is required");
}

const outputPath = process.env.PWCLI_AGENT_OUTPUT;
const targetUrl = process.env.PWCLI_AGENT_TARGET_URL;
const skillPath = process.env.PWCLI_AGENT_SKILL_PATH;

if (!outputPath || !targetUrl || !skillPath) {
  throw new Error(
    "PWCLI_AGENT_OUTPUT, PWCLI_AGENT_TARGET_URL and PWCLI_AGENT_SKILL_PATH are required",
  );
}

const prompt = `${readFileSync(taskFile, "utf8")}

固定约束：

- 使用 \`Read\` 读取 skill 文件：\`${skillPath}\`
- 只使用 \`pw\` 命令完成任务，不要写代码，不要修改仓库文件
- 允许使用 Bash 执行 \`pw\`、\`cat\`、\`rg\`、\`ls\`
- 登录账号：\`qa@example.com\`
- 登录密码：\`pwcli-secret\`
- 目标页面：\`${targetUrl}\`
- 最终不要把 JSON 写到文件，直接返回 JSON
- steps 必须按执行顺序列出，至少写 command 或 action
- evidence 只列关键证据，不要堆长文本
`;

const schema = readFileSync(resolve("test/e2e/agent-output.schema.json"), "utf8");
const tmpDir = mkdtempSync(join(tmpdir(), "pwcli-agent-claude-"));
const rawOutputPath = join(tmpDir, "claude-result.json");

try {
  const result = spawnSync(
    "claude",
    [
      "-p",
      "--output-format",
      "json",
      "--dangerously-skip-permissions",
      "--allowedTools",
      "Read Bash",
      "--json-schema",
      schema,
      prompt,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8,
    },
  );

  if (result.status !== 0) {
    throw new Error(`claude runner failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }

  writeFileSync(rawOutputPath, result.stdout, "utf8");
  const envelope = JSON.parse(result.stdout);
  const payload = envelope.structured_output ?? JSON.parse(envelope.result);
  const usage = envelope.usage ?? {};
  const tokenUsage =
    Number(usage.input_tokens ?? 0) +
    Number(usage.output_tokens ?? 0) +
    Number(usage.cache_creation_input_tokens ?? 0) +
    Number(usage.cache_read_input_tokens ?? 0);

  const summary = {
    ...payload,
    skillPath,
    tokenUsage,
    runner: {
      provider: "claude",
      model: envelope.model ?? null,
      durationMs: envelope.duration_ms ?? null,
      sessionId: envelope.session_id ?? null,
      totalCostUsd: envelope.total_cost_usd ?? null,
    },
  };

  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  if (summary.status !== "passed") {
    process.exit(1);
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

---
doc_type: evaluation
slug: command-eval-batch-code-dashboard-skill-sse
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, batch, code, dashboard, skill, sse]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-batch-code-dashboard-skill-sse
---

# Command Evaluation: Batch / Code / Dashboard / Skill / SSE

## 范围

本轮覆盖工具边界命令：

- `batch`
- `code`
- `dashboard open`
- `skill path`
- `skill install`
- `sse`

这些命令不是默认浏览器任务主链，而是 Agent 在确定性编排、复杂 escape hatch、人类观察、skill 分发和 SSE 诊断时使用的第二层能力。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `batch` | proven | 本轮 focused check 覆盖 `string[][]` stdin、`--include-results`、成功 summary、analysis warnings；`check:batch-verify` 覆盖 verify 失败传播；`batch-allowlist.test.ts` 覆盖 allowlist / blocklist |
| `code` | proven | route/mock/bootstrap focused check 已覆盖 inline、`--file`、`--retry`；本轮补充缺 session 失败 envelope |
| `dashboard open` | proven | `dashboard open --dry-run --output json` 证明 Playwright bundled dashboard entrypoint 可用；不把 dashboard 放进 Agent 自动化主链 |
| `skill path` | proven | `skill path --output json` 返回 packaged `skills/pwcli` 路径和 `SKILL.md` 存在 |
| `skill install` | proven | `pnpm check:skill-install` 证明 packaged skill 可安装到目标 skills dir |
| `sse` | proven | `scripts/test/sse-observation.test.ts` 覆盖 EventSource connect/open/message 捕获；network-console focused check 已覆盖 `--url` + `--limit` 查询 |

## focused check

本轮执行：

```bash
node dist/cli.js dashboard open --help
node dist/cli.js dashboard open --dry-run --output json
node dist/cli.js skill path --output json
pnpm check:batch-verify
pnpm check:skill-install
pnpm exec tsx scripts/test/batch-allowlist.test.ts
pnpm exec tsx scripts/test/sse-observation.test.ts
```

手工 batch 串联：

```bash
pw session create batchtool --no-headed --open 'data:text/html,...' --output json
printf '%s' '[["fill","--selector","#q","ok"],["click","--selector","#b"],["verify","text","--text","done:ok"]]' \
  | pw batch --session batchtool --stdin-json --include-results --output json
pw session close batchtool --output json
```

结果：

```text
batch summary: stepCount=3, successCount=3, failedCount=0
batch warnings: click changes page state; dependent verify may need explicit wait
dashboard dry-run: available=true, launched=false
skill path: /Users/xd/work/tools/pwcli/skills/pwcli
```

错误面验证：

```bash
pw batch --output json --stdin-json < /dev/null
printf '%s' '{"cmd":"fill"}' | pw batch --stdin-json --output json
pw code --session missingtool 'async page => 1' --output json
```

返回：

```text
BATCH_INPUT_REQUIRED
BATCH_INPUT_INVALID
SESSION_NOT_FOUND
```

## 关键发现

- `batch` 只承诺单 session 结构化 `string[][]` 稳定子集；`session` / `auth` / `environment` / `dialog` / diagnostics query 不进入 batch。
- `batch --stdin-json` 只说明 stdin 是 JSON，不代表输出 JSON；脚本断言必须显式加 `--output json`。
- `data.analysis.warnings` 能提示串行动作后缺显式 wait 的风险，这是 Agent 编排时的有用信号。
- `code` 是 Playwright escape hatch，不扩大为长流程 runner；复杂等待仍拆回一等命令和显式 `wait`。
- `dashboard open` 当前 shipped flags 是 `--dry-run` 和 `--output`。`codestable/architecture/commands/tools.md` 旧表误写 `--timeout`，本轮按源码/help 收敛为不支持。
- `skill` 只负责 packaged `pwcli` skill 分发，不是 plugin lifecycle 或外部 marketplace。
- `sse` 是 EventSource 观察，不替代通用 network；只能捕获 session 建立后创建的 EventSource。

## 后续

- 后续 workflow-eval 阶段需要把 `batch` 用在真实 Agent 自动化任务中，但不能把它升级成完整测试框架。
- `dashboard open` 后续只作为人类接管辅助，不作为 release gate 的必需自动化步骤。

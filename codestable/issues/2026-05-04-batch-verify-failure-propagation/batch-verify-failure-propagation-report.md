---
doc_type: issue-report
issue: 2026-05-04-batch-verify-failure-propagation
status: confirmed
severity: P1
summary: "batch 中 verify 的 passed=false 没有传播为 step failure，导致自动化测试假绿。"
tags:
  - batch
  - verify
  - automated-testing
  - command-contract
---

# batch verify failure 传播 Issue Report

## 1. 问题现象

Agent dogfood automated-testing 场景中，`pw batch --output json ...` 的 `results[].ok` 为 `true`、`summary.failedCount` 为 `0`，但嵌套的 `verify text` 返回 `data.passed=false`。这会让 Agent 或脚本误判自动化测试通过。

## 2. 复现步骤

1. `pnpm build`
2. 创建任意页面 session。
3. 执行 batch：`[["verify","text","--text","missing text"]]`
4. 观察到：batch exit 0，JSON envelope `ok=true`，但 verify 内部 `passed=false`。

复现频率：稳定复现。

## 3. 期望 vs 实际

**期望行为**：batch 内部 verify 失败时，该 step 必须失败；无 `--continue-on-error` 时 batch 必须返回 `BATCH_STEP_FAILED`。

**实际行为**：batch 把 verify 的 structured failure 当作成功 step。

## 4. 环境信息

- 涉及模块 / 功能：`pw batch`、`pw verify`
- 相关文件 / 函数：
  - `src/cli/batch/executor.ts`
  - `src/cli/commands/batch.ts`
  - `src/cli/commands/verify.ts`
- 运行环境：local dogfood
- Node：`v24.12.0`
- pnpm：`10.33.0`

## 5. 严重程度

**P1** — 自动化测试场景会假绿，破坏 Agent 对 batch 结果的信任。

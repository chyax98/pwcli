---
doc_type: issue-report
issue: 2026-05-04-trace-inspect-cli-resolution
status: confirmed
severity: P1
summary: "trace stop 生成 artifact 后，trace inspect 因 playwright-core CLI 路径解析错误失败。"
tags:
  - trace
  - diagnostics
  - evidence
  - command-contract
---

# trace inspect CLI 路径解析 Issue Report

## 1. 问题现象

Agent dogfood artifact 场景中：

```bash
pw trace stop -s artdog
pw trace inspect .pwcli/playwright/traces/trace-1777832767561.trace --section actions --limit 20
```

`trace stop` 成功输出 trace artifact，但 `trace inspect` 失败：

```text
ERROR TRACE_CLI_UNAVAILABLE
Playwright trace CLI is unavailable in the installed playwright-core package
```

错误 details 指向 `/Users/xd/work/tools/node_modules/playwright-core/...`，而当前项目实际依赖位于 `/Users/xd/work/tools/pwcli/node_modules/...`。

## 2. 复现步骤

1. `pnpm build`
2. `pw session create artdog --no-headed --open http://127.0.0.1:43287/login`
3. `pw trace stop -s artdog`
4. 使用输出的 trace artifact 执行 `pw trace inspect <trace> --section actions`

复现频率：稳定复现。

## 3. 期望 vs 实际

**期望行为**：`trace inspect` 使用当前安装包解析到的 `playwright-core` CLI，能读取 `trace stop` 输出的 artifact。

**实际行为**：`trace inspect` 从 `dist/engine/diagnose` 反推 package root 时多退了一层，查找父目录 node_modules，导致误报 `TRACE_CLI_UNAVAILABLE`。

## 4. 环境信息

- Node：`v24.12.0`
- pnpm：`10.33.0`
- `playwright-core`：`1.59.1`
- 相关文件：
  - `src/engine/diagnose/trace.ts`

## 5. 严重程度

**P1** — trace 是证据交接能力的一部分；artifact 已生成但不能被 CLI inspect，会破坏 Agent 诊断闭环。

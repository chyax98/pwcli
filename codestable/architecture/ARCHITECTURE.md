---
project: pwcli
updated: 2026-05-04
status: active
---

# pwcli Architecture Overview

**pwcli** 是 Agent-first Playwright CLI——AI Agent 的薄、可靠的浏览器命令层，基于 playwright-core，暴露浏览器事实、动作和失败证据，契约稳定。

## 层结构

```
src/
  cli/      — citty 命令解析、参数定义、输出格式化
  engine/   — Playwright 运行时、session 管理、workspace mutation
  store/    — 文件系统 I/O（artifacts、config、health、skill）
  auth/     — 内置认证 provider registry
```

**层边界规则：** `engine/` 不能 import `cli/`；`store/` 不能 import `engine/` 或 `cli/`；跨层用 `#engine/*`、`#cli/*`、`#store/*`、`#auth/*` 别名。

## 主链

```text
session create|attach|recreate
  → status/page/read-text/snapshot
  → action/wait/verify
  → diagnostics/trace/artifacts
  → Agent replans 或 pw code
```

## 关键文档

| 关注点 | 文档 |
|---|---|
| 文档治理规则 | [documentation-governance.md](documentation-governance.md) |
| 命令面全图 | [command-surface.md](command-surface.md) |
| 领域现状和限制 | [domain-status.md](domain-status.md) |
| workspace 写操作边界 | [workspace-mutation-contract.md](workspace-mutation-contract.md) |
| 浏览器任务状态模型 | [browser-task-state-model.md](browser-task-state-model.md) |
| ADR-001 Agent-first 命令和生命周期 | [adr-001-agent-first-command-and-lifecycle.md](adr-001-agent-first-command-and-lifecycle.md) |
| ADR-002 诊断和 mock 环境 | [adr-002-diagnostics-mock-environment.md](adr-002-diagnostics-mock-environment.md) |
| ADR-003 clock 边界 | [adr-003-environment-clock-boundary.md](adr-003-environment-clock-boundary.md) |
| E2E dogfood 测试计划 | [e2e-dogfood-test-plan.md](e2e-dogfood-test-plan.md) |
| E2E dogfood 体验报告 | [e2e-dogfood-experience-report.md](e2e-dogfood-experience-report.md) |
| v0.2.0 发布检查 | [release-v0.2.0.md](release-v0.2.0.md) |
| 命令 ADR 模板 | [commands/_template.md](commands/_template.md) |

## 使用教程

→ `skills/pwcli/` 是唯一使用教程真相，不在这里维护。

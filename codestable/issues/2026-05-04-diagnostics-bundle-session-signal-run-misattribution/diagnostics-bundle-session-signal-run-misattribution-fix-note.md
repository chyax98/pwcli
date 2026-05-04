---
doc_type: issue-fix
slug: diagnostics-bundle-session-signal-run-misattribution
status: fixed
severity: P1
created: 2026-05-04
tags: [diagnostics, bundle, evidence, agent-handoff]
---

# diagnostics bundle session signal run misattribution fix note

## 根因

`src/engine/diagnose/core.ts` 的 `buildDiagnosticsAuditConclusion` 先用 digest top signals 判断 `failureKind/failureSummary`，但 `failedAt/failedCommand` 和 `agentNextSteps` 固定来自 `latestRunEvents` 的最后事件。

当失败来自 session 级 console/network 信号，而 latest run 只是后续截图或 PDF 时，bundle 会把 handoff 指向最新成功 run。

## 修复

- 先判断 latest run 是否真的包含 `failed`、`failure` 或 `failureSignal`。
- 如果 latest run 有失败，沿用 run 级定位：`failedAt/failedCommand` 来自失败 run event，next steps 使用 `diagnostics show/grep --run`。
- 如果失败来自 digest top signal，使用代表性 signal 的 `timestamp/kind/summary`，`failedCommand=null`，next steps 改为 session 级 `diagnostics timeline/digest/export`。
- 如果没有强失败信号，`failedAt/failedCommand` 返回 `null`，避免成功 workflow 也出现“failed* 指向最新 run”的误读。

## 验证

```bash
pnpm build
pnpm exec tsx scripts/test/verify-failure-run.test.ts
pnpm exec tsx scripts/test/diagnostics-failure-run.test.ts
```

补充 Deep Bug dogfood 复验：

```text
bundle-fixed audit.status: failed_or_risky
bundle-fixed audit.failedAt: 2026-05-04T01:43:08.549Z
bundle-fixed audit.failedCommand: null
bundle-fixed audit.failureKind: console:error
bundle-fixed nextSteps: diagnostics timeline/digest/export --session wfbug02
```

## 同步

- 更新 `codestable/architecture/commands/diagnostics.md`。
- 更新 `skills/pwcli/references/command-reference-diagnostics.md`。
- 本问题由 `workflow-eval-deep-bug-reproduction` 暴露，评估文档同步记录。

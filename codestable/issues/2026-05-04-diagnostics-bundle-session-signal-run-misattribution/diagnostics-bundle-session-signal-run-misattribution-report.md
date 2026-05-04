---
doc_type: issue-report
slug: diagnostics-bundle-session-signal-run-misattribution
status: fixed
severity: P1
created: 2026-05-04
tags: [diagnostics, bundle, evidence, agent-handoff]
---

# diagnostics bundle session signal run misattribution report

## 现象

在 `workflow-eval-deep-bug-reproduction` 中，页面触发业务 500 和 `console.error` 后，Agent 又执行了截图。随后 `pw diagnostics bundle` 能识别 `failureKind=console:error` 和业务错误摘要，但 `auditConclusion.failedAt/failedCommand` 指向最后一次 `screenshot` run，`agentNextSteps` 也建议查看 screenshot run。

## 复现步骤

1. 启动 `scripts/e2e/dogfood-server.js`。
2. 登录后打开 `/app/projects/alpha/incidents/checkout-timeout/reproduce`。
3. 点击 `#trigger-bug`，触发 `/api/incidents/alpha/checkout-timeout/start` 500。
4. 执行 `pw screenshot ...`。
5. 执行 `pw diagnostics bundle -s <session> --out <dir> --output json`。

## 期望

对于 session 级 console/network/page error 信号：

- `failureKind` 和 `failureSummary` 来自代表性 top signal。
- `failedAt` 指向该信号时间。
- `failedCommand` 不伪装成最新成功 action。
- `agentNextSteps` 使用 session 级 `diagnostics timeline/digest/export`，不误导 Agent 去查最新成功 run。

对于 run 自身失败或 failureSignal：

- 继续指向对应 run，并使用 `diagnostics show/grep --run`。

## 实际

`failedAt/failedCommand` 总是来自 latest run 的最后事件。latest run 如果是 screenshot/pdf 等成功 artifact run，bundle handoff 会把证据定位带偏。

## 影响

P1。证据包仍能暴露失败信号，但 handoff 下一步错误，影响 Deep Bug 复现和 Agent 交接质量。

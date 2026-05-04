---
doc_type: issue_report
slug: smoke-diagnostics-session-signal-assertion
status: fixed
created: 2026-05-04
severity: P1
related_roadmap: pre-1-0-breakthrough
---

# Smoke Diagnostics Session Signal Assertion Report

## 现象

Pre-1.0 release gate 执行 `pnpm smoke` 失败在 `scripts/smoke/pwcli-smoke.sh` 的 diagnostics audit conclusion domain contract；修正首处后，后半段 diagnostics bundle audit conclusion 也暴露同类旧断言。

失败断言：

```text
assert.ok(conclusion.agentNextSteps.some((step) => step.includes('run-http-1')))
```

## 影响

这是 gate blocker：`pnpm smoke` 不能通过，阻止 `pre-1-0-release-gate` 收口。

## 根因

smoke 脚本断言仍沿用旧 contract：只要有 `latestRunId` 就要求 `agentNextSteps` 指向该 run。

当前 1.0 diagnostics bundle contract 已经修复过 session signal 与 run signal 的误归因：

- run event 自身失败时，next steps 指向 `diagnostics show|grep --run <runId>`。
- 只有 HTTP 500 / console error / page error 这类 session 级信号，且 latest run 没有失败时，next steps 指向 `diagnostics timeline|digest|export --session`，不能误导 Agent 去查最新成功 run。

本次 smoke 构造的是 session 级 `httpErrorCount=1` + latest run 普通 click event，因此应该断言 session next steps，不应该断言 `run-http-1`。

## 修复方向

更新 smoke 断言：

- `failedCommand === null`
- `agentNextSteps` 包含 `diagnostics timeline` 和 `audit-smoke`
- `agentNextSteps` 不包含 `run-http-1`
- 仍确认没有 `<latestRunId>` placeholder
- diagnostics bundle 场景同理：session 级 HTTP 404 归因不应指向 latest successful run id，应指向 session timeline/digest/export。

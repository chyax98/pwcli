---
doc_type: fix_note
slug: smoke-diagnostics-session-signal-assertion
status: fixed
created: 2026-05-04
severity: P1
related_roadmap: pre-1-0-breakthrough
---

# Smoke Diagnostics Session Signal Assertion Fix Note

## 修复内容

更新 `scripts/smoke/pwcli-smoke.sh` 中 diagnostics audit conclusion domain contract 的断言，使它匹配 1.0 evidence contract：

- session 级 HTTP error 归因时，`failedCommand` 应为 `null`。
- `agentNextSteps` 应走包含 `diagnostics timeline` 和 `audit-smoke` 的 session 级复查命令。
- `agentNextSteps` 不应包含 latest successful run id `run-http-1`。
- 继续检查不能泄漏 `<latestRunId>` placeholder。
- 后半段 diagnostics bundle smoke 同步改为 session 级 next steps：`failedCommand === null`、包含 `diagnostics timeline` + 当前 session name、不包含 `latestRunId`。

## 不做的事

- 不改 `buildDiagnosticsAuditConclusion` 产品逻辑。
- 不恢复“session signal 指向 latest run”的旧行为。
- 不为 smoke 写向后兼容分支。

## 验证

已在 `pre-1-0-release-gate` 中验证：

```bash
pnpm smoke
```

结果：pass。

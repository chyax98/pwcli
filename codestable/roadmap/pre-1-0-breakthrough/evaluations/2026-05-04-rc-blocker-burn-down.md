---
doc_type: evaluation
slug: rc-blocker-burn-down
status: completed
created: 2026-05-04
related_roadmap: pre-1-0-breakthrough
roadmap_item: rc-blocker-burn-down
result: pass-with-known-auth-blocker
---

# RC Blocker Burn Down

## 结论

Pre-1.0 暴露的内部 gate blocker 已修复并验证。当前可进入 `one-dot-zero-acceptance`。

剩余 P1 只有 `auth dc` 真实环境 proof blocker。它不是未解释 P1，而是正式记录的外部环境 / 真实材料 blocker；1.0 acceptance 不能把 `auth dc` 写成 proven，只能写成 blocked。

## Blocker 分类

| 类别 | 数量 | 状态 |
|---|---:|---|
| 未解释 P0 | 0 | pass |
| 未解释 P1 | 0 | pass |
| 已修复内部 P1 | 11 | pass |
| 外部环境 P1 blocker | 1 | `auth-dc-real-env-proof-blocked` |

## Pre-1.0 gate 新增问题

| issue | 严重级别 | 状态 | 验证 |
|---|---|---|---|
| `smoke-diagnostics-session-signal-assertion` | P1 | fixed | `pnpm smoke` pass |

根因：smoke 旧断言仍要求 session 级 HTTP signal 的 next steps 指向 latest successful run id。修复后保持 1.0 evidence contract：session 级信号走 `diagnostics timeline|digest|export --session`。

## 既有 P1 闭环

非 auth 的 P1 都有 fix-note，并已被 Pre-1.0 gate 或专项 check 覆盖：

- `batch-verify-failure-propagation`
- `diagnostics-bundle-session-signal-run-misattribution`
- `doctor-modal-recovery-contract`
- `environment-geolocation-contract-drift`
- `route-match-query-session-close`
- `run-code-timeout-cli-hang`
- `skill-packaged-path-resolution`
- `smoke-diagnostics-session-signal-assertion`
- `state-diff-storage-value-bucket`
- `trace-inspect-cli-resolution`
- `verify-failure-run-evidence`

专项 gate 证据：

- `pnpm smoke`
- `pnpm check:batch-verify`
- `pnpm check:env-geolocation`
- `pnpm check:trace-inspect`
- `pnpm check:doctor-modal`
- `pnpm check:run-code-timeout`
- `pnpm check:har-1-0`
- `pnpm check:skill-install`

## 1.0 contract freeze

冻结口径：

- lifecycle 主路仍是 `session create|attach|recreate`。
- `open` 只导航。
- `auth` 只执行内置 provider；`auth dc` 当前 blocked。
- `batch` 只承诺 single-session 结构化 `string[][]` 稳定子集。
- `diagnostics bundle` 1.0 manifest 为 `schemaVersion/session/createdAt/task?/commands/runIds/artifacts/summary`；`handoff.md` 是 Agent 交接入口。
- HAR 热录制不进入 1.0 supported contract；`har start|stop` 是 `UNSUPPORTED_HAR_CAPTURE` 失败 guard，`har replay|replay-stop` 是稳定回放面。
- `pw code` 是 escape hatch，不是长流程 runner；`RUN_CODE_TIMEOUT` 后拆回一等命令和显式 `wait`。

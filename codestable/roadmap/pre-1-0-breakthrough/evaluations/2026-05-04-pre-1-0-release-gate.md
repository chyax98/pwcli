---
doc_type: evaluation
slug: pre-1-0-release-gate
status: completed
created: 2026-05-04
related_roadmap: pre-1-0-breakthrough
roadmap_item: pre-1-0-release-gate
result: pass-with-known-auth-blocker
---

# Pre-1.0 Release Gate

## 结论

Pre-1.0 release gate 已通过。当前允许进入 `rc-blocker-burn-down`。

唯一保留的 P1 是既有外部环境 blocker：`auth dc` 真实环境 proof 未通过，已记录在 `codestable/issues/2026-05-04-auth-dc-real-env-proof-blocked/`，不能在 1.0 acceptance 中写成 proven。

## Gate 结果

| 命令 | 结果 |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm build` | pass |
| `pnpm smoke` | pass after smoke assertion fix |
| `pnpm check:skill` | pass |
| `pnpm check:batch-verify` | pass |
| `pnpm check:env-geolocation` | pass |
| `pnpm check:trace-inspect` | pass |
| `pnpm check:doctor-modal` | pass |
| `pnpm check:skill-install` | pass |
| `pnpm check:run-code-timeout` | pass |
| `pnpm check:har-1-0` | pass |
| `git diff --check` | pass |
| `npm pack --dry-run` | pass，tarball `@chyax/pwcli-0.2.0.tgz`，185 files |

## Gate 中发现并修复的问题

### `smoke-diagnostics-session-signal-assertion`

`pnpm smoke` 初次失败在 diagnostics audit conclusion 断言。根因不是产品回退，而是 smoke 脚本仍要求 session 级 HTTP signal 的 `agentNextSteps` 指向 latest successful run id。

当前 1.0 contract 是：

- run event 自身失败时，next steps 指向 `diagnostics show|grep --run <runId>`。
- 只有 HTTP 500/404、console error、page error 这类 session 级信号时，next steps 指向 `diagnostics timeline|digest|export --session`。

修复：

- 更新 `scripts/smoke/pwcli-smoke.sh` 的两处旧断言。
- 新增 issue report / fix note：`codestable/issues/2026-05-04-smoke-diagnostics-session-signal-assertion/`。
- 重跑 `pnpm smoke` 通过。

## 发布状态

Pre-1.0 gate 可以收口，但 1.0 仍不能直接发布，因为后续还有两个 roadmap item：

- `rc-blocker-burn-down`：确认 gate 暴露的新问题已闭环，并冻结 1.0 contract。
- `one-dot-zero-acceptance`：生成最终验收报告，明确每个 command、workflow、真实环境证据和已知 blocker。

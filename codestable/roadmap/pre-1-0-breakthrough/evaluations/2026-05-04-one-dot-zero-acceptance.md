---
doc_type: acceptance
slug: one-dot-zero-acceptance
status: completed
created: 2026-05-04
related_roadmap: pre-1-0-breakthrough
roadmap_item: one-dot-zero-acceptance
result: accepted-with-known-auth-blocker
---

# 1.0 Acceptance

## 最终结论

`pwcli` 1.0 上线冲刺目标已完成到可验收状态：Pre-1.0 已通过、RC blocker burn down 已完成、内部未解释 P0/P1 为 0、skills 和 CodeStable truth 已收口、每个 command 与核心 workflow 都有证据。

正式 1.0 发布时必须明确唯一剩余 blocker：

- `auth dc` 真实环境 proof：blocked
- blocker issue：`codestable/issues/2026-05-04-auth-dc-real-env-proof-blocked/auth-dc-real-env-proof-blocked-report.md`
- 不能写成 proven，直到有有效测试/RND URL、账号材料和可复验命令证据。

## 目标映射

| 目标 | 状态 | 证据 |
|---|---|---|
| 每个 command 深评 | pass-with-blocker | `pre-1-0-command-evaluation-matrix.yaml`：52 proven / 1 blocked |
| command 数量一致 | pass | `src/cli/commands/index.ts` 53 个 top-level command；matrix 53 行 |
| workflow 串联 | pass | browser automation、automated testing、form/file/download、crawler、Deep Bug、recovery/handoff、HAR replay evaluations |
| 竞品能力吸收 | pass | `sprint-capability-reference-survey`；本地 Agent-first 能力纳入 command/workflow/skill，云端/托管/无边界平台 dropped |
| 真实环境验证 | pass-with-blocker | real-env access map + `auth-dc-real-env-proof-blocked` issue |
| recovery breakthrough | pass | modal doctor、run-code-timeout、recovery handoff evaluations + checks |
| evidence bundle 1.0 | pass | `schemaVersion=1.0`、`handoff.md`、summary status、artifacts、commands、runIds |
| HAR/trace 1.0 decision | pass | HAR hot capture dropped from supported contract；HAR replay proven；trace inspect proven |
| skill SOP | pass | `skill-sop-1-0-audit` |
| CodeStable truth | pass | `codestable-truth-1-0-audit` |
| Pre-1.0 release gate | pass | `pre-1-0-release-gate` |
| RC blocker burn down | pass-with-auth-blocker | `rc-blocker-burn-down` |

## Command 状态

当前 command matrix：

- `proven`: 52
- `blocked`: 1
- `documented`: 0
- `dropped`: 0

Blocked command：

- `auth`：本地 `auth list/info/probe/fixture-auth` 已 proven；`auth dc` 真实环境 proof blocked。由于 top-level command matrix 以 command 为行，`auth` 整体按 blocked 处理，不能在 release note 中写成全量 proven。

## Release Gate 证据

已通过：

```bash
pnpm typecheck
pnpm build
pnpm smoke
pnpm check:skill
pnpm check:batch-verify
pnpm check:env-geolocation
pnpm check:trace-inspect
pnpm check:doctor-modal
pnpm check:skill-install
pnpm check:run-code-timeout
pnpm check:har-1-0
git diff --check
npm pack --dry-run
```

`npm pack --dry-run` 结果：tarball `@chyax/pwcli-0.2.0.tgz`，185 files，包含 `dist/`、`skills/pwcli/`、`README.md`、`package.json`。

## 1.0 Contract Freeze

冻结边界：

- `session create|attach|recreate` 是唯一 lifecycle 主路。
- `open` 只导航。
- `auth` 只执行内置 provider。
- `batch` 只承诺 single-session `string[][]` 稳定子集。
- `diagnostics bundle` 是 1.0 evidence bundle contract，`handoff.md` 是 Agent 交接入口。
- HAR 热录制不支持；`har start|stop` 返回 `UNSUPPORTED_HAR_CAPTURE`；`har replay|replay-stop` 支持预录制 HAR 回放。
- `pw code` 是 escape hatch，不是长流程 runner；长等待拆成一等命令和显式 `wait`。
- 不写逻辑向后兼容代码；只允许命令名称层面的清晰别名，内部实现保持唯一。

## 发布注意

正式发布 1.0 前如果要把 package version 从 `0.2.0` 提到 `1.0.0`，需要单独执行 release/version loop：

- 更新 `package.json` version。
- 跑 release gate。
- 生成 release note。
- 确认 `auth dc` 写为 blocked 或已解除 blocker 后 proven。

本 acceptance 不包含版本号 bump。

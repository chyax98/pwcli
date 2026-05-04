---
doc_type: evaluation
slug: codestable-truth-1-0-audit
status: completed
created: 2026-05-04
related_roadmap: pre-1-0-breakthrough
roadmap_item: codestable-truth-1-0-audit
result: pass-with-known-auth-blocker
---

# CodeStable Truth 1.0 Audit

## 目标

审计 CodeStable 是否仍是维护 truth：`architecture/` 只写现状，roadmap 写规划和执行状态，issues 写问题闭环，command docs 写当前 shipped contract 和证据状态。重点核对 HAR、auth blocker、route load、diagnostics bundle 1.0、session/open/auth/batch 边界。

## 结论

CodeStable truth 已对齐当前 Pre-1.0 状态，可以进入 `pre-1-0-release-gate`。唯一已知 P1 blocker 仍是 `auth dc` 真实环境 proof；它已在 command matrix、command ADR、domain-status、issue 和 roadmap evaluation 中保持 blocked，不伪装 proven。

## 审计与修正

| 检查项 | 结果 | 处理 |
|---|---|---|
| architecture active truth | pass | `ARCHITECTURE.md` 更新为当前 `status` 主链和内置 auth provider registry |
| 过程性架构文档 | pass | 删除已完成使命的 `cli-citty-design.md` 和 `refactor-v1-engine-first.md`，避免把旧执行方案当 active truth |
| HAR boundary | pass | `commands/diagnostics.md` 改为 `har start|stop` 明确失败 guard，`release-v0.2.0.md` 和 `.claude/rules/11` 同步 `UNSUPPORTED_HAR_CAPTURE` 表述 |
| auth dc evidence status | pass-with-blocker | `commands/session-advanced.md` 从 documented 改为 blocked；`domain-status.md` 增加真实环境 blocker |
| route load boundary | pass | `adr-002` 明确顶层 `pw route load` 不是 shipped command，只有 batch 内部 route load 子集 |
| diagnostics bundle 1.0 | pass | `commands/diagnostics.md` 已记录 `manifest.json`、`handoff.md`、`summary.status`、blocked bundle 边界 |
| real-env map | pass | 真实环境规则已回写到 `skills/pwcli/references/forge-dc-auth.md`、`commands/session-advanced.md` 和 auth blocker issue |

## 删除说明

删除的两个文件属于过程 / 执行方案，不再是当前系统地图：

- `codestable/architecture/cli-citty-design.md`
- `codestable/architecture/refactor-v1-engine-first.md`

当前稳定结论已经分布在：

- `codestable/architecture/ARCHITECTURE.md`
- `codestable/architecture/command-surface.md`
- `codestable/architecture/domain-status.md`
- `codestable/architecture/commands/*.md`
- `skills/pwcli/`

## 保留观察项

- `codestable/roadmap/pre-1-0-breakthrough/` 中旧 evaluation 和变更日志会保留历史过程表述，例如 HAR 初评为 limitation、auth 从 documented 往 proven 推进。当前 truth 以后续 `har-trace-1-0-decision`、`auth-dc-real-env-proof` blocker、command matrix 当前状态为准。
- `codestable/compound/` 里的竞品调研是 compound 沉淀，不是 shipped contract。
- `.claude/` 仍只作为 Claude Code 项目规则，不承载产品 truth；本轮只同步了与 HAR 后置项相关的规则措辞。

## 下一个入口

进入 `pre-1-0-release-gate`：按 roadmap release gate contract 跑基础 gate，并把失败分成 P0/P1 blocker、已记录 P2/P3、环境问题或脚本维护问题。

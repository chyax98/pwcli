---
doc_type: evaluation
slug: skill-sop-1-0-audit
status: completed
created: 2026-05-04
related_roadmap: pre-1-0-breakthrough
roadmap_item: skill-sop-1-0-audit
result: pass-with-known-auth-blocker
---

# Skill SOP 1.0 Audit

## 目标

把 `skills/pwcli/` 从命令说明审成 Agent 操作手册：中文优先、主链可执行、限制不伪装、恢复有 SOP、证据交接可延续，并覆盖 1.0 前逐 command 深评和 workflow 串联结论。

## 审计结论

`skills/pwcli/` 已满足 Pre-1.0 SOP 要求，可以进入 CodeStable truth audit。`auth dc` 真实环境仍是已记录 P1 blocker，skill 不把它写成 proven。

| 检查项 | 结果 | 证据 |
|---|---|---|
| top-level command 覆盖 | pass | `src/cli/commands/index.ts` 53 个 command；`pre-1-0-command-evaluation-matrix.yaml` 53 行 |
| 主 SOP 边界 | pass | `SKILL.md` 明确 `session create|attach|recreate`、`open`、`auth`、`batch` 边界 |
| workflow 矩阵 | pass | `references/workflows.md` 补齐浏览器自动化、测试、填表/文件、爬取、Deep Bug、恢复交接、HAR replay 7 类任务 |
| evidence bundle / handoff | pass | `SKILL.md`、`command-reference-diagnostics.md`、`workflows/diagnostics.md` 均描述 `diagnostics bundle --task`、`manifest.json`、`handoff.md` |
| HAR 1.0 边界 | pass | 诊断参考改为 `Trace / HAR replay 边界`，`har start|stop` 明确 `UNSUPPORTED_HAR_CAPTURE` |
| failure recovery 中文优先 | pass | `failure-recovery.md` 增加中文恢复总则和快速分流，并将结构标签中文化 |
| route load 漂移 | pass | skill 明确顶层 `pw route` 只有 `add|remove|list`；batch 内部 route 子集单独归 advanced reference |
| Forge/DC auth | pass-with-blocker | `forge-dc-auth.md` 和主 skill 说明 `dc` provider 主路；真实 proof blocker 见 issue |

## 本轮文档改动

- `references/workflows.md`：补 1.0 任务矩阵，明确每条 workflow 必须以验证和证据收口。
- `references/command-reference-diagnostics.md`：把 HAR 文案从“录制”收紧为 trace 证据和 HAR replay 边界。
- `domains/diagnostics.md`：避免把 HAR 热录制写成 diagnostics 的稳定 contract。
- `references/failure-recovery.md`：新增恢复总则、快速分流表，结构标签中文化。

## 保留限制

- `auth dc`：仍为正式 blocker，不能写成 proven。解除 blocker 后必须按 `real-agent-task-matrix` 里的最短复验命令重新证明。
- HAR 热录制：不进入 1.0 supported contract；后续如要做，只能另起设计，从 `session create --record-har <path>` 这类创建期 contract 重新定义，不能把热录制塞回 `har start|stop`。
- `pw code`：仍是 escape hatch，不是长流程 runner；`RUN_CODE_TIMEOUT` 后必须拆成一等命令和显式 `wait`。

## 后续入口

下一 loop 是 `codestable-truth-1-0-audit`：检查 `codestable/architecture/`、roadmap、issues、command docs 是否和当前 skill / command matrix 一致，特别是 HAR、auth blocker、route load、diagnostics bundle 1.0 contract 和 release gate。

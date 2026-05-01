# Docs

`docs/` 只展示架构、限制、扩展方向、命令面审计和发布检查。命令怎么用，只看 [`skills/pwcli/`](../skills/pwcli/)。

## 入口

| 目标 | 读这里 |
|---|---|
| 快速理解文档结构 | [`architecture/README.md`](architecture/README.md) |
| 判断文档该放哪里 | [`architecture/documentation-governance.md`](architecture/documentation-governance.md) |
| 看当前领域实现和限制 | [`architecture/domain-status.md`](architecture/domain-status.md) |
| 看当前命令能力面 | [`architecture/command-surface.md`](architecture/command-surface.md) |
| 看已接受架构决策 | [`architecture/adr-001-agent-first-command-and-lifecycle.md`](architecture/adr-001-agent-first-command-and-lifecycle.md)、[`architecture/adr-002-diagnostics-mock-environment.md`](architecture/adr-002-diagnostics-mock-environment.md) |
| 看 future workspace mutation contract | [`architecture/workspace-mutation-contract.md`](architecture/workspace-mutation-contract.md) |
| 看 dogfood 验证策略和结论 | [`architecture/e2e-dogfood-test-plan.md`](architecture/e2e-dogfood-test-plan.md)、[`architecture/e2e-dogfood-experience-report.md`](architecture/e2e-dogfood-experience-report.md) |
| 看 clock 技术结论 | [`architecture/environment-clock-survey.md`](architecture/environment-clock-survey.md) |
| 看 v0.1.0 发布检查 | [`architecture/release-v0.1.0.md`](architecture/release-v0.1.0.md) |

## 目录策略

- `architecture/README.md`：架构文档索引和阅读顺序。
- `architecture/documentation-governance.md`：文档边界和更新规则。
- `architecture/domain-status.md`：当前实现、限制、扩展口。
- `architecture/command-surface.md`：从 `src/app/commands` 和 CLI help 对齐的命令能力地图。
- `architecture/adr-*.md`：已接受决策。
- `architecture/*-contract.md`：已定边界但未必进入主线的 contract。
- `architecture/e2e-*`：dogfood 验证策略和经验结论。
- `architecture/*-survey.md`：只保留已吸收为架构事实的调研结论。
- `architecture/release-*.md`：发布前必须满足的检查项和阻断项。

## 不放这里

- 命令教程：放 `skills/pwcli/`。
- 过程计划、草案、迁移记录、review 笔记：不进入 docs；需要跟踪时放 GitHub issues / PR，本地临时内容放 gitignored local/cache 路径。
- Agent 项目规则、review 规则、skill 维护规则：放 `.claude/`。

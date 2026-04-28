# Docs

`docs/` 只展示架构、限制、扩展方向和验证体系。命令怎么用，只看 [`skills/pwcli/`](../skills/pwcli/)。

## 入口

| 目标 | 读这里 |
|---|---|
| 快速理解文档结构 | [`architecture/README.md`](architecture/README.md) |
| 判断文档该放哪里 | [`architecture/documentation-governance.md`](architecture/documentation-governance.md) |
| 看当前领域实现和限制 | [`architecture/domain-status.md`](architecture/domain-status.md) |
| 看已接受架构决策 | [`architecture/adr-001-agent-first-command-and-lifecycle.md`](architecture/adr-001-agent-first-command-and-lifecycle.md)、[`architecture/adr-002-diagnostics-mock-environment.md`](architecture/adr-002-diagnostics-mock-environment.md) |
| 看 future workspace mutation contract | [`architecture/workspace-mutation-contract.md`](architecture/workspace-mutation-contract.md) |
| 看 dogfood 验证策略和结论 | [`architecture/e2e-dogfood-test-plan.md`](architecture/e2e-dogfood-test-plan.md)、[`architecture/e2e-dogfood-experience-report.md`](architecture/e2e-dogfood-experience-report.md) |
| 看 clock 技术结论 | [`architecture/environment-clock-survey.md`](architecture/environment-clock-survey.md) |

## 目录策略

- `architecture/README.md`：架构文档索引和阅读顺序。
- `architecture/documentation-governance.md`：文档边界和更新规则。
- `architecture/domain-status.md`：当前实现、限制、扩展口。
- `architecture/adr-*.md`：已接受决策。
- `architecture/*-contract.md`：已定边界但未必进入主线的 contract。
- `architecture/e2e-*`：dogfood 验证策略和经验结论。
- `architecture/*-survey.md`：只保留已吸收为架构事实的调研结论。

## 不放这里

- 命令教程：放 `skills/pwcli/`。
- 过程计划、草案、迁移记录、review 笔记：放 `.claude/` 本地归档。
- Codex 项目维护规则：放 `.codex/`。

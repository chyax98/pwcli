# Compound 知识入口

`compound/` 保存已经沉淀的长期知识，不保存过程记录。

## 类型

| 类型 | 含义 |
|---|---|
| `decision` | 已拍板的约束、约定或技术选择 |
| `learning` | dogfood、修复或验证后沉淀的经验 |
| `explore` | 外部参考或调研后的稳定结论 |

## 当前文档

| 文档 | 类型 | 说明 |
|---|---|---|
| `2026-05-04-decision-agent-driven-validation-strategy.md` | decision | Agent 驱动验证策略 |
| `2026-05-04-decision-chinese-first-docs-and-skills.md` | decision | 中文优先文档与 skill |
| `2026-05-04-decision-no-logical-backward-compatibility.md` | decision | 不写逻辑向后兼容实现 |
| `2026-05-04-decision-node24-pnpm10-baseline.md` | decision | Node 24 与 pnpm 10+ 基线 |
| `2026-05-04-learning-coordinate-mouse-needs-state-verification.md` | learning | 坐标级 mouse 动作后必须复查状态 |
| `2026-explore-agent-browser-landscape.md` | explore | Agent 浏览器生态参考 |
| `2026-explore-competitive-analysis-agent-browser.md` | explore | Agent Browser 竞品差异参考 |

## 维护规则

- 新增文件必须有 frontmatter，至少包含 `doc_type`、`status`、`summary`。
- 不写路线图、issue 候选、修复流水或临时评测。
- 如果结论会影响命令 contract，必须同步 `codestable/architecture/commands/` 或 `skills/pwcli/`。

# Domain Guides

`domains/*.md` 只解释 command domain 的边界、误用和决策规则，不是第二套 command reference。

分工：

- `SKILL.md`：80% 高频主链和路由。
- `references/command-reference*.md`：参数、flag、输出 envelope、精确命令口径。
- `workflows/*.md`：任务链路和成功判据。
- `domains/*.md`：领域边界、常见误用、恢复方向。

## 目录

- [session.md](session.md)
- [workspace-observe.md](workspace-observe.md)
- [interaction.md](interaction.md)
- [state-auth.md](state-auth.md)
- [diagnostics.md](diagnostics.md)
- [environment-bootstrap.md](environment-bootstrap.md)
- [mock-controlled-testing.md](mock-controlled-testing.md)
- [code-escape-hatch.md](code-escape-hatch.md)

## 使用规则

1. 先从 `SKILL.md` 找主链。
2. 参数细节回 `references/command-reference*.md`。
3. 场景链路回 `workflows/*.md`。
4. 只有需要判断“这个领域负责什么、不能怎么用、失败怎么升级”时，再读 domain guide。

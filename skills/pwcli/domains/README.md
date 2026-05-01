# Domain Guides

这些文档是 `pwcli` 的**详细领域说明**。

分工：

- `SKILL.md`
  - 高频入口和硬规则
- `references/command-reference*.md`
  - 参数、flag、输出 envelope、精确命令口径
- `domains/*.md`
  - 每个 command domain 的详细说明：目的、模型、工作流、边界、限制、恢复路径

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
2. 需要精确参数时回 `references/command-reference*.md`。
3. 需要理解一个领域到底该怎么用、怎么和其他领域配合、哪里不能乱用，再读这里。
4. 这里是详细说明，不是第二套 command reference。参数真相仍以 `references/command-reference*.md` 和源码为准。

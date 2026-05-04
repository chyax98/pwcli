---
paths:
  - "skills/pwcli/**/*.md"
  - "README.md"
  - "AGENTS.md"
  - "CLAUDE.md"
  - ".claude/**/*.md"
---

# Skill 和文档

## 真相分工

- `skills/pwcli/`：Agent 使用 SOP。
- CLI help：精确参数、flag、输出、错误码。
- `README.md`：仓库入口。
- `.claude/`：Claude Code 本地规则。
- `AGENTS.md` / `CLAUDE.md`：仓库维护规则，内容必须一致。

## Skill 规则

- 中文优先。
- 写任务链路，不写完整命令百科。
- 每个浏览器命令示例都带 `-s <session>` 或 `--session <session>`。
- 不写项目历史、迁移说明、roadmap、账号、token、业务域名或测试凭据。
- 不把 limitation 写成已支持能力。
- 命令行为和 skill 冲突时，以 source / CLI help 为准，并修正 skill。

## 文档清理规则

删除或改写：

- 过程 plan
- 旧调研
- 历史 issue / fix-note 文件
- 过期 roadmap 文本
- `skills/pwcli/` 外的重复教程
- 指向已删除路径的链接

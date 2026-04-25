---
name: pwcli
description: Use pw to run Playwright-native browser workflows, inspect packaged skill paths, and install the skill for agent use.
---

# pwcli

优先使用 `pw`，不要直接调用底层脚本路径。

当前稳定入口：

```bash
pw --help
pw skill path
pw skill install .claude/skills
```

设计原则：
- 默认走 Playwright Core 原生能力。
- `pw code` 是一级能力，不是补洞命令。
- 私有层必须先经过项目级审查。

项目规范见 `.claude/project/`。

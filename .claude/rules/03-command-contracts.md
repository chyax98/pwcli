---
paths:
  - "src/cli/**/*.ts"
  - "src/engine/**/*.ts"
  - "skills/pwcli/**/*.md"
  - "AGENTS.md"
  - "CLAUDE.md"
---

# 命令契约

## 硬边界

- `session create|attach|recreate` 是唯一 lifecycle 主路。
- `open` 只导航已有 session。
- `auth` 只执行内置 provider，不创建 session，不改变 browser shape。
- `batch` 只接收结构化 `string[][]` 和稳定子集。
- `locate|get|is|verify` 是 read-only 检查，不是 action planner。
- `code` 是逃生口，不是长流程 runner。

## 输出和错误

Agent-readable 输出必须紧凑、可执行。

动作或失败输出保留：

- command
- session
- page identity（如果有）
- target summary
- stable reason code
- diagnostics delta 或 evidence pointer
- run/artifact pointer（如果有）
- 具体下一步命令

JSON 输出必须保持脚本可读，不随意改变 envelope shape。

## 同步

命令、flag、default、错误码、输出或恢复路径变化时：

1. 更新 CLI help / source。
2. 更新 `skills/pwcli/`。
3. 产品边界变化时更新 `AGENTS.md` 和 `CLAUDE.md`。

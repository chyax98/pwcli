# Codex Project Surface

`pwcli` 只用 Codex 维护和开发。

这里放项目级 Codex 配置和维护规则。个人模型 provider、认证、MCP token 继续放用户级 `~/.codex/config.toml`，不要提交进仓库。

## 文件

| 文件 | 职责 |
|---|---|
| `config.toml` | 项目默认模型、reasoning、review policy、环境继承策略 |
| `review-guidelines.md` | Codex PR review 的项目特化 P0/P1 审查规则 |
| `skill-maintenance.md` | `skills/pwcli/` 的维护规则和同步检查单 |
| `skill-writing-standard.md` | `skills/pwcli/` 的写作分层、质量线、坏味道 |
| `auth-provider-authoring.md` | 内置 auth provider 的新增和维护规则 |

## 边界

- `AGENTS.md` 是所有 Agent 的执行契约。
- `.codex/` 是 Codex 项目配置和维护说明。
- `skills/pwcli/` 是唯一使用教程真相。
- `docs/` 只展示架构、限制、扩展方向和验证体系。
- `.claude/` 只保留本地过程归档，不再作为 active truth。

## 默认工作流

1. 读 `AGENTS.md`。
2. 读 `skills/pwcli/SKILL.md`。
3. 读 `docs/README.md` 和 `docs/architecture/documentation-governance.md`。
4. 改源码。
5. 按 [.codex/skill-maintenance.md](skill-maintenance.md) 同步 skill。
6. 如边界变化，同步 `docs/architecture/`。
7. 跑 `pnpm typecheck && pnpm build && pnpm smoke`。

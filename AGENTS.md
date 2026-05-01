# AGENTS.md

`pwcli` 是内部 Agent-first Playwright CLI。

开始改代码前，先认这三条真相：

1. 源码真相：`src/app` / `src/domain` / `src/infra`
2. 使用真相：`skills/pwcli/`
3. 架构真相：`docs/architecture/`
4. Codex 项目配置：`.codex/`

`.claude/` 只允许存放 agent 本地 scratch、临时上下文、工具缓存；不要放项目 planning、草案、survey、迁移记录。项目待办放 GitHub issues / PR，稳定结论写回 `skills/pwcli/`、`docs/architecture/` 或 ADR。

## 工作顺序

```text
1. 读 skills/pwcli/ 和 docs/architecture/
2. 读 `docs/architecture/documentation-governance.md`
3. 读 `.codex/skill-maintenance.md`
4. 改代码
5. 同步 skill
6. 同步 architecture docs（如果边界、限制、扩展方向有变化）
7. 做受影响的最小验证；最终发布/总验收才跑全量 smoke
```

## 结构

```text
src/
  app/
    commands/
    batch/
    output.ts
  domain/
  infra/
skills/
  pwcli/
docs/
  architecture/
.codex/
```

## 核心规则

- `session create|attach|recreate` 是唯一 lifecycle 主路
- `open` 只做导航
- `auth` 只做内置 auth provider 执行
- `batch` 只走结构化 `string[][]`
- skill 是唯一教程真相
- docs 只维护架构、限制、扩展方向
- `.codex` 只维护 Codex 项目配置和 skill 维护规则
- limitation code 不能包装成“已支持”

## 文件变更同步

| 改动 | 必须同步 |
|---|---|
| 命令、flag、错误码、输出变化 | `skills/pwcli/` |
| 领域边界变化 | `docs/architecture/` |
| 新 limitation / recoverability | `skills/pwcli/references/failure-recovery.md` |
| 新工作流 | `skills/pwcli/references/workflows.md` |
| Codex 项目策略 / skill 维护规则变化 | `.codex/` |

## 验证

日常改动优先：

```bash
pnpm build
pw <affected-command> ...
```

规则：

- alias 已经是 `pw`；构建后直接用 `pw` 做真实、针对性的命令验证。
- 不默认跑 `pnpm smoke` / 全量 gate。
- 最终发布、合并前总验收，或用户明确要求时，才跑全量测试。
- 类型风险明显时再补 `pnpm typecheck`。

## Review guidelines

Codex review 只报告可验证的 P0/P1 问题。详细规则见 [`.codex/review-guidelines.md`](.codex/review-guidelines.md)。

必须优先检查：

1. workspace 写操作是否违反 stable identity contract
2. session lifecycle / open / auth / batch 边界是否漂移
3. 命令、flag、错误码、输出、workflow 变化是否同步 `skills/pwcli/`
4. 领域边界变化是否同步 `docs/architecture/`
5. 行为变更是否有 `pnpm typecheck`、`pnpm build`、`pnpm smoke` 或等价覆盖

## 禁忌

- 不要恢复兼容命令
- 不要再写第二套使用教程
- 不要把历史 plan 当 active truth
- 不要为了统一而重写 Playwright 已覆盖的 primitive

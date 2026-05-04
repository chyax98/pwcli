# AGENTS.md

`pwcli` 是内部 Agent-first Playwright CLI。

开始改代码前，先认这三条真相：

1. 源码真相：`src/cli` / `src/engine` / `src/store` / `src/auth`
2. 使用真相：`skills/pwcli/`
3. 架构真相：`codestable/architecture/`
4. Claude Code 项目规则：`.claude/`

`.claude/` 只允许存放 Claude Code 官方项目配置、`CLAUDE.md`、`rules/` 和本地开发 slash `commands/`。不要放过程 planning、草案、survey、迁移记录、工具缓存或 active project truth。项目待办放 GitHub issues / PR，稳定结论写回 `skills/pwcli/`、`codestable/architecture/` 或 ADR。

## 工作顺序

```text
1. 读 skills/pwcli/ 和 codestable/architecture/
2. 读 `codestable/architecture/documentation-governance.md`
3. 读 `.claude/CLAUDE.md` 和 `.claude/rules/`
4. 改代码
5. 同步 skill
6. 同步 architecture docs（如果边界、限制、扩展方向有变化）
7. 做受影响的最小验证；最终发布/总验收才跑全量 smoke
```

## 结构

```text
src/
  cli/
    commands/
    batch/
    output.ts
  engine/
  store/
  auth/
skills/
  pwcli/
codestable/
  architecture/
  compound/
test/
  unit/
  integration/
  contract/
  smoke/
  e2e/
  fixtures/
  app/
  benchmark/
.claude/
```

## 核心规则

- `session create|attach|recreate` 是唯一 lifecycle 主路
- `open` 只做导航
- `auth` 只做内置 auth provider 执行
- `batch` 只走结构化 `string[][]`
- skill 是唯一教程真相
- 项目文档中文优先；`skills/pwcli/` 作为核心产品面必须中文优先，英文只保留在命令、flag、错误码、API、路径、协议字段和必要引用里
- 本项目环境基线是 Node 24 + pnpm 10+（以 `package.json` 为准）；Volta/proto 等版本管理导致的环境预检差异不要用产品补丁强行绕过
- 永远不要写逻辑向后兼容代码；只允许命令名称层面的 Agent 友好别名，内部实现必须唯一、清晰、直接
- docs 只维护架构、限制、扩展方向
- `.claude` 只维护 Claude Code 项目指令、规则和本地开发 slash commands，不承载项目文档或 backlog
- limitation code 不能包装成“已支持”

## 文件变更同步

| 改动 | 必须同步 |
|---|---|
| 命令、flag、错误码、输出变化 | `skills/pwcli/` |
| 命令 surface / README 示例变化 | `README.md` |
| 领域边界变化 | `codestable/architecture/` |
| 新 limitation / recoverability | `skills/pwcli/references/failure-recovery.md` |
| 新工作流 | `skills/pwcli/references/workflows.md` |
| Agent 项目规则 / review / skill 维护规则变化 | `.claude/` |

## 验证

日常改动优先：

```bash
pnpm build
pw <affected-command> ...
```

规则：

- 验证前先确认当前 shell 在 Node 24 + pnpm 10+ 基线内。
- alias 已经是 `pw`；构建后直接用 `pw` 做真实、针对性的命令验证。
- 不默认跑 `pnpm smoke` / 全量 gate。
- 最终发布、合并前总验收，或用户明确要求时，才跑全量测试。
- 类型风险明显时再补 `pnpm typecheck`。
- 深度产品验证以 Agent 按 `skills/pwcli/` 真实 dogfood 为主；脚本 E2E 只作基础回归、fixture 或特定 contract 辅助，不把修脚本当默认最高优先级。
- 测试资产统一放 `test/`；命令/skill 专项契约验证放 `test/contract/`，仓库不保留独立 `scripts/` 测试入口。

## Review guidelines

代码审查只报告可验证的 P0/P1 问题。详细规则见 [`.claude/rules/10-review-guidelines.md`](.claude/rules/10-review-guidelines.md)。

必须优先检查：

1. workspace 写操作是否违反 stable identity contract
2. session lifecycle / open / auth / batch 边界是否漂移
3. 命令、flag、错误码、输出、workflow 变化是否同步 `skills/pwcli/`
4. 领域边界变化是否同步 `codestable/architecture/`
5. Agent 可用性增强是否有真实任务/issue/dogfood 证据，不把 P2/P3 后置项伪装成正式版 blocker
6. 行为变更是否有 `pnpm typecheck`、`pnpm build`、`pnpm smoke` 或等价覆盖

## 禁忌

- 不要恢复兼容命令
- 不要再写第二套使用教程
- 不要把历史 plan 当 active truth
- 不要为了统一而重写 Playwright 已覆盖的 primitive

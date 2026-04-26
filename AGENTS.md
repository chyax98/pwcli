# AGENTS.md

`pwcli` 是内部 Agent-first Playwright CLI。

开始改代码前，先认这三条真相：

1. 源码真相：`src/app` / `src/domain` / `src/infra`
2. 使用真相：`skills/pwcli/`
3. 架构真相：`docs/architecture/`

历史 planning、草案、迁移记录都在 `.claude/archive/`，不再回写 active contract。

## 工作顺序

```text
1. 读 skills/pwcli/ 和 docs/architecture/
2. 改代码
3. 同步 skill
4. 同步 architecture docs（如果边界、限制、扩展方向有变化）
5. 跑 typecheck/build/smoke
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
```

## 核心规则

- `session create|attach|recreate` 是唯一 lifecycle 主路
- `open` 只做导航
- `auth` 只做 plugin 执行
- `batch` 只走结构化 `string[][]`
- skill 是唯一教程真相
- docs 只维护架构、限制、扩展方向
- limitation code 不能包装成“已支持”

## 文件变更同步

| 改动 | 必须同步 |
|---|---|
| 命令、flag、错误码、输出变化 | `skills/pwcli/` |
| 领域边界变化 | `docs/architecture/` |
| 新 limitation / recoverability | `skills/pwcli/references/failure-recovery.md` |
| 新工作流 | `skills/pwcli/references/workflows.md` |

## 验证

优先跑：

```bash
pnpm typecheck
pnpm build
pnpm smoke
```

## 禁忌

- 不要恢复兼容命令
- 不要再写第二套使用教程
- 不要把历史 plan 当 active truth
- 不要为了统一而重写 Playwright 已覆盖的 primitive

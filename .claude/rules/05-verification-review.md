# 验证和 Review

## 验证

使用能覆盖风险的最小验证。

日常：

```bash
pnpm build
node dist/cli.js --help
pw <affected-command> ...
```

默认 gate：

```bash
pnpm check
```

发布 / 总验收：

```bash
pnpm check
pnpm smoke
git diff --check
pnpm pack:check
```

改到 lifecycle/session wiring、命令注册、batch、action evidence、diagnostics 或发布准备时，跑完整 smoke。

## Review 立场

只报告可验证的 P0/P1 问题。

优先检查：

1. workspace mutation stable identity
2. session/open/auth/batch 边界漂移
3. command/flag/output/error 漂移
4. skill、README、AGENTS、CLAUDE 同步
5. recoverability 和 limitation 是否诚实
6. 验证覆盖是否足够

纯风格问题不报，除非它改变 active contract 或误导后续 Agent。

## Git 规则

- 接住已有用户改动。
- 不回滚无关文件。
- 除非用户明确要求，不用破坏性 git 命令。

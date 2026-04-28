# pwcli Skill Maintenance

`skills/pwcli/` 是唯一使用教程真相。任何命令、flag、错误码、输出、工作流、限制变化，都必须先让 skill 能教会下一个 Agent。

## 必改矩阵

| 变更 | 必改 |
|---|---|
| 新命令 / 删除命令 / 命令语义变化 | `skills/pwcli/SKILL.md`、对应 `skills/pwcli/references/command-reference*.md` |
| flag、参数、默认值变化 | 对应 command reference；主链变化再改 `SKILL.md` |
| error code、blocked state、recoverability 变化 | `skills/pwcli/references/failure-recovery.md` |
| 高频使用路径变化 | `skills/pwcli/references/workflows.md`，必要时同步 `skills/pwcli/workflows/*.md` |
| Forge/DC auth 变化 | `skills/pwcli/references/forge-dc-auth.md` |
| 架构边界、限制、扩展口变化 | `docs/architecture/domain-status.md` 或 ADR |
| 文档边界变化 | `docs/architecture/documentation-governance.md` |

## 更新顺序

1. 从源码确认 shipped contract：`src/app`、`src/domain`、`src/infra`。
2. 更新最小必要 skill 文件。
3. 如果新增 limitation，写清楚触发条件、可恢复路径、不能包装成已支持。
4. 如果是新工作流，写成可执行命令序列，不写长篇教程。
5. 如果改变领域边界，同步 `docs/architecture/`。
6. 跑验证：`pnpm typecheck`、`pnpm build`、`pnpm smoke`。

## 写法

- 主入口 `SKILL.md` 只放最高频路径和硬规则。
- command reference 放完整参数口径。
- workflow 放任务链路，不重复完整命令百科。
- failure recovery 放错误码、阻断状态、恢复升级路径。
- docs 不重复 skill 教程。

## 禁止

- 不把 `.claude/archive/**` 的历史 plan 当 active truth。
- 不新增第二套使用教程。
- 不用“已支持”包装 limitation code。
- 不为了统一文档而改动没有真实收益的命令 contract。
- 不提交个人 provider、token、cookie、session state。

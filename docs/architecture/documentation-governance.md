# Documentation Governance

更新时间：2026-04-30
状态：active

这份文档定义 `pwcli` 的文档边界、真相优先级、归档规则。

## 1. 目标

文档只解决 4 件事：

1. Agent 怎么稳定使用 `pwcli`
2. 当前架构怎么组织
3. 每个领域已经做到什么程度
4. 有哪些明确限制、折衷、扩展口

过程草案、迁移记录、评审笔记、survey 细稿不进入最终文档面。

## 2. 真相优先级

1. **源码真相**
   - `src/app`
   - `src/domain`
   - `src/infra`
2. **使用真相**
   - `skills/pwcli/`
3. **架构真相**
   - `docs/architecture/`
4. **仓库入口**
   - `README.md`
5. **贡献约束**
   - `AGENTS.md`
6. **Agent 项目规则**
   - `.claude/`

如果文档和源码冲突，以源码和已通过验证的 shipped contract 为准。

## 3. 文档职责

### `README.md`

只做仓库入口：

- 工具定位
- 主链示例
- 核心限制
- 真相入口索引

不要在这里铺完整命令教程。

### `skills/pwcli/`

这是唯一使用教程真相。

这里维护：

- 主入口 `SKILL.md`
- `command-reference.md`
- `workflows.md`
- `failure-recovery.md`
- `rules/`

所有命令、flag、错误码、输出 envelope、恢复路径变化，先同步这里。

### `docs/architecture/`

这里只维护最终架构文档：

- ADR
- 领域现状
- 限制和折衷
- E2E 设计与体验结论
- 文档治理规则

不要在这里重复命令教程。

### `.claude/`

这是 Claude Code 官方项目配置面。

这里维护：

- `CLAUDE.md`
- `rules/*.md`
- 可共享的 Claude Code project settings（如未来需要）
- skill 维护规则
- review 规则
- auth provider authoring 规则

不要在这里放过程 planning、survey 原稿、迁移记录、review 笔记、工具缓存、项目 backlog 或 active project truth。机器本地配置继续使用 `settings.local.json` 或 gitignored local/cache 路径。

### `AGENTS.md`

只维护协作规则：

- 改代码前先看哪里
- 改完必须同步什么
- 验证顺序
- 禁忌

## 4. 允许提交的最终文档

当前允许长期维护的文档集合：

- `README.md`
- `AGENTS.md`
- `.claude/CLAUDE.md`
- `.claude/rules/**`
- `docs/README.md`
- `skills/pwcli/**`
- `docs/architecture/README.md`
- `docs/architecture/documentation-governance.md`
- `docs/architecture/command-surface.md`
- `docs/architecture/domain-status.md`
- `docs/architecture/adr-*.md`
- `docs/architecture/release-*.md`
- `docs/architecture/environment-clock-survey.md`
- `docs/architecture/workspace-mutation-contract.md`
- `docs/architecture/browser-task-state-model.md`
- `docs/architecture/e2e-dogfood-test-plan.md`
- `docs/architecture/e2e-dogfood-experience-report.md`

新增文档时，先判断是否属于这 4 类：

1. 使用教程
2. 架构决策
3. 领域现状
4. E2E 体系

挂不上就不该进最终文档面。

## 5. 过程信息规则

过程信息包括：

- planning
- survey 原稿
- review 笔记
- 迁移清单
- 临时问题拆解
- 草案版真相整理

- `.claude/` 只承载 Claude Code 项目指令和 rules；可以进入 git
- `.claude/settings.local.json`、`.claude/local/`、`.claude/tmp/`、`.claude/cache/` 不进入 git
- `.claude/` 不能作为项目规划、过程归档、迁移记录或 backlog 区
- backlog、推进记录、临时结论放 GitHub issues / PR
- 一旦决策稳定，必须吸收进 skill / ADR / `domain-status.md`
- 过程稿如果没有转化为正式结论，就直接删除，不做仓内长期保存

## 6. 不允许的重复

以下重复必须避免：

1. 在 `README.md` 和 `skills/pwcli/` 同时维护完整命令教程
2. 在 `docs/architecture/` 再写一套“如何使用”
3. 在 `.claude/` 里保留任何项目级 truth、归档或待办
4. 在多个位置维护同一 limitation 的不同表述

## 7. 更新流程

### 命令面变化

先改：

1. `src/app/commands/*`
2. `skills/pwcli/`

如有必要，再改：

3. `docs/architecture/domain-status.md`

同时检查：

4. `.claude/rules/08-skill-maintenance.md`

### 架构边界变化

先改：

1. 源码
2. `docs/architecture/*.md`

如涉及使用路径，再改：

3. `skills/pwcli/`

### 过程调研结束

做 3 步：

1. 把最终结论写进 ADR / domain-status / skill
2. 删除重复结论
3. 删除过程稿；如果需要保留项目信息，就转成 GitHub issue / PR、ADR 或正式 docs

### Agent 项目规则变化

只允许进入 `.claude/`：

1. `CLAUDE.md`
2. `rules/*.md`
3. 可共享且不含密钥的 Claude Code project settings（如未来需要）

个人配置继续留在用户级配置或 `.claude/settings.local.json`。

## 8. 当前明确结论

1. `skills/pwcli/` 是唯一使用教程真相
2. `docs/architecture/` 只放最终架构文档
3. `.claude/` 是项目级 Agent 规则入口，包含 Claude Code 指令、review 规则、skill 维护规则
4. `.claude/settings.local.json` 和 local/cache 内容 gitignore
5. 过程文档不再作为 shipped contract 的一部分

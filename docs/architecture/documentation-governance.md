# Documentation Governance

更新时间：2026-04-26  
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
- `skills/pwcli/**`
- `docs/architecture/README.md`
- `docs/architecture/documentation-governance.md`
- `docs/architecture/domain-status.md`
- `docs/architecture/adr-*.md`
- `docs/architecture/e2e-dogfood-test-plan.md`
- `docs/architecture/e2e-dogfood-experience-report.md`

新增文档时，先判断是否属于这 4 类：

1. 使用教程
2. 架构决策
3. 领域现状
4. E2E 体系

挂不上就不该进最终文档面。

## 5. 过程文档规则

过程文档包括：

- planning
- survey 原稿
- review 笔记
- 迁移清单
- 临时问题拆解
- 草案版真相整理

这些文件统一放在：

- `.claude/`

规则：

- `.claude/` 只做本地过程归档
- `.claude/` 不再进入 git
- 一旦决策已经吸收进 skill / ADR / domain-status，过程文档就停止作为正式依据

## 6. 不允许的重复

以下重复必须避免：

1. 在 `README.md` 和 `skills/pwcli/` 同时维护完整命令教程
2. 在 `docs/architecture/` 再写一套“如何使用”
3. 在 `.claude/` 里保留另一套 active truth
4. 在多个位置维护同一 limitation 的不同表述

## 7. 更新流程

### 命令面变化

先改：

1. `src/app/commands/*`
2. `skills/pwcli/`

如有必要，再改：

3. `docs/architecture/domain-status.md`

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
3. 把过程稿留在 `.claude/` 本地归档或直接删除

## 8. 当前明确结论

1. `skills/pwcli/` 是唯一使用教程真相
2. `docs/architecture/` 只放最终架构文档
3. `.claude/` 只做本地过程归档并 gitignore
4. 过程文档不再作为 shipped contract 的一部分

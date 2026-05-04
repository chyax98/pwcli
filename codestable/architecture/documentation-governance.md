# Documentation Governance

更新时间：2026-05-03
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
   - `src/cli/`、`src/engine/`、`src/store/`、`src/auth/`
2. **使用真相**
   - `skills/pwcli/`（怎么用）
3. **命令设计真相**
   - `codestable/architecture/commands/`（为什么这样设计，ADR，证据状态）
4. **架构真相**
   - `codestable/architecture/`（层边界、模块职责、重大决策）
5. **仓库入口**
   - `README.md`
6. **贡献约束**
   - `AGENTS.md`
7. **Agent 项目规则**
   - `.claude/`

`codestable/architecture/commands/` 是命令级别 ADR：记录设计决策、技术原理、使用证据和已知限制。任何命令变动必须同步更新对应文档（见 `.claude/rules/12-command-doc-maintenance.md`）。

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

这是 Agent 使用真相。

维护策略：

- `SKILL.md` 是外部讲解指令和路由引导，覆盖约 80% 高频命令使用。
- `SKILL.md` 不讲内部实现、源码结构、历史过程或调研结论；实现边界进 `codestable/architecture/`。
- 精确参数、flag、输出字段和错误码以当前 CLI `--help` 为准；skill 只维护任务路由、工作流和恢复 SOP。

这里维护：

- 主入口 `SKILL.md`
- `references/workflows.md`
- `references/failure-recovery.md`
- `references/forge-dc-auth.md`

命令、flag、错误码、输出 envelope 变化先同步 CLI help；高频工作流、恢复路径或 Forge/DC 使用规则变化再同步这里。

### `codestable/architecture/`

这里只维护最终架构文档：

- ADR
- 领域现状
- 限制和折衷
- E2E 设计与体验结论
- 文档治理规则

命令 ADR 在子目录 `codestable/architecture/commands/`。

不要在这里重复命令教程。

### `codestable/compound/`

调研产物（explore 类）、沉淀知识（learning 类）、技术技巧（trick 类）归入这里。

由 cs-explore / cs-learn / cs-trick 子技能维护。

### `.claude/`

这是 Claude Code 官方项目配置面。

这里维护：

- `CLAUDE.md`
- `rules/*.md`
- `commands/*.md`（本地开发 / docs / ship 的 Claude Code slash commands）

不要在这里放过程 planning、survey 原稿、迁移记录、review 笔记、工具缓存、项目 backlog 或 active project truth。

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
- `docs/README.md`（重定向入口）
- `skills/pwcli/**`
- `codestable/architecture/ARCHITECTURE.md`
- `codestable/architecture/documentation-governance.md`
- `codestable/architecture/command-surface.md`
- `codestable/architecture/domain-status.md`
- `codestable/architecture/adr-*.md`
- `codestable/architecture/release-*.md`
- `codestable/architecture/workspace-mutation-contract.md`
- `codestable/architecture/browser-task-state-model.md`
- `codestable/architecture/e2e-dogfood-test-plan.md`
- `codestable/architecture/e2e-dogfood-experience-report.md`
- `codestable/architecture/commands/_template.md`
- `codestable/architecture/commands/*.md`（命令 ADR）
- `codestable/compound/**`（explore / learning / trick / decision）

新增文档时，先判断是否属于这 4 类：

1. 使用教程
2. 架构决策
3. 领域现状
4. E2E 体系

挂不上就不该进最终文档面。新调研不能以 `*-survey.md` 形态长期提交；稳定结论必须改写为 ADR、decision note、domain-status 或 skill limitation。

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
2. 在 `codestable/architecture/` 再写一套"如何使用"
3. 在 `.claude/` 里保留任何项目级 truth、归档或待办
4. 在多个位置维护同一 limitation 的不同表述

## 7. 更新流程

### 命令面变化

先改：

1. `src/cli/commands/*`
2. `skills/pwcli/`

如有必要，再改：

3. `codestable/architecture/domain-status.md`

同时检查：

4. `.claude/rules/08-skill-maintenance.md`

### 架构边界变化

先改：

1. 源码
2. `codestable/architecture/*.md`

如涉及使用路径，再改：

3. `skills/pwcli/`

### 过程调研结束

做 3 步：

1. 把最终结论写进 ADR / domain-status / skill
2. 删除重复结论
3. 删除过程稿；如果需要保留项目信息，就转成 GitHub issue / PR、ADR 或正式 docs

## 8. 当前明确结论

1. `skills/pwcli/` 是唯一使用教程真相
2. `codestable/architecture/` 只放最终架构文档
3. `.claude/` 是项目级 Agent 规则入口，包含 Claude Code 指令、review 规则、skill 维护规则
4. `.claude/settings.local.json` 和 local/cache 内容 gitignore
5. 过程文档不再作为 shipped contract 的一部分
6. 调研文档归入 `codestable/compound/`（explore 类）

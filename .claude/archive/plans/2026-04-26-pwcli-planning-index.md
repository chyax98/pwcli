# pwcli Planning Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 定义 `pwcli` 当前唯一有效的规划文档集合，给后续开发、评审和执行一个单一入口。

**Architecture:** 只保留一套 active planning stack：`总战略与债务盘点` + `当前可执行实施计划`。更早的计划文件全部降级成历史参考，不再继续追加。

**Tech Stack:** Markdown、当前 `.claude/project/*.md` 真相文档、当前 `src/app -> src/domain -> src/infra` 代码结构

---

## 1. Read Order

后续任何实现、评审、分工、排期，按下面顺序读：

1. [Project Truth](/Users/xd/work/tools/pwcli/.claude/project/16-project-truth.md)
2. [Playwright Capability Mapping](/Users/xd/work/tools/pwcli/.claude/project/03-playwright-capability-mapping.md)
3. [pwcli Master Strategy And Gap Register](/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-26-pwcli-master-strategy-and-gap-register.md)
4. [pwcli Active Closure Implementation Plan](/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-26-pwcli-active-closure-implementation-plan.md)

## 2. Active Planning Set

### Active Document A

- Path: `/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-26-pwcli-master-strategy-and-gap-register.md`
- Role:
  - 定义产品最终形态
  - 定义真实 agent story
  - 汇总全量技术债和能力缺口
  - 标注哪些项可以直接做，哪些项需要 trade-off，哪些项必须拍板

### Active Document B

- Path: `/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-26-pwcli-active-closure-implementation-plan.md`
- Role:
  - 把当前还没做的 P0 / P1 收成可执行任务
  - 给 subagent 或主线程明确到文件、命令和验收标准
  - 只覆盖当前批准进入实现的工作，不覆盖远期海量扩张项

## 3. Historical Plans

以下文件全部降级为历史参考：

- `/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-25-pwcli-complete-build.md`
- `/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-25-pwcli-session-first-routing.md`
- `/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-26-pwcli-ddd-native-debug-plan.md`
- `/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-26-pwcli-gap-closure-plan.md`
- `/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-26-pwcli-next-step-autoplan.md`
- `/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-26-pwcli-one-shot-agent-ddd-plan.md`
- `/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-26-pwcli-single-truth-one-shot-plan.md`
- `/Users/xd/work/tools/pwcli/docs/superpowers/plans/2026-04-26-pwcli-whole-tool-gap-closure-plan.md`

这些文件可以保留历史思路、失败路径、阶段性判断。

当前禁止：

- 在历史计划里继续追加新任务
- 把历史计划当 active contract
- 把历史计划里的未来设想写回 truth 文档

## 4. Planning Rules

### Rule 1: 真相优先级

优先级固定：

1. `src/`
2. `.claude/project/*.md`
3. 当前 active planning set
4. 历史计划

### Rule 2: 计划和代码同步

如果出现下面任一情况，必须先改 active plan 再继续实现：

- P0/P1 优先级变化
- 某个债务已经关闭
- 某个能力被证明受 Playwright/Core substrate 阻断
- 新增需要你拍板的产品决策

### Rule 3: 不为文档而文档

后续新增规划文档必须满足两个条件：

- 它解决一个独立的决策问题
- 它能直接被执行或直接影响执行

不满足这两个条件，不新建文档。

## 5. Current Executive Summary

当前 `pwcli` 已完成：

- strict session-first
- DDD-lite 主切流
- session / attach / bootstrap / diagnostics / observe / doctor 主链

当前 `pwcli` 还没完成的关键闭环：

1. modal state recoverability
2. 动作后即时 diagnostics
3. agent contract 文档完全同步
4. evidence 最小 run 目录
5. runtime lane 拆分

这 5 条是当前所有工作里最该优先做的东西。

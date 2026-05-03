---
doc_type: roadmap
slug: project-completion
status: active
created: 2026-05-03
last_reviewed: 2026-05-03
tags: [completion, release, regression, codestable]
related_requirements: []
related_architecture:
  - ARCHITECTURE
  - command-surface
  - domain-status
  - release-v0.1.0
  - e2e-dogfood-test-plan
---

# pwcli Project Completion

## 1. 背景

目标不是只修当前 smoke，而是把 `pwcli` 收敛到可发布、可维护、可继续迭代的完成态：所有当前 P0/P1 bug 有闭环，已承诺 feature 走完 CodeStable 流程，`skills/pwcli/` 与 `codestable/architecture/` 对齐源码，最终通过 release gate。

## 2. 范围与明确不做

### 本 roadmap 覆盖

- 当前 regression/smoke 修复到绿。
- P0/P1 bug 发现、记录、修复、验收闭环。
- 已承诺 feature 的设计、实现、验收、roadmap 回写。
- skill / architecture / README 等 shipped truth 同步。
- release gate 和包验证。

### 明确不做

- 不恢复兼容命令。
- 不扩外部 auth provider lifecycle。
- 不重建 MCP / extract recipes / userscript platform。
- 不追求 `batch` 全命令 parity。
- 不把 future design 写成 shipped contract。

## 3. 模块拆分（概设）

```text
project-completion
├── Regression Gate：让当前 `pnpm smoke` / regression 绿
├── Bug Closure：P0/P1 issue 从 report 到 fix-note
├── Feature Closure：已承诺 feature 从 roadmap item 到 acceptance
├── Truth Sync：skill / architecture / README / command docs 对齐
└── Release Gate：typecheck/build/regression/pack/dogfood 按风险执行
```

### Regression Gate

- **职责**：接续 `handoff_smoke.md`，用最小修复让当前 `pnpm smoke` 通过。
- **承载的子 feature**：`regression-smoke-green`
- **触碰的现有代码 / 模块**：`scripts/smoke/`、`src/cli/`、`src/engine/`、必要的 skill / command architecture 文档。

### Bug Closure

- **职责**：把阻塞发布的 P0/P1 bug 记录为 CodeStable issue，并按 report / analysis / fix-note 闭环。
- **承载的子 feature**：`p0-p1-bug-backlog-closure`
- **触碰的现有代码 / 模块**：按 issue 根因决定，不预设跨模块重构。

### Feature Closure

- **职责**：梳理已承诺但未完成的 feature，逐条进入 `cs-feat` 并完成 acceptance。
- **承载的子 feature**：`committed-feature-closure`
- **触碰的现有代码 / 模块**：按 feature design 决定。

### Truth Sync

- **职责**：同步 shipped truth，清理旧路径、旧命令、旧结构描述和 contract 漂移。
- **承载的子 feature**：`truth-sync-cleanup`
- **触碰的现有代码 / 模块**：`skills/pwcli/`、`codestable/architecture/`、`README.md`、`docs/README.md`。

### Release Gate

- **职责**：执行 release gate，确认包内容、命令面、回归链路和高风险 dogfood 状态。
- **承载的子 feature**：`release-gate-green`、`high-risk-dogfood-green`、`completion-acceptance-report`
- **触碰的现有代码 / 模块**：通常不改代码；只在 gate 暴露 P0/P1 时回到 Bug Closure。

## 4. 模块间接口契约 / 共享协议（架构层详设）

### 4.1 Roadmap Item 状态协议

**方向**：Roadmap → feature / issue / acceptance 工作流  
**形式**：`codestable/roadmap/project-completion/project-completion-items.yaml`

**契约**：

```yaml
slug: string
description: string
depends_on: string[]
status: planned | in-progress | done | dropped
feature: string | null
minimal_loop: boolean
notes: string | null
```

**约束**：

- `done` / `dropped` 是终态。
- 需要返工时新增 item，不回退终态。
- 每次只能有一条 `minimal_loop: true`。
- `feature` 启动后填 `YYYY-MM-DD-{slug}`，未启动为 `null`。

### 4.2 Issue 闭环协议

**方向**：Bug Closure → CodeStable issue 工作流  
**形式**：文件协议

**契约**：

```text
codestable/issues/YYYY-MM-DD-{slug}/
├── {slug}-report.md
├── {slug}-analysis.md
└── {slug}-fix-note.md
```

**约束**：

- 每个 P0/P1 bug 必须有复现证据、根因、修复范围、验证结果。
- 根因显然的小修可走快速通道，但仍要写 fix-note。
- 不把 P2/P3 优化包装成 release blocker。

### 4.3 文档同步协议

**方向**：代码 / 命令行为 → shipped truth  
**形式**：文档同步规则

**契约**：

```text
command / flag / error / output / workflow 变化
  -> skills/pwcli/

command design / evidence / limitation 变化
  -> codestable/architecture/commands/

domain boundary 变化
  -> codestable/architecture/domain-status.md 或 ADR
```

**约束**：

- `.claude/` 不承载项目规划、过程归档或 active truth。
- limitation code 不能包装成“已支持”。
- README 只保留入口，不复制完整教程。

### 4.4 验证门禁协议

**方向**：Release Gate → 本地命令  
**形式**：shell 命令

**契约**：

```bash
pnpm build
pnpm smoke
pnpm typecheck
git diff --check
npm pack --dry-run
pnpm test:dogfood:e2e
```

**约束**：

- 日常改动优先最小验证。
- 最终发布、合并前总验收或用户明确要求时跑全量 smoke。
- 高风险行为变化才补 dogfood E2E。

## 5. 子 feature 清单

1. **regression-smoke-green** — 接续 `handoff_smoke.md`，修到 `pnpm smoke` 输出 `[smoke] all tests passed`。
   - 所属模块：Regression Gate
   - 依赖：无
   - 状态：planned
   - 对应 feature：未启动
   - 备注：当前已知失败点是 diagnostics bundle 未生成 `manifest.json`。

2. **p0-p1-bug-backlog-closure** — 把剩余 P0/P1 bug 按 `cs-issue` 记录、分析、修复、验收。
   - 所属模块：Bug Closure
   - 依赖：`regression-smoke-green`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：只处理可验证 P0/P1，不把 P2/P3 当 blocker。

3. **committed-feature-closure** — 梳理并完成已承诺 feature，逐条走设计、实现、验收和 roadmap 回写。
   - 所属模块：Feature Closure
   - 依赖：`regression-smoke-green`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：不新增用户未确认的大功能。

4. **truth-sync-cleanup** — 同步 skills、architecture、command docs、README，清除旧路径和 contract 漂移。
   - 所属模块：Truth Sync
   - 依赖：`regression-smoke-green`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：README 已发现旧路径观察项。

5. **release-gate-green** — 跑完 release gate 并修复阻塞问题。
   - 所属模块：Release Gate
   - 依赖：`p0-p1-bug-backlog-closure`、`committed-feature-closure`、`truth-sync-cleanup`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：覆盖 typecheck / build / test:regression / diff-check / npm-pack。

6. **high-risk-dogfood-green** — 若本轮触碰 lifecycle/auth/action/ref/diagnostics/route/environment/package，补 dogfood E2E gate。
   - 所属模块：Release Gate
   - 依赖：`release-gate-green`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：按风险触发，不默认跑。

7. **completion-acceptance-report** — 输出最终验收报告，列出完成项、剩余非阻塞限制、验证证据、后续 issue。
   - 所属模块：Release Gate
   - 依赖：`release-gate-green`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：dogfood 若触发则也作为前置证据。

**最小闭环**：第 1 条 `regression-smoke-green` 做完后，项目恢复完整 regression 验证能力，后续 bug / feature / release gate 都有可信基线。

## 6. 排期思路

先做 `regression-smoke-green`，因为当前项目已有明确失败点和交接文档，做完后能恢复最小端到端验证能力。之后先清 P0/P1 bug，再收敛已承诺 feature，最后统一 truth sync 和 release gate。

技术依赖之外的产品优先级不在本 roadmap 里替用户决定；新 feature 是否进入范围，必须由用户或后续 roadmap update 明确。

## 7. 观察项

- `README.md` 仍引用旧 `docs/architecture/` 和旧 `src/app|domain|infra` 结构，需要在 truth sync 阶段修。
- `handoff_smoke.md` 是过程交接文档，长期不应作为 active truth；完成 smoke 后应转成 issue/fix-note 或删除。
- 当前已有未跟踪 command architecture 文档，需要在后续提交前确认是否都属于本轮迁移 / 验证产物。

## 8. 变更日志

- 2026-05-03：创建项目完成 roadmap，定义从 regression 绿到 release gate 的收敛路径。

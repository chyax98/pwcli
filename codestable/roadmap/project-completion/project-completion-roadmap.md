---
doc_type: roadmap
slug: project-completion
status: active
created: 2026-05-03
last_reviewed: 2026-05-03
tags: [completion, release, regression, codestable, command-docs, agent-product]
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

产品面是 **CLI + Skill**。`pwcli` 是 Agent 操作浏览器的手和眼：可复现、可中断、可自主探索、证据链充分，并能通过 diagnostics / runs / bundle / logs 追溯失败原因。完成态必须证明 Agent 拿到 `skills/pwcli/` 后，可以稳定完成浏览器自动化、自动化测试、表单填写验证、简单爬取、Deep Bug 复现和定位等任务。

## 2. 范围与明确不做

### 本 roadmap 覆盖

- 当前 regression/smoke 修复到绿。
- P0/P1 bug 发现、记录、修复、验收闭环。
- 已承诺 feature 的设计、实现、验收、roadmap 回写。
- skill / architecture / README 等 shipped truth 同步。
- 每一个顶层 command 都能映射到 CodeStable command doc，且每份 command doc 记录设计、参数、限制和使用证据状态。
- Agent 产品场景深测矩阵：浏览器自动化、自动化测试、填表验证、简单爬虫、Deep Bug 复现与分析、证据打包。
- 可复利资产：benchmark 结果、issue/fix-note、feature acceptance、compound learning/trick/decision/explore。
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
├── Command Docs：每个 command 映射到 CodeStable command doc 和证据状态
├── Agent Scenario Deep Validation：按 Agent 真实任务矩阵深测
├── Compounding Assets：沉淀可复用证据、经验和决策
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

### Command Docs

- **职责**：确保 `node dist/cli.js --help` 暴露的每个顶层 command，都能在 `codestable/architecture/commands/` 找到对应命令族文档、参数口径、限制和证据状态。
- **承载的子 feature**：`command-docs-complete`
- **触碰的现有代码 / 模块**：`codestable/architecture/commands/`、`codestable/architecture/command-surface.md`、必要时 `skills/pwcli/references/`。

### Agent Scenario Deep Validation

- **职责**：用真实 Agent 任务矩阵证明 CLI + Skill 能完成核心浏览器任务，不只证明单命令可运行。
- **承载的子 feature**：`agent-scenario-deep-validation`
- **触碰的现有代码 / 模块**：`scripts/smoke/`、`scripts/benchmark/`、`benchmark/`、`skills/pwcli/workflows/`、必要时新增验证报告。

### Compounding Assets

- **职责**：把验证、失败、修复和设计结论沉淀成 CodeStable 可检索资产，避免只留下临时日志。
- **承载的子 feature**：`compounding-assets-archive`
- **触碰的现有代码 / 模块**：`codestable/issues/`、`codestable/features/`、`codestable/compound/`、`scripts/benchmark/results/`。

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

### 4.5 Command Doc Coverage 协议

**方向**：CLI command surface → CodeStable command docs  
**形式**：覆盖矩阵

**契约**：

```text
每个 node dist/cli.js --help 顶层 command
  -> codestable/architecture/commands/<family>.md 中必须出现
  -> 文档必须包含：作用、参数、技术原理、已知限制、使用证据状态
  -> command-surface.md 必须能把 command 映射到源码和 skill reference
```

**约束**：

- 可以按命令族聚合，不强制每个 command 一个文件；但每个顶层 command 必须可检索。
- 新增 / 删除 / 修改 command 时，同步 `skills/pwcli/` 和对应 command doc。
- `experimental` command 不能进入主 skill；如果代码存在但 docs 无证据，要标出限制或降级。

### 4.6 Agent Scenario Validation 协议

**方向**：产品目标 → 可执行验证  
**形式**：任务矩阵 + 证据报告

**契约**：

```text
browser-automation        -> session/open/read/action/wait/verify/diagnostics
automated-testing         -> route/bootstrap/environment/batch/verify
form-fill-validation      -> locate/fill/select/check/upload/submit/get
simple-crawler            -> open/read-text/page/list/download/screenshot/code escape hatch
deep-bug-diagnosis        -> errors clear/reproduce/network/console/errors/diagnostics bundle/show/grep
reproducible-handoff      -> runs/events.jsonl/manifest.json/artifacts/fix-note
```

**约束**：

- 每个场景必须有真实 CLI 命令证据，不用裸 Playwright 脚本替代产品验证。
- 失败要进入 CodeStable issue 或 compound learning；不能只停在临时 smoke 输出。
- Skill 必须能教会 Agent 进入对应 workflow。

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

5. **command-docs-complete** — 为所有顶层 command 建立 CodeStable command doc 覆盖矩阵并补齐缺口。
   - 所属模块：Command Docs
   - 依赖：`truth-sync-cleanup`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：允许按命令族聚合，但每个顶层 command 必须可检索、可追证据状态。

6. **agent-scenario-deep-validation** — 深测 Agent 浏览器任务矩阵：自动化、测试、表单、爬取、Deep Bug、证据交接。
   - 所属模块：Agent Scenario Deep Validation
   - 依赖：`regression-smoke-green`、`command-docs-complete`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：用真实 `pw` 命令和 skill workflow 验证，不用裸 Playwright 替代。

7. **compounding-assets-archive** — 把验证过程中的失败、修复、经验和技巧沉淀进 CodeStable。
   - 所属模块：Compounding Assets
   - 依赖：`p0-p1-bug-backlog-closure`、`agent-scenario-deep-validation`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：issue/fix-note、feature acceptance、compound learning/trick/decision/explore、benchmark results。

8. **release-gate-green** — 跑完 release gate 并修复阻塞问题。
   - 所属模块：Release Gate
   - 依赖：`p0-p1-bug-backlog-closure`、`committed-feature-closure`、`command-docs-complete`、`agent-scenario-deep-validation`、`compounding-assets-archive`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：覆盖 typecheck / build / test:regression / diff-check / npm-pack。

9. **high-risk-dogfood-green** — 若本轮触碰 lifecycle/auth/action/ref/diagnostics/route/environment/package，补 dogfood E2E gate。
   - 所属模块：Release Gate
   - 依赖：`release-gate-green`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：按风险触发，不默认跑。

10. **completion-acceptance-report** — 输出最终验收报告，列出完成项、剩余非阻塞限制、验证证据、后续 issue。
   - 所属模块：Release Gate
   - 依赖：`release-gate-green`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：dogfood 若触发则也作为前置证据。

**最小闭环**：第 1 条 `regression-smoke-green` 做完后，项目恢复完整 regression 验证能力，后续 bug / feature / release gate 都有可信基线。

## 6. 排期思路

先做 `regression-smoke-green`，因为当前项目已有明确失败点和交接文档，做完后能恢复最小端到端验证能力。之后先清 P0/P1 bug，再收敛已承诺 feature；随后做 truth sync、command docs coverage 和 Agent 场景深测；最后归档复利资产并跑 release gate。

技术依赖之外的产品优先级不在本 roadmap 里替用户决定；新 feature 是否进入范围，必须由用户或后续 roadmap update 明确。

## 7. 观察项

- `README.md` 仍引用旧 `docs/architecture/` 和旧 `src/app|domain|infra` 结构，需要在 truth sync 阶段修。
- `handoff_smoke.md` 是过程交接文档，长期不应作为 active truth；完成 smoke 后应转成 issue/fix-note 或删除。
- 当前已有未跟踪 command architecture 文档，需要在后续提交前确认是否都属于本轮迁移 / 验证产物。
- 当前 command docs 是命令族聚合形态，需要补一份覆盖矩阵来证明每个顶层 command 均可检索。
- `route load` 在 `codestable/architecture/commands/tools.md` 标为 `experimental` 且提示 source/help 不注册；后续 command docs coverage 阶段要核实它是删除残留、未注册能力，还是需重新实现的 planned feature。
- `doctor` 在当前 Node 24 / pnpm 10+ 环境下的预检输出会干扰 smoke 健康判断；用户已明确不做环境补丁，后续验证报告需要把它作为环境观察项处理，不强行改产品代码。

## 8. 变更日志

- 2026-05-03：创建项目完成 roadmap，定义从 regression 绿到 release gate 的收敛路径。
- 2026-05-04：扩展 roadmap，加入每个 command 的 CodeStable 文档覆盖、Agent 场景深测和复利资产归档。

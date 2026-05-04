---
doc_type: roadmap
slug: project-completion
status: active
created: 2026-05-03
last_reviewed: 2026-05-04
tags: [completion, release, regression, codestable, command-docs, agent-product]
related_requirements: []
related_architecture:
  - ARCHITECTURE
  - command-surface
  - domain-status
  - release-v0.2.0
  - e2e-dogfood-test-plan
related_decisions:
  - 2026-05-04-decision-agent-driven-validation-strategy
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
├── Agent Scenario Deep Validation：Agent 按 skill 执行真实任务矩阵深测
├── Compounding Assets：沉淀可复用证据、经验和决策
└── Release Gate：typecheck/build/regression/pack + Agent dogfood evidence 按风险执行
```

### Regression Gate

- **职责**：用最小修复让当前 `pnpm smoke` 通过；历史 handoff 内容已吸收进 issue/fix-note 和 release gate 记录。
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

- **职责**：用 Agent 按 `skills/pwcli/` 执行真实任务，证明 CLI + Skill 能完成核心浏览器任务，不只证明单命令或脚本可运行。
- **承载的子 feature**：`agent-scenario-deep-validation`
- **触碰的现有代码 / 模块**：`skills/pwcli/`、`codestable/compound/`、`codestable/issues/`、`codestable/architecture/commands/`、必要时新增小型集成测试或验证报告。

### Compounding Assets

- **职责**：把验证、失败、修复和设计结论沉淀成 CodeStable 可检索资产，避免只留下临时日志。
- **承载的子 feature**：`compounding-assets-archive`
- **触碰的现有代码 / 模块**：`codestable/issues/`、`codestable/compound/`、`codestable/architecture/commands/`。

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

**方向**：Release Gate → 本地命令 + Agent 证据
**形式**：基础命令、契约测试、Agent dogfood 证据

**契约**：

```bash
pnpm build
pnpm smoke
pnpm typecheck
git diff --check
npm pack --dry-run
```

```text
Agent dogfood evidence:
  - Agent 按 skills/pwcli/ 执行真实任务矩阵
  - 每个场景记录关键 pw 命令、结果、失败恢复和证据位置
  - P0/P1 失败进入 codestable/issues/
  - 稳定结论进入 architecture / decision / learning / command docs
```

**约束**：

- 日常改动优先最小验证。
- 最终发布、合并前总验收或用户明确要求时跑全量 smoke。
- 高风险行为变化必须补 Agent dogfood 证据；小型脚本 E2E 可作为基础回归或夹具复用，但不替代 Agent 按 skill 的真实使用验证。
- Node 24 + pnpm 10+ 是验证基线；不为 Volta/proto/本地 Node 漂移写产品补丁。

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

- 每个场景必须由 Agent 按 `skills/pwcli/` 真实执行，留下 CLI 命令证据，不用裸 Playwright 脚本替代产品验证。
- 基础 contract 可以用 Vitest、集成测试、fixture 或小型脚本兜底；它们是底层保障，不是主要产品深测。
- 失败要进入 CodeStable issue 或 compound learning；不能只停在临时 smoke 输出。
- Skill 必须能教会 Agent 进入对应 workflow。

## 5. 子 feature 清单

1. **regression-smoke-green** — 修到 `pnpm smoke` 输出通过。
   - 所属模块：Regression Gate
   - 依赖：无
   - 状态：done
   - 对应 feature：未启动
   - 备注：2026-05-04 已通过 `pnpm smoke`；修复 diagnostics bundle/export 产物写出和 smoke 旧 JSON 断言漂移。

2. **p0-p1-bug-backlog-closure** — 把剩余 P0/P1 bug 按 `cs-issue` 记录、分析、修复、验收。
   - 所属模块：Bug Closure
   - 依赖：`regression-smoke-green`
   - 状态：done
   - 对应 feature：未启动
   - 备注：已关闭 geolocation contract drift、batch verify failure propagation、trace inspect CLI resolution、skill packaged path resolution；release-blocker audit 未发现新增 P0/P1，后续若 release gate 暴露新问题则新建 issue 闭环。

3. **committed-feature-closure** — 梳理并完成已承诺 feature，逐条走设计、实现、验收和 roadmap 回写。
   - 所属模块：Feature Closure
   - 依赖：`regression-smoke-green`
   - 状态：done
   - 对应 feature：未启动
   - 备注：committed feature closure audit 未发现新的实现缺口；仅修复 release contract 版本文档漂移；不新增用户未确认的大功能。

4. **truth-sync-cleanup** — 同步 skills、architecture、command docs、README，清除旧路径和 contract 漂移。
   - 所属模块：Truth Sync
   - 依赖：`regression-smoke-green`
   - 状态：done
   - 对应 feature：未启动
   - 备注：已修 README 旧路径/旧结构、Claude 本地命令旧 architecture 路径、skill 中 `route load` 旧用法，并修复 `check-skill-contract` citty help 解析。

5. **command-docs-complete** — 为所有顶层 command 建立 CodeStable command doc 覆盖矩阵并补齐缺口。
   - 所属模块：Command Docs
   - 依赖：`truth-sync-cleanup`
   - 状态：done
   - 对应 feature：未启动
   - 备注：已建立 `codestable/architecture/commands/coverage.md`，`node dist/cli.js --help` 53/53 顶层 command 均映射到命令族 ADR。

6. **agent-scenario-deep-validation** — Agent 按 skill 深测浏览器任务矩阵：自动化、测试、表单、爬取、Deep Bug、证据交接。
   - 所属模块：Agent Scenario Deep Validation
   - 依赖：`regression-smoke-green`、`command-docs-complete`
   - 状态：done
   - 对应 feature：未启动
   - 备注：已完成 browser automation、deep bug、environment、crawler、automated testing、form/file、artifacts、state/auth、workspace/control、tooling boundary Agent dogfood；`auth dc` 与 HAR 热录制保留为明确边界。

7. **compounding-assets-archive** — 把验证过程中的失败、修复、经验和技巧沉淀进 CodeStable。
   - 所属模块：Compounding Assets
   - 依赖：`p0-p1-bug-backlog-closure`、`agent-scenario-deep-validation`
   - 状态：done
   - 对应 feature：未启动
   - 备注：已沉淀 issue/fix-note、decision、roadmap evidence、release blocker audit、committed feature closure audit 和 command docs；benchmark results 作为辅助资产单独保留。

8. **release-gate-green** — 跑完 release gate 并修复阻塞问题。
   - 所属模块：Release Gate
   - 依赖：`p0-p1-bug-backlog-closure`、`committed-feature-closure`、`command-docs-complete`、`agent-scenario-deep-validation`、`compounding-assets-archive`
   - 状态：done
   - 对应 feature：未启动
   - 备注：release gate 通过 typecheck / build / smoke / contract checks / YAML / diff-check / npm-pack；首次 smoke 因 240s 工具超时中断，600s 重跑脚本自身通过。

9. **high-risk-dogfood-green** — 若本轮触碰 lifecycle/auth/action/ref/diagnostics/route/environment/package，补高风险 Agent dogfood 证据。
   - 所属模块：Release Gate
   - 依赖：`release-gate-green`
   - 状态：done
   - 对应 feature：未启动
   - 备注：高风险能力已有 Agent dogfood 与聚焦 contract checks；本轮最终改动只涉及文档和 release contract。

10. **completion-acceptance-report** — 输出最终验收报告，列出完成项、剩余非阻塞限制、验证证据、后续 issue。
   - 所属模块：Release Gate
   - 依赖：`release-gate-green`
   - 状态：done
   - 对应 feature：未启动
   - 备注：已生成 `codestable/roadmap/project-completion/project-completion-acceptance.md`。

**最小闭环**：第 1 条 `regression-smoke-green` 做完后，项目恢复完整 regression 验证能力，后续 bug / feature / release gate 都有可信基线。

## 6. 排期思路

先做 `regression-smoke-green`，因为当前项目已有明确失败点，做完后能恢复最小端到端验证能力。之后先清 P0/P1 bug，再收敛已承诺 feature；随后做 truth sync、command docs coverage 和 Agent 场景深测；最后归档复利资产并跑 release gate。

技术依赖之外的产品优先级不在本 roadmap 里替用户决定；新 feature 是否进入范围，必须由用户或后续 roadmap update 明确。

## 7. 观察项

- README、skill route mock 文档和 Claude 本地命令旧路径已在 truth sync 阶段修正。
- 历史 handoff 文档不作为 active truth；完成 smoke 后只保留 issue/fix-note、release gate 和命令 docs 中的稳定结论。
- command architecture 文档已提交为命令族 ADR，并补 `coverage.md` 覆盖矩阵。
- `route load` 不是当前 source/help 注册命令；已在 `tools.md` 和 `coverage.md` 标为旧文档残留风险，不写成 shipped 能力。
- `doctor` 在当前 Node 24 / pnpm 10+ 环境下仍会报告环境 diagnostic；smoke 只验证 endpoint 和 recovery，不用产品补丁绕过版本管理差异。
- 深度验证策略已调整为 Agent 按 `skills/pwcli/` 真实 dogfood 为主；大型 shell E2E 只作辅助回归和夹具，不作为主要产品验收方式。

## 8. 变更日志

- 2026-05-03：创建项目完成 roadmap，定义从 regression 绿到 release gate 的收敛路径。
- 2026-05-04：扩展 roadmap，加入每个 command 的 CodeStable 文档覆盖、Agent 场景深测和复利资产归档。
- 2026-05-04：`regression-smoke-green` 完成，`pnpm smoke` 通过；`command-docs-complete` 完成，53 个顶层 command 均有 CodeStable 命令族文档映射。
- 2026-05-04：`truth-sync-cleanup` 完成，README / skill / Claude 本地命令 / architecture 活跃文档已对齐当前路径和 route shipped contract。
- 2026-05-04：按用户拍板更新验证策略：基础能力用集成/契约测试兜底，深度验证以 Agent 按中文优先 skill 执行真实任务为主，脚本 E2E 降级为辅助回归入口。
- 2026-05-04：关闭 P0/P1 backlog、committed feature closure、Agent deep validation 和 compounding assets；发布契约同步到当前 `v0.2.0`。
- 2026-05-04：release gate 通过并生成最终 completion acceptance report。

---
doc_type: roadmap
slug: pre-1-0-breakthrough
status: active
created: 2026-05-04
last_reviewed: 2026-05-04
tags: [pre-1-0, release, breakthrough, rnd-validation, skill-sop, codestable]
related_requirements: []
related_architecture:
  - ARCHITECTURE
  - domain-status
  - command-surface
  - release-v0.2.0
related_decisions:
  - 2026-05-04-decision-agent-driven-validation-strategy
  - 2026-05-04-decision-chinese-first-docs-and-skills
  - 2026-05-04-decision-no-logical-backward-compatibility
  - 2026-05-04-decision-node24-pnpm10-baseline
---

# Pre-1.0 Breakthrough Roadmap

## 1. 背景

`project-completion` 已把当前承诺能力收敛到可发布状态，但它不是 1.0。1.0 的目标不是“所有命令能跑”，而是让 `pwcli` 在真实 Agent 工作中更像一个稳定浏览器操作系统：可进入测试 / RND 环境、可处理复杂恢复、可交接证据、可复现真实业务问题，并且文档和 skill 足够让其他 Agent 直接按 SOP 使用。

本 roadmap 是一个系统性攻关任务：先发布 **Pre-1.0**，在真实环境和高风险场景里补证据、修复阻塞，再进入 **1.0 Release Candidate** 和正式 1.0。

## 2. 范围与明确不做

### 本轮覆盖

- 对每个 command 做深度评估、评测和证据归档；`proven` 不能只靠 help、类型检查或单条脚本绿灯。
- 深评粒度是 shipped top-level command：当前以 `pre-1-0-command-evaluation-matrix.yaml` 的 53 个 command 行为准；roadmap item 只是执行批次，不是抽样理由。
- 对核心 workflow 做串联验证：浏览器自动化、自动化测试、填表/文件、简单爬取、Deep Bug 复现、失败恢复和证据交接。
- 按传统团队一个月冲刺拆成 4 周目标，并拆成至少 20 个可独立执行的循环；当前拆分为 34 个循环，低于这个粒度不得收口。
- 参考 Playwright CLI、Agent Browser / Stagehand、browser-use、cla / Claude Code 类本地 CLI 的能力，把适合本地 Agent-first 浏览器工具的能力吸收到 1.0 规划。
- 竞品能力不能只停在调研表：每个“需要吸收”的能力必须落到 command contract、workflow、skill SOP、roadmap item 或明确 dropped 结论。
- 将 `auth dc` / Forge / DC 真实环境链路从 documented 推进到 proven。
- 在测试环境、RND 环境跑真实 Agent dogfood，不再把“本地没有账号 / 环境”作为不可验证结论。
- 修复或明确降级 recoverability 缺口：modal / dialog / doctor / session blocked / run-code timeout / stale ref。
- 将 diagnostics / evidence 提升到 1.0：失败现场 bundle、run timeline、trace/HAR 边界、可交接报告。
- 建立 Pre-1.0 → RC → 1.0 的 release gate。
- 全量补齐 CodeStable 文档：现状 architecture、command docs、issue/fix-note、acceptance、decision/learning。
- 全量打磨 `skills/pwcli/`：中文优先、任务 SOP、真实环境 SOP、失败恢复 SOP、1.0 usage contract。
- 清理仓库过程文件、旧脚本漂移、重复文档和无效辅助资产。

### 明确不做

- 不写逻辑向后兼容实现；只允许命令名称层面的清晰别名，并收敛到唯一内部实现。
- 不把 RND / 测试环境的临时 token、账号、cookie 或 state 提交进仓库。
- 不把 Playwright internal substrate 包装成 pwcli public API，除非本轮 feature 正式定义稳定 contract。
- 不把大型 shell E2E 当主要产品验收；它只能作为辅助回归入口。
- 不把 future idea 写进 `skills/pwcli/` 主教程；主 skill 只教当前支持和已验证 SOP。
- 不做云端部署、托管浏览器 fleet、账号/cookie/验证码/session state 托管、无边界 recipe 平台或 MCP/userscript 平台复活。

## 3. 模块拆分（概设）

```text
pre-1-0-breakthrough
├── Real Environment Validation：测试/RND/Forge/DC 真实环境验证
├── Command Deep Evaluation：每个 command 的深评、评测、证据状态和缺口闭环
├── Workflow Integration：跨 command 真实任务串联验证
├── Capability Intake：参考同类工具，把本地 Agent-first 必需能力纳入 1.0
├── Recovery Breakthrough：modal、dialog、doctor、timeout、session blocked 恢复
├── Evidence System：diagnostics、runs、bundle、trace/HAR、handoff 报告
├── Agent SOP Skill：skills/pwcli 作为 Agent 操作手册和 SOP
├── CodeStable Truth：architecture / command docs / issue / acceptance 全量同步
├── Automation Gate：基础 contract tests + Agent dogfood + 辅助 E2E 脚本
├── Repository Cleanup：过程文件、旧脚本、重复文档、无效资产清理
└── Release Ladder：Pre-1.0、RC、1.0 发布门禁
```

### Real Environment Validation

职责：把本地无法充分验证的业务能力搬到测试/RND 环境证明，尤其是 `auth dc`、真实 Forge/DC 页面、真实登录态复用、真实业务 bug 复现。

### Command Deep Evaluation

职责：逐个 command 建立深评记录，覆盖目的、输入、输出、错误、恢复、证据、workflow 位置、竞品参考点和 1.0 状态。命令状态只能是：

- `proven`：有命令级评估证据和 workflow 串联证据。
- `documented`：文档清楚，但缺真实验证或环境证据。
- `blocked`：有明确 blocker issue。
- `dropped`：明确不进入 1.0 contract。

执行纪律：

- 一个 shipped top-level command 必须对应矩阵中一行；别名也要说明映射到哪个唯一内部实现。
- 分组评测只用于减少上下文切换，不能把“某一组通过”替代“组内每个 command 已评估”。
- 高风险 command 需要双证据：focused check 证明 contract，workflow 串联证明 Agent 能完成真实任务。

### Workflow Integration

职责：把命令从“可调用”提升成“Agent 能完成任务”。每条 workflow 必须由 Agent 按 `skills/pwcli/` 执行，并记录关键命令、结果、失败恢复和证据路径。

### Capability Intake

职责：参考同类工具，但只吸收本地 Agent-first 浏览器任务需要的能力。参考对象和边界记录在 `drafts/2026-05-04-capability-reference-survey.md`。

每个候选能力必须给出四类结论之一：

- `implemented/proven`：已由现有 command 或 workflow 证明。
- `planned`：进入本 roadmap 某个 item，并有验收方式。
- `blocked`：有环境、账号、产品边界或技术 blocker。
- `dropped`：不服务本地 Agent-first 目标，或违反本地边界 / 单一实现 / 不写逻辑兼容铁律。

### Recovery Breakthrough

职责：让 Agent 在复杂失败态下有可靠决策路径。当前暴露的一个具体缺口是：辅助 E2E 中 `page current` 能证明 `MODAL_STATE_BLOCKED`，但 `doctor --session` 未给出预期 `modal-state` recovery 诊断。

### Evidence System

职责：1.0 需要标准化“证据包”：一次任务完成后，Agent 能输出可交接的 run timeline、诊断摘要、关键 artifact 和复现命令。

### Agent SOP Skill

职责：`skills/pwcli/` 是核心产品面。它必须从“命令说明”升级成“任务 SOP”：真实环境登录、自动化测试、bug 复现、证据交接、恢复决策都要能按步骤执行。

### CodeStable Truth

职责：保证所有当前实现、限制、扩展口和修复证据都可检索。CodeStable 是维护面，不是过程日志。

### Automation Gate

职责：把基础 contract tests、Agent dogfood、辅助 shell E2E 分层。辅助 E2E 失败时先分类为产品 P0/P1、contract 漂移或脚本维护问题。

### Repository Cleanup

职责：清理不再作为 truth 的过程文件和旧评测资产。保留的 benchmark / eval 必须有用途和入口；无入口、无引用、已被 CodeStable 吸收的文件应删除或归档。

### Release Ladder

职责：明确 Pre-1.0、RC、1.0 的每级出口。Pre-1.0 可以带已知 P2/P3；RC 不允许 P0/P1；1.0 需要真实环境证据和 skill SOP 验收。

## 4. 接口契约 / 共享协议（架构层详设）

### 4.1 真实环境验证证据协议

**形式：**

```text
codestable/roadmap/pre-1-0-breakthrough/drafts/YYYY-MM-DD-real-env-{scenario}.md
```

**每份证据必须包含：**

```yaml
environment: test | rnd | local
target: forge | dc | generic-site | fixture
session: string
account_material: "not-recorded"
commands: string[]
evidence:
  diagnostics_bundle?: string
  run_ids?: string[]
  artifacts?: string[]
result: pass | fail | blocked
follow_up?: issue path
```

**约束：**

- 不记录 token、cookie、验证码、账号敏感值。
- 真实环境失败必须进入 issue，不能只写“外部环境问题”。
- 如果环境不可达，记录 endpoint、网络错误和恢复建议。

### 4.2 Recovery Contract

所有 recoverability feature 都必须输出一致字段：

```ts
type RecoverySignal = {
  blocked: boolean;
  kind:
    | "modal-state"
    | "browser-dialog"
    | "session-busy"
    | "run-code-timeout"
    | "ref-stale"
    | "navigation-changed"
    | "auth-blocked"
    | "unknown";
  retryable: boolean;
  commands: string[];
  evidence?: {
    runId?: string;
    diagnosticsBundle?: string;
    pageId?: string;
    navigationId?: string;
  };
};
```

**约束：**

- action 成功但产生 blocked state 时，不伪装成 action failure；必须在结果里显式给 `blockedState` / `modalPending` / `nextSteps`。
- read / status / doctor / diagnostics 对 blocked state 的输出必须一致。
- 失败恢复 SOP 必须同步 `skills/pwcli/references/failure-recovery.md`。

### 4.3 Evidence Bundle Contract

1.0 证据包最小字段：

```ts
type EvidenceBundleManifest = {
  schemaVersion: "1.0";
  session: string;
  createdAt: string;
  task?: string;
  commands: string[];
  runIds: string[];
  artifacts: Array<{
    type: "screenshot" | "pdf" | "trace" | "video" | "network" | "console" | "state" | "custom";
    path: string;
    sizeBytes?: number;
  }>;
  summary: {
    status: "pass" | "fail" | "blocked";
    highSignalFindings: string[];
  };
};
```

### 4.4 Skill SOP Contract

`skills/pwcli/` 必须满足：

- 主 `SKILL.md` 覆盖 80% 高频任务，只放当前稳定 SOP。
- `references/` 放命令细节、错误恢复、真实环境专项。
- `domains/` 放领域边界和误用。
- `workflows/` 放可执行任务链路。
- 所有中文说明优先；命令、flag、错误码、路径、协议字段保留英文。
- 每条新增或变化的 command / flag / error / workflow 都必须同步 skill。

### 4.5 Release Gate Contract

Pre-1.0 gate：

```bash
pnpm typecheck
pnpm build
pnpm smoke
pnpm check:skill
pnpm check:batch-verify
pnpm check:env-geolocation
pnpm check:trace-inspect
pnpm check:skill-install
npm pack --dry-run
```

1.0 RC gate 额外要求：

```text
真实测试/RND dogfood: pass
auth dc real-env evidence: pass 或有明确环境 blocker issue
recovery breakthrough scenarios: pass
每个 command 深评: pass / documented-with-blocker / dropped
核心 workflow 串联验证: pass
skill SOP audit: pass
CodeStable truth audit: pass
辅助 E2E: pass 或明确 dropped 并移除 package script
```

### 4.6 Command Evaluation Contract

每个 command 的深评记录必须覆盖：

```yaml
command: string
surface: cli | helper | packaged-skill
purpose: string
inputs:
  required: string[]
  optional: string[]
outputs:
  human: string
  json: string
errors:
  codes: string[]
  retryable: boolean
recovery:
  blocked_states: string[]
  next_commands: string[]
evidence:
  focused_checks: string[]
  dogfood_runs: string[]
  workflow_links: string[]
status: proven | documented | blocked | dropped
gaps: string[]
```

要求：

- 每个 command 至少有一条 focused check 或 Agent dogfood 证据。
- 高风险 command 必须同时有单命令深评和 workflow 串联。
- 改 command / flag / output / error 时，必须同步 `skills/pwcli/` 和 command ADR。

### 4.7 Workflow Integration Contract

每条 workflow 记录必须覆盖：

```yaml
workflow: string
user_goal: string
environment: local | test | rnd
commands: string[]
evidence:
  run_ids: string[]
  artifacts: string[]
  diagnostics_bundle?: string
result: pass | fail | blocked
issues: string[]
skill_updates: string[]
```

核心 workflow：

- 浏览器自动化
- 自动化测试
- 填表 / 上传 / 下载 / 文件验证
- 简单爬取 / 信息提取
- Deep Bug 复现和分析
- 失败恢复和证据交接

### 4.8 Capability Intake Contract

外部工具能力进入 1.0 前必须满足：

1. 服务本地 Agent-first 浏览器任务。
2. 能映射到唯一清晰的 command / workflow contract。
3. 能被单命令深评和 workflow 串联证明。
4. 能写进中文优先 `skills/pwcli/`。
5. 不引入逻辑向后兼容、不恢复兼容命令、不制造第二套内部实现。

### 4.9 一个月冲刺执行协议

本 roadmap 映射传统软件团队一个月工作量，但允许由 AI Agent 压缩执行时间。压缩只允许发生在执行速度上，不允许发生在验证深度上。

当前执行单元：

```yaml
sprint_model:
  traditional_duration: 1 month
  weeks: 4
  roadmap_loops: 34
  command_matrix_rows: 53
  minimum_loops_required: 20
  validation_style:
    command_contract: focused check / focused test / artifact evidence
    product_usability: Agent 按 skills/pwcli/ 做真实 workflow dogfood
    external_environment: test/RND 真实证据或正式 blocker
```

完成口径：

- 34 个 roadmap loops 全部 `done` / `dropped-with-reason` 前，不允许宣布 1.0 目标完成。
- 53 个 command 行全部 `proven` / `documented-with-blocker` / `dropped` 前，不允许进入 1.0 acceptance。
- 核心 workflow 全部有串联证据前，不允许只用单命令证据替代产品验收。
- 竞品参考能力必须在 survey、roadmap item、workflow evidence 或 dropped 结论中闭环。

## 5. 子 feature 清单

完整子 feature 清单以 `pre-1-0-breakthrough-items.yaml` 为机器 truth。本轮已扩展为 34 个循环，覆盖 repo cleanup、E2E helper 审计、竞品能力参考、每个 command 深评矩阵、核心 workflow 串联、真实环境验证、recovery、evidence、skill SOP、CodeStable truth、Pre-1.0、RC 和 1.0 acceptance。

## 6. 排期思路

按传统团队一个月冲刺映射为 4 周：

| 周 | 目标 | 主要循环 |
|---|---|---|
| Week 1 | 基线、竞品参考、评估协议、基础命令深评 | repo cleanup、E2E helper、capability survey、command evaluation contract、lifecycle、observe/read、interaction |
| Week 2 | 命令全覆盖深评 | wait/assert、workspace identity、diagnostics、network/console/errors、trace/HAR/video、route/mock/bootstrap、environment、auth/state/storage、batch/code/tooling；逐项回写 53 行 command matrix |
| Week 3 | workflow 串联和真实环境验证 | 浏览器自动化、自动化测试、填表文件、简单爬取、Deep Bug、恢复交接、real-env access、auth dc；每条 workflow 必须由 Agent 按 skill 执行 |
| Week 4 | 1.0 攻关收口 | recovery breakthrough、evidence bundle、HAR/trace 决策、真实 Agent 矩阵、skill SOP audit、CodeStable truth audit、Pre-1.0 gate、RC blocker、1.0 acceptance |

这不是固定日程，而是工作量映射。AI Agent 可以压缩执行时间，但不能压缩验收深度；每个循环必须有证据。

## 7. 观察项

- 当前辅助 E2E 曾暴露：`doctor --session` 没有按脚本预期输出 `modal-state` recovery；2026-05-04 已修复并用 `check:doctor-modal` 固化。Pre-1.0 仍需继续覆盖页面级 modal 和复杂 blocked state。
- `auth dc` 过去未验证的理由是缺真实外部业务环境证据；用户已明确可以进测试/RND 环境，因此下一轮不能再把它停留在 documented。
- HAR 热录制是否进入 1.0 必须做明确决定；不能长期停在“代码有命令但 supported=false”的模糊状态。
- `scripts/eval/`、`scripts/benchmark/results/` 和旧 E2E 资产需要清理审计：有入口、有复用价值才保留；否则移除或迁入 CodeStable 稳定结论。
- `cla` 指向的具体工具名后续需要按用户语境校准；本轮先按“Claude Code / 本地 Agent CLI 这一类工具体验”纳入能力参考，不把未确认外部产品写成 shipped contract。
- 当前 34 个循环已经超过用户要求的 20+ 循环下限；后续新增能力可以加 item，但不能用新增愿景稀释 Pre-1.0 / RC / 1.0 的出口证据。

## 8. 变更日志

- 2026-05-04：创建 Pre-1.0 系统攻关 roadmap，作为下一轮 goal-driven 工作入口。
- 2026-05-04：完成 `repo-cleanup-baseline`。删除 tracked 生成物/过程文件 309 个，补充 `.gitignore` 防回归，清理审计写入 `codestable/audits/2026-05-04-repo-cleanup-baseline/index.md`。
- 2026-05-04：按用户新增要求扩展为一个月级 1.0 冲刺：每个 command 深评、核心 workflow 串联、参考同类本地 Agent/browser CLI 能力，并拆成 30+ 个可执行循环。
- 2026-05-04：完成 `sprint-capability-reference-survey` 官方来源核对，明确只吸收本地 Agent-first 浏览器能力，不吸收 browser-use cloud/tunnel/API、远程控制、托管 profile 或 Stagehand 式无边界 LLM action/extract 平台。
- 2026-05-04：完成 `command-eval-observation-reading`。覆盖 Agent 首读和页面事实读取主链，并修复 `locate --return-ref` 在 checked checkbox 场景不返回 ref 的缺陷。
- 2026-05-04：完成 `command-eval-interaction-input`。覆盖表单输入、点击、键盘、hover、滚动、坐标 mouse、resize、上传、拖拽和下载主链。
- 2026-05-04：完成 `command-eval-wait-assert-state`。覆盖 wait / verify / get / is / locate 的等待、断言、失败 envelope 和 false 状态，并修复 `wait --state` 未生效的问题。
- 2026-05-04：完成 `command-eval-page-tab-workspace`。覆盖 page/tab/dialog/snapshot/ref workspace identity，修复 `snapshot status --output json` 双 envelope 问题，并明确 `page dialogs` 不是 pending browser dialog live list。
- 2026-05-04：完成 `command-eval-diagnostics-runs`。覆盖 diagnostics digest/export/bundle/runs/show/grep/timeline、doctor 和 errors，并修复 doctor Node 24 环境基线误判与 diagnostics show/grep help 漂移。
- 2026-05-04：完成 `command-eval-network-console-errors`。覆盖 console、network、errors、sse 的过滤、current navigation、body snippet/full body 和 requestfailed 观测。
- 2026-05-04：完成 `command-eval-trace-har-video-artifacts`。覆盖 screenshot、pdf、trace、video 的 artifact 证据产出；HAR start/stop 明确为 `supported=false` documented limitation，后续由 `har-trace-1-0-decision` 决定实现、降级或移出 1.0 contract。
- 2026-05-04：完成 `command-eval-route-mock-bootstrap`。覆盖 route/mock、bootstrap 和 `pw code` 受控测试 substrate；修复 `route add --match-query-file` 命中后因 `URL` 全局缺失导致 session closed 的 P1。
- 2026-05-04：完成 `command-eval-environment-controls`。覆盖 offline、geolocation、permissions、clock 的单命令深评，并明确 clock 未 install 时当前顶层错误码为 `ENVIRONMENT_CLOCK_SET_FAILED`、message 含 `CLOCK_REQUIRES_INSTALL`。
- 2026-05-04：完成 `command-eval-auth-state-storage-profile`。覆盖 auth list/info/probe/fixture-auth、cookies、storage local/session/indexeddb、state save/load/diff、profile list-chrome；修复 `state diff --include-values` value-only storage 变化漏进 `summary.changedBuckets` 的 P1；`auth dc` 仍保持 documented，等待真实测试/RND 环境证明。
- 2026-05-04：完成 `command-eval-batch-code-dashboard-skill-sse`。覆盖 batch、code、dashboard open、skill path/install、sse 的工具边界；明确 batch 只承诺 single-session `string[][]` 稳定子集，dashboard 只做人类观察/接管面；修正 `dashboard open --timeout` 文档漂移。
- 2026-05-04：完成 `workflow-eval-browser-automation`。按 `skills/pwcli/` 标准闭环串联 session、观察、定位、动作、等待、断言、截图和 diagnostics bundle；最终证据 `wfauto2` 干净通过，bundle audit 为 `no_strong_failure_signal`。
- 2026-05-04：完成 `workflow-eval-automated-testing`。串联本地 HTTP fixture、route mock、environment geolocation、正向断言和失败报告；修复 `VERIFY_FAILED` 未写入 run artifact 导致 diagnostics bundle 无法归因的 P1。
- 2026-05-04：按用户要求收紧执行口径：34 个 roadmap 循环映射传统一个月冲刺，53 个 command matrix 行作为逐 command 深评粒度；竞品能力必须落到 command / workflow / skill / roadmap item / dropped 结论。
- 2026-05-04：完成 `workflow-eval-form-file-download`。串联登录、受保护页面导航、上传、拖拽、下载、截图、PDF 和 diagnostics bundle；文件下载内容、截图和 PDF artifact 均有本地证据。
- 2026-05-04：完成 `workflow-eval-crawler-extraction`。串联多页导航、低噪声读取、列表计数、小范围 DOM/iframe 结构化提取、API 证据导出、截图和 diagnostics bundle；明确不恢复旧 `extract` recipe 平台。
- 2026-05-04：完成 `workflow-eval-deep-bug-reproduction`。串联业务 500 复现、页面事实恢复、console/network/errors/digest/timeline/export/bundle；发现并修复 diagnostics bundle 将 session 级 signal 误归因到最新 screenshot run 的 P1。
- 2026-05-04：完成 `workflow-eval-recovery-handoff`。验证 browser dialog blocked state 下 action envelope、doctor、dialog dismiss、恢复后 diagnostics bundle 和 run handoff；明确 blocked 当下 bundle 也会返回 `MODAL_STATE_BLOCKED`，不能包装成可绕过 browser dialog。
- 2026-05-04：完成 `real-env-access-map`。梳理测试/RND/Forge/DC 真实验证入口、敏感信息边界和 `auth dc` proof/blocker 分流；下一轮必须使用明确 `targetUrl` 证明 provider，或建立正式 blocker。
- 2026-05-04：完成 `auth-dc-real-env-proof` 的 blocker 闭环。真实 provider 尝试未通过：默认 local-ip 入口不可达，明确 `targetUrl` 尝试触发 `RUN_CODE_TIMEOUT` 并导致 session probe 失败；`auth` command matrix 改为 blocked，等待标准 issue 分析或有效环境材料解除。

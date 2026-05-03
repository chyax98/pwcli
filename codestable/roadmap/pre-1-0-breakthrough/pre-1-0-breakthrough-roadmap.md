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

## 3. 模块拆分（概设）

```text
pre-1-0-breakthrough
├── Real Environment Validation：测试/RND/Forge/DC 真实环境验证
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
skill SOP audit: pass
CodeStable truth audit: pass
辅助 E2E: pass 或明确 dropped 并移除 package script
```

## 5. 子 feature 清单

1. **repo-cleanup-baseline**：清理过程文件、旧文档、无入口资产和脚本漂移，建立“什么能留在仓库”的清单。
2. **e2e-helper-contract-alignment**：决定 `scripts/e2e/pwcli-dogfood-e2e.sh` 是保留、拆分还是移除；若保留，修到与当前唯一 contract 一致。
3. **real-env-access-map**：梳理测试/RND/Forge/DC 可访问入口、账号材料边界、验证 SOP 和安全记录规则。
4. **auth-dc-real-env-proof**：在测试/RND 环境真实验证 `auth dc`，将 `documented` 推进到 `proven` 或记录环境 blocker。
5. **modal-doctor-recovery-breakthrough**：修复并验证 modal / dialog / doctor / page read blocked state 的一致恢复链路。
6. **run-code-timeout-recovery-breakthrough**：系统验证 `RUN_CODE_TIMEOUT`、长导航、长网络等待的恢复路径和 skill SOP。
7. **evidence-bundle-1-0-contract**：定义并实现 1.0 证据包 manifest、run timeline 和 handoff 报告稳定 contract。
8. **har-trace-1-0-decision**：决定 HAR 热录制是否进入 1.0；能稳定就实现并验证，不能就从 1.0 contract 明确移除。
9. **real-agent-task-matrix**：在本地 + 测试/RND 环境跑真实 Agent 场景矩阵：自动化、测试、填表、爬取、Deep Bug、复现分析。
10. **skill-sop-1-0-audit**：全面重审 `skills/pwcli/`，补齐中文优先 SOP、真实环境、失败恢复、证据交接和反模式。
11. **codestable-truth-1-0-audit**：全面重审 CodeStable 文档，确保 architecture 只记现状、roadmap 只记规划、command docs 全覆盖且证据状态准确。
12. **pre-1-0-release-gate**：发布 Pre-1.0，允许保留已记录 P2/P3，不允许未解释 P0/P1。
13. **rc-blocker-burn-down**：修复 Pre-1.0 暴露的 P0/P1，冻结 1.0 contract。
14. **one-dot-zero-acceptance**：生成 1.0 最终验收报告，跑全量 gate，确认 skill 和 CodeStable 文档是最终 truth。

## 6. 排期思路

先做 `repo-cleanup-baseline` 和 `e2e-helper-contract-alignment`，因为当前工作树已暴露辅助脚本 contract 漂移。随后进入真实环境 access map 和 `auth dc` 验证，把“本地不能证明”的能力拉到测试/RND 环境。然后攻 recovery 与 evidence 两条主线，最后做 skill / CodeStable 文档审计和 Pre-1.0 发布。

## 7. 观察项

- 当前辅助 E2E 曾暴露：`doctor --session` 没有按脚本预期输出 `modal-state` recovery；2026-05-04 已修复并用 `check:doctor-modal` 固化。Pre-1.0 仍需继续覆盖页面级 modal 和复杂 blocked state。
- `auth dc` 过去未验证的理由是缺真实外部业务环境证据；用户已明确可以进测试/RND 环境，因此下一轮不能再把它停留在 documented。
- HAR 热录制是否进入 1.0 必须做明确决定；不能长期停在“代码有命令但 supported=false”的模糊状态。
- `scripts/eval/`、`scripts/benchmark/results/` 和旧 E2E 资产需要清理审计：有入口、有复用价值才保留；否则移除或迁入 CodeStable 稳定结论。

## 8. 变更日志

- 2026-05-04：创建 Pre-1.0 系统攻关 roadmap，作为下一轮 goal-driven 工作入口。
- 2026-05-04：完成 `repo-cleanup-baseline`。删除 tracked 生成物/过程文件 309 个，补充 `.gitignore` 防回归，清理审计写入 `codestable/audits/2026-05-04-repo-cleanup-baseline/index.md`。

# pwcli v1 架构重构方案

> 状态：**执行文档**（一刀切重构，本文驱动全部改动）  
> 决策时间：2026-05-03  
> 执行方式：单 PR，完成后删除本文或归档为 ADR

---

## 一、为什么重构

当前架构借用了 DDD 的 `app / domain / infra` 分层，但 pwcli 不是业务系统——它没有聚合根、没有领域事件、没有持久化层。结果是：

- `domain/` 极薄，大多数是纯工具函数，DDD 词汇带来错误期望
- 真正的复杂度堆在 `infra/playwright/runtime/`，几个巨型文件无人敢动
- `domain/` 和 `infra/` 之间的边界需要主动执行规则才能维持（否则就出现 domain 里 import `node:fs` 的问题）
- commander.js 渗透进整个调用链，换框架要改几十个文件

**目标：** 按终端工具应有的形态重新设计，让 Agent 看目录名就知道去哪里找代码。

---

## 二、架构原则（不可违反）

1. **CLI contract 不变**：所有命令的 JSON envelope（`ok/command/session/page/data`）和 error code 字符串不改
2. **import 方向单向**：`cli → engine`，`cli → store`，`engine → store`，`auth` 被 `cli` 和 `engine` 调用。永远不反向
3. **commander.js 封在 `cli/` 里**：`engine/`、`store/`、`auth/` 任何文件不得 import commander
4. **纯函数就近折叠**：原 `domain/` 里的纯变换函数折进调用它的 engine 文件，不单独建目录
5. **文件名即文档**：Agent 看文件名就知道里面是什么，不需要读注释

---

## 三、目标目录结构

```
src/
  cli/                          # commander.js 的完整边界，换框架只改这里
    commands/                   # 55个命令文件（瘦：解析→调engine→格式化输出）
      accessibility.ts
      auth.ts
      batch.ts
      bootstrap.ts
      check.ts
      click.ts
      code.ts
      console.ts
      cookies.ts
      dashboard.ts
      diagnostics.ts
      dialog.ts
      doctor.ts
      download.ts
      drag.ts
      environment.ts
      errors.ts
      fill.ts
      get.ts
      har.ts
      hover.ts
      index.ts
      is.ts
      locate.ts
      mouse.ts
      network.ts
      observe.ts
      open.ts
      page.ts
      pdf.ts
      press.ts
      profile.ts
      read-text.ts
      resize.ts
      route.ts
      screenshot.ts
      scroll.ts
      select.ts
      session.ts
      skill.ts
      snapshot.ts
      sse.ts
      state.ts
      storage.ts
      tab.ts
      trace.ts
      type.ts
      uncheck.ts
      upload.ts
      verify.ts
      video.ts
      wait.ts
    parsers/                    # 跨命令共用的 CLI 解析器（原 session-options/state-target/attach-shared）
      session.ts                # requireSessionName, addSessionOption, printSessionAwareCommandError
      target.ts                 # parseStateTarget, parseNth, StateTargetOptions
      batch.ts                  # parseBatchSemanticArgs, parseBatchStateTarget
    batch/                      # batch 执行系统（原 app/batch/）
      plan.ts                   # analyzeBatchPlan, findInvalidBatchStep, SUPPORTED_BATCH_TOP_LEVEL
      executor.ts               # executeBatchStep, runBatch, compactBatchSuccessResult
    output.ts                   # printCommandResult, printCommandError（原 app/output.ts）

  engine/                       # Playwright 能力核心，完全不知道 commander 存在
    shared.ts                   # 引擎底层：DIAGNOSTICS_STATE_KEY, stateAccessPrelude, withDiagnosticsState, managedRunCode
    session.ts                  # session 连接、生命周期、bootstrap、hooks、defaults、output-parsers
                                # 吸收：cli-client.ts + runtime/session.ts + bootstrap.ts + hooks.ts
                                # + output-parsers.ts + domain/session/routing.ts + domain/session/defaults.ts(纯部分)
    observe.ts                  # 页面观察：snapshot, read-text, page facts, locate, get, is, verify, accessibility
                                # 吸收：runtime/state-checks.ts + managedSnapshot(from code.ts)
                                # + domain/interaction/model.ts(语义 locator 表达式)
    workspace.ts                # tab/frame/dialog 投影和管理（原 runtime/workspace.ts，直接迁移）
    identity.ts                 # auth/身份状态：auth-probe, state-diff, storage
                                # 吸收：runtime/identity-state/ 全部三个文件
    environment.ts              # clock, system chrome（原 runtime/environment.ts + infra/system-chrome/profiles.ts）
    act/
      element.ts                # 元素操作：click/fill/type/hover/check/uncheck/select/press（locator-based）
                                # 吸收：runtime/interaction.ts 的元素部分
                                # + action-executor.ts + source-builders.ts + action-failure-classifier.ts
                                # + domain/interaction/action-failure.ts + domain/interaction/errors.ts
      page.ts                   # 页面操作：screenshot/pdf/scroll/drag/upload/download/video/resize/mouse/dialog
                                # 吸收：runtime/interaction.ts 的页面部分
    diagnose/
      core.ts                   # 诊断核心：captureDiagnosticsBaseline, buildDiagnosticsDelta
                                # + managedConsole, managedNetwork, managedErrors, managedObserveStatus
                                # 吸收：domain/diagnostics/helpers.ts + domain/diagnostics/signals.ts
      trace.ts                  # trace：managedTrace, managedTraceInspect（原 diagnostics.ts trace部分）
      route.ts                  # route mock：managedRoute（原 diagnostics.ts route部分）
      har.ts                    # HAR：managedHar, managedHarReplay, managedHarReplayStop
      export.ts                 # bundle export：managedDiagnosticsExport
                                # 吸收：domain/diagnostics/service.ts

  store/                        # 文件系统 I/O，与 Playwright 无关
    artifacts.ts                # run events, run dir（原 infra/fs/run-artifacts.ts）
    config.ts                   # .pwcli/config.json 读写，session defaults 文件读取
                                # 吸收：infra/fs/bootstrap-config.ts + domain/session/defaults.ts(I/O部分)
    health.ts                   # doctor 探针：disk/endpoint/Playwright安装/profile路径检查
                                # 吸收：infra/environment/health-probes.ts + domain/environment/health-checks.ts
    skill.ts                    # skill 路径解析（原 infra/fs/skill-path.ts）

  auth/                         # auth providers
    registry.ts                 # 原 infra/auth-providers/registry.ts
    dc.ts                       # 原 infra/auth-providers/dc.ts

  cli.ts                        # 5行入口，不动
  version.ts                    # 不动
```

---

## 四、路径别名

### package.json（运行时解析）

```json
"imports": {
  "#engine/*": "./dist/engine/*",
  "#cli/*":    "./dist/cli/*",
  "#store/*":  "./dist/store/*",
  "#auth/*":   "./dist/auth/*"
}
```

### tsconfig.json（TypeScript 类型检查）

在 `compilerOptions` 里加：

```json
"paths": {
  "#engine/*": ["./src/engine/*"],
  "#cli/*":    ["./src/cli/*"],
  "#store/*":  ["./src/store/*"],
  "#auth/*":   ["./src/auth/*"]
}
```

### 使用方式

```ts
// cli/commands/click.ts
import { managedClick }        from "#engine/act/element.js";
import { printCommandResult }   from "#cli/output.js";
import { requireSessionName }   from "#cli/parsers/session.js";

// engine/act/element.ts
import { managedRunCode }       from "#engine/shared.js";
import { appendRunEvent }       from "#store/artifacts.js";

// engine/session.ts
import { readDefaultsConfig }   from "#store/config.js";
```

**规则：** import 里的 `#` 前缀告诉你这行代码跨了架构层。同层内部（engine 模块之间）用相对路径。

---

## 五、完整文件迁移映射

### 5.1 删除（不再需要）

| 原路径 | 原因 |
|---|---|
| `src/infra/playwright/runtime.ts` | barrel re-export，被路径别名取代 |
| `src/infra/playwright/runtime/identity-state.ts` | barrel，内容折进 engine/identity.ts |
| `src/app/commands/session-options.ts` | 迁移到 cli/parsers/session.ts |
| `src/app/commands/state-target.ts` | 迁移到 cli/parsers/target.ts |
| `src/app/commands/attach-shared.ts` | 折进 cli/parsers/session.ts |
| `src/domain/` (整个目录) | 内容全部折进对应 engine/ 文件 |
| `src/infra/` (整个目录) | 内容全部迁移到新位置 |
| `src/app/` (整个目录) | 内容全部迁移到 cli/ |

### 5.2 直接迁移（内容不变，只移路径）

| 原路径 | 新路径 | 备注 |
|---|---|---|
| `src/app/commands/*.ts` (53个) | `src/cli/commands/*.ts` | import 路径改为别名 |
| `src/app/batch/run-batch.ts` | 拆分见下方 5.3 | |
| `src/app/output.ts` | `src/cli/output.ts` | 移除 printJson 的 export（dead export） |
| `src/infra/playwright/runtime/workspace.ts` | `src/engine/workspace.ts` | import 路径改为别名 |
| `src/infra/playwright/runtime/environment.ts` | `src/engine/environment.ts` | 合并 system-chrome/profiles.ts |
| `src/infra/fs/run-artifacts.ts` | `src/store/artifacts.ts` | |
| `src/infra/fs/skill-path.ts` | `src/store/skill.ts` | |
| `src/infra/auth-providers/registry.ts` | `src/auth/registry.ts` | |
| `src/infra/auth-providers/dc.ts` | `src/auth/dc.ts` | |

### 5.3 折叠合并（多个旧文件 → 一个新文件）

#### `src/engine/shared.ts`
吸收来源：
- `src/infra/playwright/runtime/shared.ts` → 全部（DIAGNOSTICS_STATE_KEY, stateAccessPrelude, withDiagnosticsState）
- `src/infra/playwright/runtime/code.ts` → managedRunCode（核心执行原语）

managedSnapshot 从 code.ts 迁移到 `engine/observe.ts`。

#### `src/engine/session.ts`
吸收来源：
- `src/infra/playwright/cli-client.ts` → 全部（session 连接管理）
- `src/infra/playwright/runtime/session.ts` → 全部（managedSession*）
- `src/infra/playwright/runtime/bootstrap.ts` → 全部（diagnostics bootstrap）
- `src/infra/playwright/runtime/hooks.ts` → 全部（ensureDiagnosticsHooks）
- `src/infra/playwright/output-parsers.ts` → 全部（parseManagedOutput）
- `src/domain/session/routing.ts` → sessionRoutingError（错误映射）
- `src/domain/session/defaults.ts` → SessionDefaults 类型 + DEFAULT_SESSION_DEFAULTS 常量（纯部分）

#### `src/engine/observe.ts`
吸收来源：
- `src/infra/playwright/runtime/state-checks.ts` → 全部（managedLocate, managedGet, managedIs, managedVerify）
- `src/infra/playwright/runtime/code.ts` → managedSnapshot
- `src/domain/interaction/model.ts` → semanticLocatorExpression（只在 observe 的语义定位中使用）

#### `src/engine/identity.ts`
吸收来源：
- `src/infra/playwright/runtime/identity-state/auth-probe.ts` → 全部
- `src/infra/playwright/runtime/identity-state/state-diff.ts` → 全部
- `src/infra/playwright/runtime/identity-state/storage.ts` → 全部

#### `src/engine/act/element.ts`
吸收来源：
- `src/infra/playwright/runtime/interaction.ts` → 元素操作部分：managedClick, managedFill, managedType, managedHover, managedCheck, managedUncheck, managedSelect, managedPress（locator-based）
- `src/infra/playwright/runtime/action-executor.ts` → 全部（dispatchLocatorAction, assertFreshRefEpoch, recordActionRun）
- `src/infra/playwright/runtime/source-builders.ts` → 全部（语义 locator 代码生成）
- `src/infra/playwright/runtime/action-failure-classifier.ts` → 全部（classifyActionFailure）
- `src/domain/interaction/action-failure.ts` → isActionFailure, ActionFailure
- `src/domain/interaction/errors.ts` → parseActionError
- `src/domain/interaction/model.ts` → NormalizedSemanticTarget, normalizeSemanticTarget, SelectorTarget（act 使用的部分）

#### `src/engine/act/page.ts`
吸收来源：
- `src/infra/playwright/runtime/interaction.ts` → 页面操作部分：managedScreenshot, managedPdf, managedScroll, managedDrag, managedUpload, managedDownload, managedVideoStart, managedVideoStop, managedResize, managedMouseMove, managedMouseClick, managedMouseDblclick, managedMouseWheel, managedMouseDrag, managedDialog, managedWait, managedReadText

注：managedReadText 和 managedWait 虽然是"读"，但实现上在 interaction.ts 的页面操作区，保持在 page.ts 更便于维护。

#### `src/engine/diagnose/core.ts`
吸收来源：
- `src/infra/playwright/runtime/diagnostics.ts` → captureDiagnosticsBaseline, buildDiagnosticsDelta, managedObserveStatus, managedConsole, managedNetwork, managedErrors
- `src/domain/diagnostics/helpers.ts` → 全部（objectRecord, stringValue, numberValue 等辅助函数）
- `src/domain/diagnostics/signals.ts` → 全部（信号提取函数）

#### `src/engine/diagnose/trace.ts`
吸收来源：
- `src/infra/playwright/runtime/diagnostics.ts` → managedTrace, managedTraceInspect, parseTraceArtifactPath, runTraceCli（私有）

#### `src/engine/diagnose/route.ts`
吸收来源：
- `src/infra/playwright/runtime/diagnostics.ts` → managedRoute

#### `src/engine/diagnose/har.ts`
吸收来源：
- `src/infra/playwright/runtime/diagnostics.ts` → managedHar, managedHarReplay, managedHarReplayStop

#### `src/engine/diagnose/export.ts`
吸收来源：
- `src/infra/playwright/runtime/diagnostics.ts` → managedDiagnosticsExport
- `src/domain/diagnostics/service.ts` → 全部（listRunDirs, readRunEvents 等）

#### `src/cli/parsers/session.ts`
吸收来源：
- `src/app/commands/session-options.ts` → 全部
- `src/app/commands/attach-shared.ts` → 全部

#### `src/cli/parsers/target.ts`
吸收来源：
- `src/app/commands/state-target.ts` → 全部

#### `src/cli/parsers/batch.ts`
吸收来源：
- `src/app/batch/run-batch.ts` → parseBatchSemanticArgs, parseBatchStateTarget

#### `src/cli/batch/plan.ts`
吸收来源：
- `src/app/batch/run-batch.ts` → analyzeBatchPlan, findInvalidBatchStep, SUPPORTED_BATCH_TOP_LEVEL, classifyBatchStep, formatBatchArgv, unsupportedBatchStepMessage, extractReasonCode, buildBatchStepSuggestions

#### `src/cli/batch/executor.ts`
吸收来源：
- `src/app/batch/run-batch.ts` → executeBatchStep, runBatch, compactBatchSuccessResult

#### `src/store/config.ts`
吸收来源：
- `src/infra/fs/bootstrap-config.ts` → 全部（bootstrap config 读取）
- `src/domain/session/defaults.ts` → readDefaultsConfig, getSessionDefaults, resolveLifecycleHeaded, resolveTraceEnabled, applySessionDefaults（I/O 和 infra 调用部分）

#### `src/store/health.ts`
吸收来源：
- `src/infra/environment/health-probes.ts` → 全部（I/O 探针）
- `src/domain/environment/health-checks.ts` → DoctorStatus, DoctorDiagnostic 类型 + expandPath + 纯辅助函数（summarizeDiagnostics, compactDoctorDiagnostic, doctorRecovery 等）

---

## 六、import 方向规则

```
cli/commands/    →  #engine/*  ✓
cli/commands/    →  #cli/*     ✓  (parsers, output)
cli/commands/    →  #store/*   ✗  (命令不直接读文件系统，由 engine 或 cli/batch 处理)
cli/batch/       →  #engine/*  ✓
cli/batch/       →  #cli/*     ✓  (parsers)
cli/batch/       →  #store/*   ✓  (artifacts 写 run event 可以)

engine/*         →  #engine/*  ✓  (同层相对路径)
engine/*         →  #store/*   ✓  (engine 可以写 artifact)
engine/*         →  #cli/*     ✗  (绝对禁止)
engine/*         →  #auth/*    ✓  (session 调用 auth providers)

store/*          →  #store/*   ✓  (同层相对路径)
store/*          →  #engine/*  ✗  (绝对禁止)
store/*          →  #cli/*     ✗  (绝对禁止)

auth/*           →  #engine/*  ✓  (dc.ts 需要 managedRunCode 等)
auth/*           →  #store/*   ✓
auth/*           →  #cli/*     ✗
```

同层内部用相对路径（`./session.js`），跨层用别名（`#engine/session.js`）。

---

## 七、三个需要同步修复的 Bug（重构时一并处理）

在移动文件的同时，修复以下已确认的 P1 bug：

### Bug 1：batch verify 跳过 assertion 枚举校验（run-batch.ts:1143）
```ts
// 当前（错误）：
const assertion = args[0] as any;

// 修复后（cli/batch/executor.ts）：
const VALID_ASSERTIONS = ["text", "visible", "hidden", "checked", "unchecked", "enabled", "disabled", "focused", "count"] as const;
const assertion = args[0];
if (!VALID_ASSERTIONS.includes(assertion as any)) {
  throw new Error(`BATCH_VERIFY_INVALID_ASSERTION:${assertion}`);
}
```

### Bug 2：batch route load 静默丢字段（run-batch.ts:617）
将 `matchQuery / matchHeaders / matchJson / patchText / mergeHeaders` 补入 batch route 的参数传递。

### Bug 3：tab select TOCTOU（workspace.ts:557）
tab select 不应将 pageId 转成 projection index 再执行。直接传 pageId，让底层按 stable identity 操作。

---

## 八、不动的文件

以下文件内容基本不变，只更新 import 路径：

| 文件 | 原因 |
|---|---|
| `src/cli.ts` | 5行入口，只改注册命令的 import |
| `src/version.ts` | 纯常量 |
| `src/engine/workspace.ts` | 内容合理，直接迁移 |
| `src/engine/environment.ts` | 直接迁移（合并 system-chrome） |
| 所有 `cli/commands/*.ts` | 内容基本不变，只改 import 路径 |

---

## 九、验证检查表

重构完成后按顺序验证：

```bash
# 1. 类型检查
pnpm typecheck

# 2. 编译
pnpm build

# 3. 帮助文本完整性（每个命令都能 --help）
node dist/cli.js --help
node dist/cli.js click --help
node dist/cli.js snapshot --help
node dist/cli.js batch --help

# 4. 冒烟测试
pnpm smoke

# 5. 没有跨层 import（CLI 不应 import engine）
grep -r "from.*engine/" src/store/ && echo "FAIL: store imports engine" || echo "OK"
grep -r "from.*cli/" src/engine/ && echo "FAIL: engine imports cli" || echo "OK"
grep -r "from.*infra/\|from.*domain/\|from.*app/" src/ && echo "FAIL: old paths remain" || echo "OK"
```

---

## 十、执行顺序（一刀切内部的有序操作）

虽然是单 PR，建议按以下顺序操作，每步完成立刻 typecheck，错误不过不进下一步：

1. **先建目录结构**：`mkdir -p src/cli/{commands,parsers,batch} src/engine/{act,diagnose} src/store src/auth`
2. **配置路径别名**：改 `package.json` + `tsconfig.json`
3. **迁移 store/**：最无依赖，先搬（artifacts、config、health、skill）
4. **迁移 auth/**：无 engine 依赖
5. **建 engine/shared.ts**：其他 engine 文件的基础
6. **建 engine/session.ts**：合并 cli-client + session + bootstrap + hooks
7. **建 engine/act/element.ts**：合并 interaction(元素) + action-executor + source-builders + classifiers
8. **建 engine/act/page.ts**：合并 interaction(页面)
9. **建 engine/observe.ts**：合并 state-checks + managedSnapshot
10. **建 engine/workspace.ts**：直接迁移
11. **建 engine/identity.ts**：合并 identity-state 三个文件
12. **建 engine/environment.ts**：迁移 + 合并 system-chrome
13. **建 engine/diagnose/**：拆分 diagnostics.ts → core/trace/route/har/export
14. **建 cli/parsers/**：迁移 session-options/state-target/attach-shared
15. **建 cli/batch/**：拆分 run-batch.ts → plan/executor
16. **建 cli/output.ts**：迁移 app/output.ts，清除 printJson dead export
17. **建 cli/commands/**：迁移全部命令文件，逐一更新 import 路径
18. **修 cli.ts**：更新入口 import 路径
19. **修三个 P1 bug**：verify assertion、route load 字段、tab select TOCTOU
20. **删除旧目录**：`src/app/`、`src/domain/`、`src/infra/`

---

## 十一、文档同步

重构完成后必须更新：

- `codestable/architecture/domain-status.md` → 描述新的 engine/cli/store 分层
- `codestable/architecture/command-surface.md` → 更新命令注册路径
- `.claude/rules/03-architecture-boundaries.md` → 更新分层规则为 cli/engine/store/auth
- `AGENTS.md` → 更新项目结构说明
- `skills/pwcli/` → 确认 CLI contract 未变，无需改动

---

*本文完整描述了重构的目标状态和执行路径。重构完成后归档为 `codestable/architecture/adr-004-engine-first-architecture.md`。*

# Domain Status

更新时间：2026-05-01

这份文档记录每个领域的：

- 当前实现
- 当前限制
- 后续扩展口

## 1. Session

### 当前实现

- `session create|attach|recreate|list|status|close`
- `dashboard open` exposes Playwright-core's bundled session dashboard as a thin wrapper.
- `session list --attachable` exposes Playwright server-registry discovery as read-only attach candidates.
- `session attach --attachable-id <id>` attaches to one connectable server returned by `session list --attachable`
- `session list --attachable` also projects machine-readable capability facts for workspace-level attachability and per-target attach capability
- session 名硬限制：
  - 最长 16 字符
  - 只允许字母、数字、`-`、`_`
- session defaults:
  - headed
  - trace
  - diagnostics records
  - run artifacts
- same-session lifecycle startup/reset/close and managed command dispatch use a per-session lock before entering the Playwright substrate; lock timeout reports recoverable `SESSION_BUSY`
- same-name lifecycle startup/reset also holds a fail-fast startup lane for the lifetime of that CLI process, so concurrent `session create|recreate` for the same name returns structured `SESSION_BUSY` instead of leaking substrate startup races such as raw `EADDRINUSE`
- `session recreate` waits briefly after stop and guards replacement browser startup with `SESSION_RECREATE_STARTUP_TIMEOUT` instead of hanging indefinitely on profile/startup substrate stalls

### 当前限制

- `session status` 只做快速状态检查；页面忙、弹窗阻塞、浏览器断连时可能拿不到完整页面信息，异常时用 `pw doctor --session <name>` 复查
- `session attach --browser-url/--cdp` 只能接管当前机器上可连接的浏览器调试端口；连接失败时先确认浏览器是否用远程调试参数启动、端口是否可访问
- `session list --attachable` 只发现 Playwright-core 已登记的 browser servers，不做进程扫描、不自动 attach、不替代 `session create|attach|recreate` 主路
- `--attachable-id` 只接管当前 workspace registry 里仍可连接的 browser server；它不是 extension bridge，也不做跨 workspace 发现
- `dashboard open` relies on an internal/hidden Playwright CLI surface and must fail as `DASHBOARD_UNAVAILABLE` if the entrypoint disappears, or `DASHBOARD_LAUNCH_FAILED` if the subprocess exits during startup.

### 后续扩展

- 只有出现真实跨工具接管场景，再评估 raw CDP named-session substrate
- 当前 existing-browser enhancement 先停在 attachable server one-hop attach，不扩成 extension/native-host bridge
- CLI 是唯一 authoritative 命令面；如果后续再引入第二调用面，也只能复用同一批 domain/service substrate，不重建并行产品面

## 2. Workspace

### 当前实现

- `page current|list|frames|dialogs`
- `page assess`
- `tab select|close <pageId>`
- `observe status`
- page / frame / dialog projection
- `page assess` returns a compact read-only summary: page kind, data-layer hints, complexity hints, and next read commands
- `observe status` 默认 compact，`--verbose` 返回完整状态载荷
- workspace mutation contract 已单独定义在 `workspace-mutation-contract.md`

### 当前限制

- `page dialogs` 是事件投影
- `tab select|close` 只接受 `pageId`，不接受 index / title / URL substring 作为写操作目标
- `page assess` is inference-only: it does not export runtime state, storage state, or network payloads, and it is not an action planner, target picker, or document classifier

### 后续扩展

- 如果继续扩 workspace 写操作，仍然先定义 stable target identity
- `page assess` 当前冻结在 compact summary 边界；后续只有在真实高频场景里才补 selector-scoped assessment 或更窄的 hints，不把它扩成 planner 或页面智能层

## 3. Interaction

### 当前实现

- `dialog accept|dismiss`
- `click`
- `fill`
- `type`
- `press`
- `scroll`
- `upload`
- `download`
- `hover`
- `resize`
- `screenshot`
- `pdf`
- `drag`
- `check|uncheck|select`
- `wait`
- `code`
- `snapshot` records the latest ref epoch for the active page/navigation identity
- ref-backed `click` / `fill` / `type` validate against the latest snapshot epoch before reporting success
- `locate|get|is` state-check primitives for compact read-only target checks
- `upload` best-effort waits for input file count plus `change` / `input` settle, and returns `nextSteps` when page-level acceptance still needs verification
- `domain/interaction/model.ts`：统一 domain 类型（`SemanticTarget`、`NormalizedSemanticTarget`、`SelectorTarget`、`RefEpochValidation`、`RunEvent`、`RunEventTargetKind`）和纯函数（`normalizeSemanticTarget`、`semanticLocatorExpression`、`buildRunEvent`、`parseRefEpochValidation`）
- `domain/interaction/errors.ts`：集中 Node.js 侧错误码常量（`InteractionErrorCode`）、recovery 工厂函数（`refStaleFailure`、`inspectRecovery` 等）
- `action-executor` 模块封装 action 执行编排：baseline capture、runCode、diagnostics delta、run event recording、失败截图
- `dispatchLocatorAction` 统一 semantic/selector/ref 三分支模式，所有标准 action（click/fill/type/hover/check/uncheck/select）通过此接口执行
- `source-builders` 模块集中 JS source 字符串构建函数（`selectorActionSource`、`semanticClickSource` 等），与执行逻辑分离

### 当前限制

- `MODAL_STATE_BLOCKED` 会阻断 run-code-backed 路径
- `batch` 当前只承诺稳定子集；click 覆盖 ref、selector、text、role/name，不追求完整 click flag parity
- snapshot refs are not stable cross-navigation identifiers; after navigation, tab switch, or a new snapshot, old refs fail as `REF_STALE`
- `batch` 当前只做单 session 串行执行，不做 lifecycle / environment / diagnostics query 容器
- dialog 恢复当前只覆盖 browser dialog handle，不覆盖更复杂的页面级阻断控件
- `locate|get|is|verify` 只做 read-only state check；不返回 ref、不规划动作
- `get value` 依赖 Playwright `inputValue()`，只适合 input/textarea/select 等表单控件
- `pw code` 和 run-code-backed semantic/read paths 受 Playwright daemon completion 等待影响；pwcli 以 `RUN_CODE_TIMEOUT` 防止无限卡住，长流程应拆成一等命令 + 显式 wait

### 后续扩展

- batch 只在真实高频场景下增量扩命令，不追求全量 parity
- `verify` 后续只补真实场景断言覆盖，不扩大成动作规划器

## 2.5 Environment Health Checks

### 当前实现

- `domain/environment/health-checks.ts`：纯函数，从 `doctor.ts` 提取
- 包括路径验证（`expandPath`、`canReadPath`、`canWritePath`）、profile 路径检查、网络连通性检查、Auth provider 可用性探测
- 供 `pw doctor` 命令和未来 health check 命令复用

### 当前限制

- 目前只被 `doctor.ts` 消费
- 网络连通性检查依赖 Node.js `net.connect`，不走 Playwright

### 后续扩展

- 如果出现第二个消费方（verify、CI health check），seam 已经存在，直接 import 即可

## 4. Identity State

### 当前实现

- `state save|load`
- `state diff` read-only before/after comparison for cookies, `localStorage` keys, `sessionStorage` keys, and IndexedDB metadata
- `cookies list|set`
- `storage local|session` read + current-origin `get|set|delete|clear`
- `storage indexeddb export` read-only current-origin summary + optional sampled previews
- `auth probe` read-only auth-state heuristic with `authenticated|anonymous|uncertain`, `confidence`, `blockedState`, `recommendedAction`, and three signal layers (`pageIdentity` / `protectedResource` / `storage`)
- `auth probe` also projects machine-readable capability facts: `available`, `blocked`, `reusableStateLikely`
- `profile inspect`
- `profile list-chrome` discovers local Chrome profiles for `session create --from-system-chrome`
- `profile inspect` / `profile list-chrome` project capability facts for persistent-profile-path and system-chrome-profile-source
- `auth` 内置 provider 执行 + `save-state`
- `dc` 是内置 DC/Forge auth provider；provider 参数以 `pw auth info dc` 为准，目标解析顺序为显式 `targetUrl`、当前 Forge 页面、provider 默认目标
- `fixture-auth` 是内部 contract 测试 provider，用于 smoke 验证 auth 执行链

### 当前限制

- `storage local|session get|set|delete|clear` 只作用于当前页 origin，不做跨 origin storage 编辑
- `state diff` 当前只做 metadata comparison：cookie 摘要、local/session storage key 集合、IndexedDB database/store metadata + `countEstimate`；不做 local/session value diff，也不做 Cache Storage / service worker diff
- `storage indexeddb export` 只读、只看当前页 origin；不做 mutation、跨 origin 遍历、profile 级迁移，也不替代 Cache Storage / service worker 探测
- `auth probe` 当前只做通用启发式判断：可选 `--url` 只读导航、不调用站点级 `/me` 接口、不替代站点特化 auth pack 或站点规则库
- `auth` 不负责 session shape
- `--from-system-chrome` 不复制 profile；它用 Chrome user data dir + profile-directory 启动 session，因此同 profile 被 Chrome 占用时会失败
- `dc` 不接受 `instance` 参数；不暴露环境参数，用户给具体业务 URL 时由 skill 作为 `targetUrl` 传入
- `profile open` 已移除
- 当前没有外部 plugin 加载、安装、发现、生命周期机制

### 后续扩展

- `auth probe` 当前冻结在 generic probe 边界；只有真实重复场景出现时，才评估更深层 value diff、Cache Storage probe 或额外页面事实采集能力

## 5. Diagnostics

### 当前实现

- 默认 stdout 是 agent-readable text，`--output json` 保留旧 JSON envelope
- `console`
- `network`
- `errors recent|clear`
- `diagnostics digest`
- `diagnostics export`
- `diagnostics bundle`
- `diagnostics runs|show|grep|timeline`
- `--since` on live/session query commands
- `--text` on `diagnostics export`
- `alias=path` field projection on `diagnostics export|show|grep`
- `--session|--since` filters on `diagnostics runs`
- `trace inspect <trace.zip> --section actions|requests|console|errors`
- `doctor` 默认 compact，`--verbose` 返回完整 probe
- action 结果里的 `diagnosticsDelta`
- `.pwcli/runs/<runId>/events.jsonl`
- Playwright substrate 原始产物归档在 `.pwcli/playwright/`，包括 trace、snapshot 附件、console 附件、download 附件
- `pdf` 是低频 active-page archive evidence，不做报告生成、合并或批量归档
- Trace CLI 是离线 trace zip 查询面；Trace Viewer 是人类可视化重放；Playwright Test HTML report / UI mode 不属于 pwcli diagnostics；`.pwcli/runs/<runId>/events.jsonl` 是轻量动作事件，不替代 trace zip

### 当前限制

- 没有 event stream
- 不是持久化诊断数据库
- `har start|stop` 只暴露 substrate 边界
- 已存在的老 session 仍按启动时 substrate 配置写目录；新建或 recreate 后才使用当前 artifact 根目录
- `trace inspect --level` 受 Playwright trace CLI console 过滤能力限制，当前只稳定映射 `error` / `warning`

### 后续扩展

- query 深化
- mock 第二层
- stream / heavier substrate survey

## 5.5 Benchmark

### 当前实现

- `benchmark/` deterministic stability harness
- fixture server
- recursive task discovery
- task runner
- suite runner
- minimal suite summary: `total` / `passed` / `failed` / `failures`
- generated deterministic task matrix
- closure suite script
- minimal stability summary contract

### 当前限制

- 当前 benchmark 主体是 deterministic fixture suite，不是 real-site automation
- runner 串行执行，不做并发调度
- summary 目前只输出 `summary.json`，不做 HTML / Markdown / score 报告
- 任务 corpus 通过 generator 产出，不承诺每个 JSON 都手工维护

### 后续扩展

- 只在真实回归需求下增补能力级 case
- 不继续主动扩 benchmark 平台能力

## 6. Bootstrap

### 当前实现

- `session create <name> --init-script <file>`：在 session 创建时直接注入 init script
- `bootstrap apply --init-script --headers-file`：对已有 session 做 live bootstrap
- `bootstrap apply --remove-init-script <file>`：从持久化配置删除单条 init script
- init script 配置自动持久化到 `.pwcli/bootstrap/<sessionName>.json`
- `session recreate` 后自动读取持久化配置并重新 apply bootstrap
- `pw doctor` 报告 bootstrap 配置状态（`initScriptCount`、`appliedAt`）

### 当前限制

- 不负责 lifecycle shape
- bootstrap 配置只按 sessionName 存储；session recreate 时如果 init script 文件路径不存在则报错

### 后续扩展

- 如果出现跨 session 共享 bootstrap template 的需求，再评估 project-level bootstrap spec

## 7. Mock

### 当前实现

- `route list`
- `route add`
- `route add --match-query <key=value>`
- `route add --match-header <key=value>`
- `route load`
- `route remove`
- `--abort`
- `--method`
- `--match-body`
- `--patch-json|--patch-json-file`
- `--patch-status`
- `--body|--body-file`
- `--headers-file`
- `--inject-headers-file`
- `--status`
- `--content-type`

### 当前限制

- richer matching 当前已扩到 body substring、query exact match、request header exact match、JSON request body subset match；还不做 schema-level body matcher
- inject 当前只到 request header merge + continue
- response patch 当前已支持 upstream JSON merge patch、text patch、status override、response header merge；GraphQL patch 走 `match-json + patch-json` 组合，不做单独 planner

### 后续扩展

- 只有真实 controlled-testing / diagnostics / extraction 复现需求时，再补 scenario-backed matcher 或 patch 能力；不把 route/mock 扩成通用场景平台

## 8. Environment

### 当前实现

- `offline on|off`
- `geolocation set`
- `permissions grant|clear`
- `clock install|set|resume`

### 当前限制

- 更复杂的 clock advance / pause 语义还没进入命令面

### 后续扩展

- 如果真实场景需要，再补 `fastForward` / `runFor` / explicit pause

## 9. Skill And Docs

### 当前实现

- `skills/pwcli/` 是唯一使用教程真相
- `docs/architecture/` 只维护设计与现状
- `.claude/` 维护 Agent 项目指令、review 规则、skill 维护规则，不承载项目文档、项目规划、过程归档或 active truth

### 当前限制

- 需要持续同步

### 后续扩展

- 新增命令或 limitation 时，优先改 skill
- review policy 只记录可验证问题，不把文档拼写类问题升级成阻塞问题

## 10. Playwright Substrate Boundary

### 当前实现

- pwcli managed session 复用 Playwright-core CLI daemon / `Session` / registry substrate。
- `run-code` 路径由 Playwright daemon 执行，适合 `pw code` 和需要现场 Playwright 能力的一等命令实现。
- `managedRunCode` 有默认 25s 超时保护：超过 guard timeout 返回 `RUN_CODE_TIMEOUT`，避免 daemon completion wait 无限卡住。
- `session recreate` 在 stop 后等待短暂释放期，并对 replacement browser startup 施加 30s `SESSION_RECREATE_STARTUP_TIMEOUT`。

### 当前限制

- Playwright daemon、dashboard entrypoint、trace CLI 是 internal substrate，不是 pwcli public API contract。
- `waitForCompletion` 是 Playwright daemon 的正常 completion 策略；它可能在导航或网络活动后继续等待。pwcli 不把它包装成任意长流程执行能力。
- `pw code` 应保持小步、可恢复；长导航、长网络等待优先拆成一等 `pw wait` / diagnostics 命令。

### 后续扩展

- 只有当上层 timeout / recovery 不能覆盖真实高频场景时，才评估更深的 substrate 接管或 patch；不默认 fork Playwright-core。

# Domain Status

更新时间：2026-04-28

这份文档记录每个领域的：

- 当前实现
- 当前限制
- 后续扩展口

## 1. Session

### 当前实现

- `session create|attach|recreate|list|status|close`
- `dashboard open` exposes Playwright-core's bundled session dashboard as a thin wrapper.
- session 名硬限制：
  - 最长 16 字符
  - 只允许字母、数字、`-`、`_`
- session defaults:
  - headed
  - trace
  - diagnostics records
  - run artifacts

### 当前限制

- `session status` 只做快速状态检查；页面忙、弹窗阻塞、浏览器断连时可能拿不到完整页面信息，异常时用 `pw doctor --session <name>` 复查
- `session attach --browser-url/--cdp` 只能接管当前机器上可连接的浏览器调试端口；连接失败时先确认浏览器是否用远程调试参数启动、端口是否可访问
- `dashboard open` relies on an internal/hidden Playwright CLI surface and must fail as `DASHBOARD_UNAVAILABLE` if the entrypoint disappears.

### 后续扩展

- 只有出现真实跨工具接管场景，再评估 raw CDP named-session substrate

## 2. Workspace

### 当前实现

- `page current|list|frames|dialogs`
- `tab select|close <pageId>`
- `observe status`
- page / frame / dialog projection
- `observe status` 默认 compact，`--verbose` 返回完整状态载荷
- workspace mutation contract 已单独定义在 `workspace-mutation-contract.md`

### 当前限制

- `page dialogs` 是事件投影
- `tab select|close` 只接受 `pageId`，不接受 index / title / URL substring 作为写操作目标

### 后续扩展

- 如果继续扩 workspace 写操作，仍然先定义 stable target identity

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
- `drag`
- `wait`
- `code`

### 当前限制

- `MODAL_STATE_BLOCKED` 会阻断 run-code-backed 路径
- `batch` 当前只承诺稳定子集
- `batch` 当前只做单 session 串行执行，不做 lifecycle / environment / diagnostics query 容器
- dialog 恢复当前只覆盖 browser dialog handle，不覆盖更复杂的页面级阻断控件

### 后续扩展

- batch 只在真实高频场景下增量扩命令，不追求全量 parity

## 4. Identity State

### 当前实现

- `state save|load`
- `cookies list|set`
- `storage local|session`
- `profile inspect`
- `auth` 内置 provider 执行 + `save-state`
- `dc` 是内置 DC/Forge auth provider；默认手机号和验证码内聚在 provider 内，传了 `targetUrl` 就使用指定业务 URL，未传 URL 时执行默认登录流程
- `fixture-auth` 是内部 contract 测试 provider，用于 smoke 验证 auth 执行链

### 当前限制

- `storage local|session` 只读当前页 origin
- `auth` 不负责 session shape
- `dc` 不接受 `instance` 参数；不暴露环境参数，RND 固定入口由 skill 引导 agent 显式打开
- `profile open` 已移除
- 当前没有外部 plugin 加载、安装、发现、生命周期机制

### 后续扩展

- 如果 Agent 真实需要，再补 richer cookie/storage mutation

## 5. Diagnostics

### 当前实现

- 默认 stdout 是 agent-readable text，`--output json` 保留旧 JSON envelope
- `console`
- `network`
- `errors recent|clear`
- `diagnostics digest`
- `diagnostics export`
- `diagnostics runs|show|grep`
- `--since` on live/session query commands
- `--text` on `diagnostics export`
- `alias=path` field projection on `diagnostics export|show|grep`
- `--session|--since` filters on `diagnostics runs`
- `doctor` 默认 compact，`--verbose` 返回完整 probe
- action 结果里的 `diagnosticsDelta`
- `.pwcli/runs/<runId>/events.jsonl`
- Playwright substrate 原始产物归档在 `.pwcli/playwright/`，包括 trace、snapshot 附件、console 附件、download 附件

### 当前限制

- 没有 event stream
- 不是持久化诊断数据库
- `har start|stop` 只暴露 substrate 边界
- 已存在的老 session 仍按启动时 substrate 配置写目录；新建或 recreate 后才使用当前 artifact 根目录

### 后续扩展

- query 深化
- mock 第二层
- stream / heavier substrate survey

## 6. Bootstrap

### 当前实现

- `bootstrap apply --init-script --headers-file`

### 当前限制

- 只做 live bootstrap
- 不负责 lifecycle shape

### 后续扩展

- 如果出现真实项目 bootstrap 模板，再考虑 file-backed bootstrap spec

## 7. Mock

### 当前实现

- `route list`
- `route add`
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

- richer matching 当前只到 body substring
- inject 当前只到 request header merge + continue
- response patch 当前只到 upstream JSON merge patch + status override

### 后续扩展

- route 第二层：
  - richer matching 是否继续扩到 query/header/json-body
  - response patch 是否需要 header merge 或 text patch

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
- `.codex/` 维护 Codex 项目配置和 skill 维护规则
- `.claude/` 只做本地过程归档，不进入 git

### 当前限制

- 需要持续同步

### 后续扩展

- 新增命令或 limitation 时，优先改 skill
- Codex review policy 只记录可验证问题，不把文档拼写类问题升级成阻塞问题

## 10. 当前阶段目标（2026-04-28）

### 明确目标

- 把 `pwcli` 稳定在“Agent-first 可恢复自动化执行器”定位：主链稳定、错误可恢复、诊断可追溯。

### 接下来优先级

1. 持续守住 workspace mutation contract（写操作只认 stable identity，不回退 index 语义）。
2. 让高频交互动作都产出一致的 run evidence（target + diagnosticsDelta + runId），降低回放定位成本。
3. 维持 skill / architecture / shipped contract 三者同步，避免使用真相漂移。
4. 在不破坏 lifecycle 边界前提下，按真实需求增量扩 batch 稳定子集。


## 11. 后续规划与 Issue 候选（2026-04-28）

> 用于 GitHub issue 拆分的候选清单；优先级按 P0/P1 contract 风险与收益排序。

### I1（P1）批量链路可观测性补齐

- 目标：让 `batch` 子命令失败时输出更稳定的 step-level 证据（步骤索引、命令、错误码、恢复建议）。
- 验收：`batch` 失败能直接映射到 `failure-recovery` 的恢复路径；skill 有对应示例。

### I2（P1）Modal blocked 恢复链路压测

- 目标：对 `MODAL_STATE_BLOCKED` 在常见动作链路（click/fill/code/page）进行回归矩阵，保证 recover hint 一致。
- 验收：新增 smoke/dogfood 覆盖；`failure-recovery` 提供最短恢复序列。

### I3（P1）run evidence 字段一致性守护

- 目标：对高频动作（click/fill/type/press）建立 run event schema 快照，防止字段漂移破坏 `diagnostics show/grep`。
- 验收：字段快照测试 + command reference 同步说明。

### I4（P1）Skill 主链可达性巡检

- 目标：周期性检查主 skill 到 references/workflows 的相对路径路由是否闭环、是否覆盖 70%+ 高频场景。
- 验收：形成固定 checklist，并在每次命令 contract 变更时执行一次。


# Domain Status

更新时间：2026-04-26

这份文档记录每个领域的：

- 当前实现
- 当前限制
- 后续扩展口

## 1. Session

### 当前实现

- `session create|attach|recreate|list|status|close`
- session 名硬限制：
  - 最长 16 字符
  - 只允许字母、数字、`-`、`_`
- session defaults:
  - headed
  - trace
  - diagnostics records
  - run artifacts

### 当前限制

- `session status` 是 best-effort
- `attach --browser-url/--cdp` 依赖本地 attach bridge registry

### 后续扩展

- 只有出现真实跨工具接管场景，再评估 raw CDP named-session substrate

## 2. Workspace

### 当前实现

- `page current|list|frames|dialogs`
- `observe status`
- page / frame / dialog projection
- `observe status` 默认 compact，`--verbose` 返回完整状态载荷

### 当前限制

- `page dialogs` 是事件投影
- 没有 stable workspace mutation contract

### 后续扩展

- 如果要做 `tab select|close`，先定义 stable target identity

## 3. Interaction

### 当前实现

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

### 后续扩展

- batch 只在真实高频场景下增量扩命令，不追求全量 parity

## 4. Identity State

### 当前实现

- `state save|load`
- `cookies list|set`
- `storage local|session`
- `profile inspect`
- `auth` plugin 执行 + `save-state`

### 当前限制

- `storage local|session` 只读当前页 origin
- `auth` 不负责 session shape
- `profile open` 已移除

### 后续扩展

- 如果 Agent 真实需要，再补 richer cookie/storage mutation

## 5. Diagnostics

### 当前实现

- `console`
- `network`
- `errors recent|clear`
- `diagnostics digest`
- `diagnostics export`
- `diagnostics runs|show|grep`
- `doctor` 默认 compact，`--verbose` 返回完整 probe
- action 结果里的 `diagnosticsDelta`
- `.pwcli/runs/<runId>/events.jsonl`

### 当前限制

- 没有 event stream
- 不是持久化诊断数据库
- `har start|stop` 只暴露 substrate 边界

### 后续扩展

- query 深化
- field projection
- body 裁剪

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
- `--body|--body-file`
- `--headers-file`
- `--status`
- `--content-type`

### 当前限制

- 只有第一层 route mock
- 没有 inject
- 没有复杂条件匹配和 response patch 平台

### 后续扩展

- route 第二层：
  - richer matching
  - inject
  - response patch helper

## 8. Environment

### 当前实现

- `offline on|off`
- `geolocation set`
- `permissions grant|clear`
- `clock install|resume`

### 当前限制

- `clock set` 当前是 `ENVIRONMENT_LIMITATION`

### 后续扩展

- 只有在 survey 证明值得时，才继续追 `clock set`

## 9. Skill And Docs

### 当前实现

- `skills/pwcli/` 是唯一使用教程真相
- `docs/architecture/` 只维护设计与现状
- `.claude/archive/` 保留历史草案

### 当前限制

- 需要持续同步

### 后续扩展

- 新增命令或 limitation 时，优先改 skill

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

- `session status` 只做快速状态检查；页面忙、弹窗阻塞、浏览器断连时可能拿不到完整页面信息，异常时用 `pw doctor --session <name>` 复查
- `session attach --browser-url/--cdp` 只能接管当前机器上可连接的浏览器调试端口；连接失败时先确认浏览器是否用远程调试参数启动、端口是否可访问

### 后续扩展

- 只有出现真实跨工具接管场景，再评估 raw CDP named-session substrate

## 2. Workspace

### 当前实现

- `page current|list|frames|dialogs`
- `observe status`
- page / frame / dialog projection
- `observe status` 默认 compact，`--verbose` 返回完整状态载荷
- future mutation contract 已单独定义在 `workspace-mutation-contract.md`

### 当前限制

- `page dialogs` 是事件投影
- 没有 stable workspace mutation contract

### 后续扩展

- 如果要做 `tab select|close`，先定义 stable target identity

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

### 当前限制

- `storage local|session` 只读当前页 origin
- `auth` 不负责 session shape
- `dc` 不接受 `instance` 参数；不暴露环境参数，RND 固定入口由 skill 引导 agent 显式打开
- `profile open` 已移除

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

### 当前限制

- 没有 event stream
- 不是持久化诊断数据库
- `har start|stop` 只暴露 substrate 边界

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
- `.claude/` 只做本地过程归档，不进入 git

### 当前限制

- 需要持续同步

### 后续扩展

- 新增命令或 limitation 时，优先改 skill

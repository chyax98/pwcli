# Command Reference — 诊断与 Mock

适用：查 bug、抓接口异常、导出证据、route mock、trace/HAR 录制。
进入时机：页面异常、接口失败、需要拦截/替换网络请求。

核心交互命令见 `command-reference.md`；
state / auth / batch 命令见 `command-reference-advanced.md`。

## 诊断

### `pw diagnostics digest --session <name>|--run <runId>`

- `--session` 和 `--run` 二选一
- `--session`：live session 摘要（当前页 URL、console/network/error 计数、top signals）
- `--run`：一次 run 的摘要
- `--limit <n>`
- Agent 第一层诊断入口

### `pw console --session <name>`

- `--level info|warning|error`、`--source app|api|react|browser`
- `--text <text>`、`--since <iso>`、`--limit <n>`
- `--current`：只显示当前页面导航的记录，过滤跨页面噪声

### `pw network --session <name>`

- `--url <substring>`、`--kind request|response|requestfailed|console-resource-error`
- `--method <method>`、`--status <code>`、`--resource-type <type>`
- `--text <text>`、`--since <iso>`、`--limit <n>`
- `--current`：只显示当前页面导航的记录，过滤跨页面噪声
- `--request-id <id>`：单请求详情
- 文本类 request/response 默认带 `requestBodySnippet` / `responseBodySnippet`（裁剪后的诊断片段，约 240 字符）
- `--include-body`：返回完整 request/response body，上限 50KB；超过部分截断并标注 `truncated: true`
- request 和 response 是两条记录；不要假设一个 record 同时有 request body 和 response body

### `pw sse --session <name>`

- 读取当前 session 捕获的 SSE（Server-Sent Events）事件记录
- `--since <iso>`、`--limit <n>`（默认 50）、`--url <substring>`
- SSE observer 在 session 启动时自动注入，无需额外配置
- 限制：只捕获 session 建立后通过 `EventSource` 创建的连接；若 SSE 在 session 启动前已建立则无法回溯
- 归入 `diagnostics timeline`（仅 `__error` 类事件）和 `diagnostics bundle`

### `pw errors recent --session <name>`

- `--text <substring>`、`--since <iso>`、`--limit <n>`
- `--current`：只显示当前页面导航的错误

### `pw errors clear --session <name>`

- 清当前错误基线（复现前先清）

### `pw diagnostics export --session <name> --out <file>`

- `--section all|workspace|console|network|errors|routes|bootstrap`
- `--limit <n>`、`--since <iso>`、`--text <substring>`
- `--fields <list>`：支持 `path` 和 `alias=path`

### `pw diagnostics bundle --session <name> --out <dir>`

- 导出失败现场最小证据包（`manifest.json`）
- 默认包含：session digest、filtered diagnostics、latest run events（如果存在）
- 包含 `auditConclusion`（`status/failedAt/failedCommand/failureKind/failureSummary/agentNextSteps`），供 Agent 自主闭环：先做归因，再定位，再修复，再复验
- 包含 `timeline`（filtered）：只保留 `action:*`、`failure:*`、`console:error`、`pageerror`、`requestfailed`，按时间排序，快速看因果链
- 包含 `highSignalTimeline`：高信号时间线，从完整 timeline 中进一步提炼高价值条目，方便 Agent 快速归因
- `--limit <n>`：每类记录的保留上限（默认 `20`）

### `pw diagnostics runs`

- 列出 `.pwcli/runs/` 下的 run 摘要
- `--limit <n>`、`--session <name>`、`--since <iso>`（按 `lastTimestamp` 过滤）
- text 输出是 compact 列表：`runId session=<name> commands=<n> failures=<n> signals=<n> last=<iso>`
- JSON 输出返回字段：`runId` / `sessionName` / `firstTimestamp` / `lastTimestamp` / `commandCount` / `summary`
- `summary.failureCount` 统计失败 action/wait run event；`summary.dialogPendingCount` 统计 action fired + dialog pending
- pwcli 启动的新 session 会把 Playwright 原始附件写入 `.pwcli/playwright/`；已有 session 需要 recreate 才切换

### `pw diagnostics show --run <runId>`

- `--command <name>`、`--since <iso>`、`--fields <list>`、`--limit <n>`
- action/wait 失败事件包含 `status=failed`、`failure`、`diagnosticsDelta`；dialog-triggering action 包含 `status=dialog-pending`、`modalPending=true`、`failureSignal.code=MODAL_STATE_BLOCKED`

### `pw diagnostics grep --run <runId> --text <substring>`

- `--command <name>`、`--since <iso>`、`--fields <list>`、`--limit <n>`

### `pw diagnostics timeline --session <name>`

- 统一时间线：合并 console、network、pageerror、run events（action + failure）为单一时间序列
- `--limit <n>`：最大条目数（默认 `50`）
- `--since <iso>`：只保留该时间戳之后的条目
- 每条 entry 包含：`timestamp`、`kind`、`summary`、`details`
- kind 类型：`console:<level>`、`response`、`request`、`requestfailed`、`pageerror`、`action:<command>`、`failure:<code>`
- failure entry 包含 `runId`、`failureCode`、`screenshotPath`（如有）
- 用途：动作失败后快速看"按时间排序到底发生了什么"，比单独查 console/network/run 更直观

### `pw doctor --session <name>`

- `--auth-provider <name>`、`--profile <path>`、`--state <file>`、`--endpoint <url>`
- `--verbose`：完整 probe 细节
- 诊断 substrate 健康、探测 endpoint reachability、返回恢复建议
- 环境预检（Node 版本、Playwright 浏览器安装、磁盘空间）：
  - 项目运行基线以 `package.json` 为准：Node.js `>=24.12.0 <26`，pnpm 10+
  - Chromium / Firefox / WebKit 至少一个已安装
  - 当前工作目录可用磁盘 > 1GB
  - 预检结果在 `diagnostics[].kind === "environment"` 中返回，`--verbose` 时展开全部细节
  - `doctor` 是健康检查，不负责修复 Volta/proto 等版本管理器造成的环境差异

## Route Mock

边界：

- route/mock 可以继续增强，但只在真实 controlled-testing、diagnostics、extraction 复现需求下增量补能力
- 不把这一层扩成通用场景平台、GraphQL DSL 或第二套 runner

### `pw route list --session <name>`

- 返回当前 session 的 active route metadata

### `pw route add <pattern> --session <name>`

- `--abort`
- `--method <method>`、`--match-body <text>`
- `--match-query-file <path>`：要求请求 URL query 命中 JSON 文件中的 key/value
- `--match-headers-file <path>`：要求请求 header 命中 JSON 文件中的 key/value
- `--match-json-file <path>`：要求请求 JSON body 至少包含给定 subset
- fulfill：`--body <text>` / `--body-file <path>`、`--status <code>`、`--content-type <type>`、`--headers-file <path>`
- patch：`--patch-json <json>` / `--patch-json-file <path>`、`--patch-text-file <path>`、`--patch-status <code>`、`--merge-headers-file <path>`、`--inject-headers-file <path>`
- patch 模式先拿 upstream response 再做 JSON merge patch，只适用于 upstream `application/json`
- patch 模式与 `--abort` / fulfill 选项 / inject 选项互斥

当前顶层 `pw route` 子命令只有 `add|remove|list`。多条 route 用多次 `route add`，或用 `batch` 串行编排；不要把旧文档里的 `pw route load` 当作顶层命令。Batch 内部 route 子集见 `command-reference-advanced.md`。

示例：

```json
[
  ["route", "add", "**/api/users", "--method", "GET", "--status", "200", "--content-type", "application/json", "--body", "{\"ok\":true}"],
  ["route", "add", "**/api/search", "--method", "POST", "--match-body", "query", "--status", "200", "--body", "{\"items\":[]}"]
]
```

### `pw route remove [pattern] --session <name>`

- 省略 `pattern` 时清空全部 managed-session routes

## Trace / HAR

### `pw trace start|stop --session <name>`

- 管理 trace recording
- `trace stop` 输出 `traceArtifactPath`，并给出可直接继续执行的 `pw trace inspect <traceArtifactPath> --section actions` next step

### `pw trace inspect <traceArtifactPath> --section <section>`

- `--section actions|requests|console|errors`
- `--failed`：只对 `--section requests` 传给 Playwright trace CLI
- `--level <level>`：只对 `--section console` 生效；当前 Playwright trace CLI 可稳定映射 `error` / `warning`，其他 level 会在输出里保留 `TRACE_CONSOLE_LEVEL_FILTER_LIMITED`
- `--limit <n>`：把 trace inspect 输出限制为前 N 行，适合大 trace 快速预览
- 输出来自 Playwright bundled trace CLI，pwcli 只做薄封装和 50000 字符上限裁剪，不手工解析 trace artifact
- trace CLI/path/file 不可用时返回显式 `TRACE_*` 错误码

### `pw video start|stop --session <name>`

- 管理页面视频录制
- `video start` 开始录制
- `video stop` 结束录制，输出 `videoPath`

边界：

- Trace CLI：离线查询 trace zip 的 actions / requests / console / errors
- Trace Viewer：面向人的可视化重放，使用 Playwright `show-trace`
- HTML report / UI mode：Playwright Test 展示面，不属于 pwcli diagnostics
- `.pwcli/runs/<runId>/events.jsonl`：pwcli 轻量动作事件，不替代 trace replay 证据包

### `pw har start [path]|stop --session <name>`

- 当前只暴露 HAR substrate 边界，热录制未形成稳定 contract
- 稳定诊断优先用 `network` 和 `diagnostics export`

### `pw har replay <file> --session <name>`

- 从 HAR 文件回放网络流量
- `--update`：允许将新请求更新写入 HAR 文件

### `pw har replay stop --session <name>`

- 停止 HAR 回放路由

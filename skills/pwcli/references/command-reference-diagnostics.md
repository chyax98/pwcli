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

### `pw network --session <name>`

- `--url <substring>`、`--kind request|response|requestfailed|console-resource-error`
- `--method <method>`、`--status <code>`、`--resource-type <type>`
- `--text <text>`、`--since <iso>`、`--limit <n>`
- `--request-id <id>`：单请求详情
- 文本类 request/response 带 `requestBodySnippet` / `responseBodySnippet`（裁剪后的诊断片段）

### `pw errors recent --session <name>`

- `--text <substring>`、`--since <iso>`、`--limit <n>`

### `pw errors clear --session <name>`

- 清当前错误基线（复现前先清）

### `pw diagnostics export --session <name> --out <file>`

- `--section all|workspace|console|network|errors|routes|bootstrap`
- `--limit <n>`、`--since <iso>`、`--text <substring>`
- `--fields <list>`：支持 `path` 和 `alias=path`

### `pw diagnostics runs`

- 列出 `.pwcli/runs/` 下的 run 摘要
- `--limit <n>`、`--session <name>`、`--since <iso>`（按 `lastTimestamp` 过滤）
- 返回字段：`runId` / `sessionName` / `firstTimestamp` / `lastTimestamp` / `commandCount` / `summary`
- pwcli 启动的新 session 会把 Playwright 原始附件写入 `.pwcli/playwright/`；已有 session 需要 recreate 才切换

### `pw diagnostics show --run <runId>`

- `--command <name>`、`--since <iso>`、`--fields <list>`、`--limit <n>`

### `pw diagnostics grep --run <runId> --text <substring>`

- `--command <name>`、`--since <iso>`、`--fields <list>`、`--limit <n>`

### `pw doctor --session <name>`

- `--auth-provider <name>`、`--profile <path>`、`--state <file>`、`--endpoint <url>`
- `--verbose`：完整 probe 细节
- 诊断 substrate 健康、探测 endpoint reachability、返回恢复建议

## Route Mock

### `pw route list --session <name>`

- 返回当前 session 的 active route metadata

### `pw route add <pattern> --session <name>`

- `--abort`
- `--method <method>`、`--match-body <text>`
- fulfill：`--body <text>` / `--body-file <path>`、`--status <code>`、`--content-type <type>`、`--headers-file <path>`
- patch：`--patch-json <json>` / `--patch-json-file <path>`、`--patch-status <code>`、`--inject-headers-file <path>`
- patch 模式先拿 upstream response 再做 JSON merge patch，只适用于 upstream `application/json`
- patch 模式与 `--abort` / fulfill 选项 / inject 选项互斥

### `pw route load <file> --session <name>`

- 从 JSON 文件批量加载 route specs
- spec 字段：`pattern`（必填）/ `matchBody` / `body` / `bodyFile` / `status` / `contentType` / `headers` / `headersFile` / `injectHeaders` / `injectHeadersFile` / `patchJson` / `patchJsonFile` / `patchStatus` / `abort`

### `pw route remove [pattern] --session <name>`

- 省略 `pattern` 时清空全部 managed-session routes

## Trace / HAR

### `pw trace start|stop --session <name>`

- 管理 trace recording

### `pw har start [path]|stop --session <name>`

- 当前只暴露 HAR substrate 边界，热录制未形成稳定 contract
- 稳定诊断优先用 `network` 和 `diagnostics export`

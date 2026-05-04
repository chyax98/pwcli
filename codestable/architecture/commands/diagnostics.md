# pw diagnostics

<!-- 命令设计决策文档。使用教程仍以 skills/pwcli/ 为准。 -->

## 是什么

一句话：诊断命令族读取 live session 和 run artifacts 中的 console、network、page errors、trace 和 HAR 证据。

## 为什么存在

Agent 调试页面失败时需要低噪声、高信号、可交接的证据。诊断命令族把 live session 观察、动作 run events、网络/console/pageerror 和导出 bundle 连接起来，让 Agent 可以先归因，再定位，再修复，再复验。

它不做第二套数据库，也不替代 Playwright trace viewer；它是命令行第一诊断层。

## 子命令

| 命令 | 作用 |
|---|---|
| `pw diagnostics digest` | 汇总 live session 或单个 run |
| `pw diagnostics export` | 导出 diagnostics records |
| `pw diagnostics bundle` | 构建失败现场 bundle |
| `pw diagnostics runs` | 列出 `.pwcli/runs` run 摘要 |
| `pw diagnostics show` | 读取 run events |
| `pw diagnostics grep` | 按文本搜索 run events |
| `pw diagnostics timeline` | 构建 session 时间线 |
| `pw console` | 查询 console records |
| `pw network` | 查询 network records |
| `pw errors` | 查询或清理 page errors |
| `pw trace start` | 启动 tracing |
| `pw trace stop` | 停止 tracing |
| `pw trace inspect` | 离线查看 trace archive |
| `pw har start` | 启动 HAR recording |
| `pw har stop` | 停止 HAR recording |
| `pw har replay` | 从 HAR 文件回放 |
| `pw har replay-stop` | 停止 HAR replay |
| `pw video start` | 启动视频录制 |
| `pw video stop` | 停止视频录制并输出 artifact |

## 参数

公共参数：

| 参数 | 作用 |
|---|---|
| `-s, --session <name>` | 目标 managed session |
| `--output <text|json>` | 输出格式，默认 text |

`diagnostics`：

| 子命令 | 参数 |
|---|---|
| `export` | `--out <file>`、`--section <section>`、`--limit <n>`、`--since <iso>`、`--text <text>`、`--fields <fields>` |
| `bundle` | `--out <dir>`、`--limit <n>`，默认 20 |
| `runs` | `--limit <n>`、`--since <iso>`，`--session` 可作为过滤条件 |
| `digest` | `--run <id>` 或 `--session <name>`、`--limit <n>`，默认 5 |
| `show` | `--run <id>`、`--command <name>`、`--text <text>`、`--limit <n>`、`--since <iso>`、`--fields <fields>` |
| `grep` | 同 `show`，语义是搜索 run events |
| `timeline` | `--limit <n>`，默认 50；`--since <iso>` |

`console`：

| 参数 | 作用 |
|---|---|
| `--level <level>` | 最小 level，默认 info |
| `--source <source>` | source filter |
| `--text <text>` | text filter |
| `--since <iso>` | 起始时间 |
| `--current` | 只看当前页面 navigation |
| `--limit <n>` | 记录数量 |

`network`：

| 参数 | 作用 |
|---|---|
| `--request-id <id>` | 单请求详情 |
| `--method <method>` | HTTP method |
| `--status <code>` | HTTP status |
| `--resource-type <type>` | resource type |
| `--text <text>` | text filter |
| `--url <url>` | URL substring |
| `--kind <request|response|requestfailed|console-resource-error>` | record kind |
| `--since <iso>` | 起始时间 |
| `--current` | 只看当前页面 navigation |
| `--include-body` | 包含 captured bodies |
| `--limit <n>` | 记录数量 |

`errors`：

| 参数 | 作用 |
|---|---|
| positional action 或 `--action <recent|clear>` | 默认 recent |
| `--text <text>` | text filter |
| `--since <iso>` | 起始时间 |
| `--current` | 当前页面 only |
| `--limit <n>` | 记录数量 |

`trace/har`：

| 命令 | 参数 |
|---|---|
| `trace inspect` | positional trace path、`--section <actions|requests|console|errors>`、`--failed`、`--level <level>`、`--limit <n>` |
| `har start` | positional path 或 `--path <path>` |
| `har replay` | positional HAR file |
| `video start` | `--session <name>` |
| `video stop` | `--session <name>` |

## 技术原理

- `diagnostics.ts` 基于 `managedDiagnosticsExport`，再用 filter、session digest、run digest、bundle、run view、timeline helper 做投影；`export --out` 写过滤后的 JSON data，`bundle --out` 写 `manifest.json`。
- `console.ts` 和 `network.ts` 调用 `managedConsole`、`managedNetwork` 读取 captured records。
- `errors.ts` 调用 `managedErrors(recent|clear)` 管理 page errors baseline。
- `trace.ts` 调用 `managedTrace(start|stop)`；`trace inspect` 调用 Playwright bundled trace CLI 的薄封装。
- `har.ts` 调用 `managedHar(start|stop)`、`managedHarReplay`、`managedHarReplayStop`。
- `video.ts` 调用 video recording substrate，输出可交接 artifact 路径。
- action 命令和失败断言产生的 run events 位于 `.pwcli/runs/<runId>/events.jsonl`，diagnostics 命令只读取和投影。`VERIFY_FAILED` 必须作为 `verify` run event 进入 bundle，不能只停留在 CLI envelope。
- `diagnostics bundle` 的 `auditConclusion` 区分 run 级失败和 session 级信号：run event 自身有 `failed/failure/failureSignal` 时，`failedCommand` 指向该 run 并给出 `show/grep --run`；只有 console/network/page error 等 session 信号时，`failedCommand=null`，next steps 改走 `diagnostics timeline/digest/export --session`，避免把后续成功截图/PDF 误当失败命令。
- `diagnostics bundle` 不绕过 browser dialog。session 处于 `MODAL_STATE_BLOCKED` 时，bundle 返回同一 blocked envelope；恢复/交接主路是 action envelope -> `doctor` 确认 -> `dialog accept|dismiss` -> 恢复后 bundle，并由 bundle 读取刚才失败 run 的 `failureSignal`。

## 已知限制

- `DIAGNOSTICS_EXPORT_FAILED`：确认 session 存在，重跑 status，并使用可写 `--out` 文件路径。
- `DIAGNOSTICS_BUNDLE_FAILED`：确认 session attachable、`--out` 输出目录可写、`--limit` 为正整数。
- `MODAL_STATE_BLOCKED`：pending browser dialog 会阻断 bundle；先 `doctor` 确认，再 `dialog accept|dismiss`，恢复后重新 bundle。
- `DIAGNOSTICS_SHOW_FAILED` / `DIAGNOSTICS_GREP_FAILED`：先 `pw diagnostics runs` 获取有效 runId。
- `TRACE_FILE_NOT_FOUND`：传入存在的 trace zip。
- `TRACE_CLI_UNAVAILABLE`：需要 `node_modules/playwright-core/cli.js`。
- `TRACE_CLI_FAILED`：确认 trace zip 有效，或缩窄 `--section`。
- `TRACE_SECTION_REQUIRED` / `TRACE_SECTION_INVALID`：使用 `actions|requests|console|errors`。
- `trace inspect --level` 受 Playwright trace CLI 能力限制，稳定映射只有 error/warning。
- `network --include-body` 有 body size 上限；大 body 会截断。
- `har start|stop` 当前返回 `supported=false`，只暴露 substrate 边界；稳定证据优先 `network` 和 `diagnostics export`。是否进入 1.0 稳定 contract 由 `har-trace-1-0-decision` 决定。
- `video start|stop` 是可视证据补充；默认诊断主路仍是 `diagnostics digest/export/bundle` 与 run events。

## 使用证据

| 命令 | 状态 | 依据 |
|---|---|---|
| `diagnostics digest/export/bundle/runs/show/grep/timeline` | `proven` | diagnostics focused check 覆盖 digest/export/bundle/runs/show/grep/timeline，bundle manifest 和 run evidence |
| `console` | `proven` | network-console focused check 覆盖 level/text/limit/current navigation 过滤 |
| `network` | `proven` | network-console focused check 覆盖 method/url/status/text/kind/request-id/current/include-body |
| `errors` | `proven` | diagnostics + network-console focused check 覆盖 recent text filter、current navigation 和 clear baseline |
| `sse` | `proven` | network-console focused check 覆盖 EventSource records、url 过滤和 limit |
| `trace start|stop|inspect` | `proven` | 2026-05-04 artifact focused check 覆盖 trace start/stop、trace artifact 非空、inspect actions/console error/requests failed；`check:trace-inspect` 固化 CLI 解析 |
| `har start|stop|replay|replay-stop` | `documented` | 2026-05-04 artifact focused check 证明 start/stop 当前返回 `supported=false` limitation；replay 仍是边界能力 |
| `video start|stop` | `proven` | 2026-05-04 artifact focused check 覆盖 video start/stop 和非空 WebM artifact 输出 |

**状态分布：** proven 7 / documented 1 / experimental 0

## 设计决策

- `diagnostics digest` 是第一入口，`export/bundle/show/grep/timeline` 是逐步加深，不让 Agent 一开始读全量原始数据。
- `console/network/errors` 保持 live query 命令，避免所有查询都经由 bundle。
- trace inspect 是 Playwright trace CLI 薄封装；pwcli 不手写 trace zip parser。
- HAR replay 是 mock/diagnostics 的补充，HAR 热录制不作为稳定证据主路。
- diagnostics 不负责修复，只提供证据和 next command。

---

*最后更新：2026-05-04*
*对应实现：`src/cli/commands/diagnostics.ts` + `console.ts` + `network.ts` + `errors.ts` + `trace.ts` + `har.ts` + `video.ts`*

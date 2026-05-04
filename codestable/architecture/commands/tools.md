# pw tools

<!-- 命令设计决策文档。使用教程仍以 skills/pwcli/ 为准。 -->

## 是什么

一句话：工具命令族提供结构化批处理、Playwright escape hatch、mock route、SSE 查询、环境控制、本地健康检查、skill 分发和人类观察面。

## 为什么存在

Agent 主链需要一等命令完成大多数任务，但仍需要少量工具层能力：把稳定小步骤串成 batch、在复杂站点上临时执行 Playwright 代码、做受控网络 mock、控制环境、检查本地 substrate、安装随包 skill。这个命令族是“第二层能力”，按需引入，不进入每个普通浏览器任务的默认路径。

## 子命令

| 命令 | 作用 |
|---|---|
| `pw batch` | 读取 `string[][]` 并在单 session 串行执行稳定子集 |
| `pw code` | 执行直接 Playwright page code |
| `pw route add` | 添加 request route rule |
| `pw route remove` | 移除一个或全部 route |
| `pw route list` | 列出 active routes |
| `pw sse` | 查询 captured Server-Sent Events records |
| `pw environment offline` | 设置 network offline mode |
| `pw environment geolocation set` | 设置 geolocation |
| `pw environment permissions grant|clear` | 授权或清空 permissions |
| `pw environment clock install|set|resume` | 管理 fake clock |
| `pw doctor` | 本地健康检查和恢复建议 |
| `pw profile list-chrome` | 列出 Chrome profiles；在 session-advanced.md 也作为身份来源记录 |
| `pw skill path` | 输出 packaged skill 路径 |
| `pw skill install <dir>` | 安装 packaged skill 到目标 skills dir |
| `pw dashboard open` | 打开 Playwright bundled session dashboard |

## 参数

公共参数：

| 参数 | 作用 |
|---|---|
| `-s, --session <name>` | 目标 managed session |
| `--output <text|json>` | 输出格式，默认 text |

`batch`：

| 参数 | 作用 |
|---|---|
| `--stdin-json` | 从 stdin 读取 JSON argv arrays |
| `--file <path>` | 从 JSON 文件读取 argv arrays |
| `--continue-on-error` | step 失败后继续 |
| `--include-results` | 包含完整 step results |
| `--summary-only` | 省略 step results |

`code`：

| 参数 | 作用 |
|---|---|
| positional source | inline source |
| `--file <path>` | source file |
| `--retry <n>` | retry count，默认 0 |

`route add`：

| 参数 | 作用 |
|---|---|
| positional pattern | route pattern |
| `--abort` | abort requests |
| `--body <text>` / `--body-file <path>` | fulfill body |
| `--status <code>` | fulfill status |
| `--content-type <mime>` | fulfill content type |
| `--headers-file <path>` | fulfill headers JSON file |
| `--merge-headers-file <path>` | merge response headers JSON file |
| `--inject-headers-file <path>` | inject request headers JSON file |
| `--match-body <text>` | request body substring |
| `--match-query-file <path>` | match query JSON file |
| `--match-headers-file <path>` | match headers JSON file |
| `--match-json-file <path>` | match JSON body file |
| `--patch-json <json>` / `--patch-json-file <path>` | upstream JSON merge patch |
| `--patch-text-file <path>` | text replacement JSON file |
| `--patch-status <code>` | patch response status |
| `--method <method>` | HTTP method filter |

`sse`：

| 参数 | 作用 |
|---|---|
| `--since <iso>` | 起始时间 |
| `--limit <n>` | 记录数，默认 50 |
| `--url <url>` | URL substring |

`environment`：

| 命令 | 参数 |
|---|---|
| `offline` | positional `on|off` |
| `geolocation set` | `--lat <lat>`、`--lng <lng>`、`--accuracy <m>` |
| `permissions grant` | positionals permissions |
| `permissions clear` | 无额外参数 |
| `clock install` | 无额外参数 |
| `clock set` | positional ISO date |
| `clock resume` | 无额外参数 |

`doctor/profile/skill`：

| 命令 | 参数 |
|---|---|
| `doctor` | `--auth-provider <name>`、`--profile <path>`、`--state <path>`、`--endpoint <url>`、`--verbose` |
| `profile list-chrome` | `--user-data-dir <path>`、`--output <text|json>` |
| `skill path` | `--output <text|json>` |
| `skill install` | positional target dir、`--output <text|json>` |
| `dashboard open` | `--dry-run`、`--output <text|json>` |

## 技术原理

- `batch.ts` 读取 stdin/file JSON，校验为 `string[][]`，再交给 `#cli/batch/executor.js` 串行执行。
- `code.ts` 调用 `managedRunCode`，source 来自 positional 或 `--file`。
- `route.ts` 调用 `managedRoute(add|remove|list)`，`route add` 在 CLI 层读取 body/json/text 文件并传入 engine。
- `sse.ts` 复用 `managedDiagnosticsExport` 中的 `data.sse`，按 since/url/limit 过滤。
- `environment.ts` 调用 environment engine 的 offline/geolocation/permissions/clock functions。
- `doctor.ts` 组合环境、浏览器安装、磁盘、profile/state/endpoint/auth-provider/session probes。
- `skill.ts` 调用 store/skill 的 packaged skill path/install helper。
- `dashboard.ts` 是 Playwright bundled dashboard 的薄封装；不可用或启动失败时返回明确错误码。

## 已知限制

- `BATCH_INPUT_REQUIRED`：`batch` 必须传 `--stdin-json` 或 `--file`。
- `BATCH_INPUT_INVALID`：输入必须是 JSON array of argv string arrays。
- `batch` 只承诺单 session 稳定子集，不承载 lifecycle/auth/environment/dialog recovery/diagnostics query。
- `RUN_CODE_TIMEOUT`：`code` 或 run-code-backed 长流程超过 guard timeout；拆成一等命令和显式 `wait`。
- `ROUTE_ADD_FAILED`：pattern、文件内容或 option mix 无效；先 `route list`，再用最小 mock 重试。
- 当前 `src/cli/commands/route.ts` 与 `node dist/cli.js route --help` 只注册 `add|remove|list`；旧文档曾出现的顶层 `pw route load` 不属于当前 help/source 命令面。Batch executor 仍有内部 `["route","load",file]` 子集，归 batch contract 记录。
- `ENVIRONMENT_LIMITATION`：environment mutation 在 run-code lane 没完成；换 fresh session 或降级为 unsupported。
- `ENVIRONMENT_CLOCK_SET_FAILED` / `ENVIRONMENT_CLOCK_RESUME_FAILED` 且 message 含 `CLOCK_REQUIRES_INSTALL`：`clock set/resume` 前必须先 `clock install`。
- `doctor` 是健康检查，不修复环境；`--verbose` 只展开 probes。
- `skill install` 只安装 packaged pwcli skill，不是外部 plugin lifecycle。
- `dashboard open` 是人类观察/接管面，不是 Agent 主执行链；失败时用 `session list --with-page` 作为 CLI-only fallback。

## 使用证据

| 命令 | 状态 | 依据 |
|---|---|---|
| `batch` | `proven` | 2026-05-04 tool focused check 覆盖 `string[][]` stdin、成功 summary、analysis warnings、input error；`check:batch-verify` 覆盖 verify failure 传播；`batch-allowlist.test.ts` 覆盖 allowlist/blocklist |
| `code` | `proven` | 2026-05-04 route/mock/bootstrap focused check 覆盖 inline、`--file` 和 `--retry` |
| `route add/remove/list` | `proven` | 2026-05-04 route/mock/bootstrap focused check 覆盖 fulfill、method、match-query/header/body/json、inject、patch-json、patch-text、abort、list、remove；同轮修复 matchQuery 命中后 session closed |
| `sse` | `proven` | `scripts/test/sse-observation.test.ts` 覆盖 EventSource connect/open/message 捕获；network-console focused check 覆盖 `pw sse --url` 查询 |
| `environment offline/geolocation/permissions/clock` | `proven` | 2026-05-04 environment focused check 覆盖 offline on/off、geolocation set + permission、permissions clear、clock install/set/resume；`check:env-geolocation` 覆盖 `--lat/--lng` 和旧 positional 形态拒绝 |
| `doctor` | `proven` | dogfood modal blockage recovery 使用 `doctor --session --endpoint`；`check:doctor-modal` 固化 modal-state recovery |
| `profile list-chrome` | `proven` | local dogfood 返回 system Chrome profiles |
| `skill path/install` | `proven` | 2026-05-04 tool focused check 覆盖 `skill path --output json`；`check:skill-install` 固化 packaged skill 安装 |
| `dashboard open` | `proven` | 2026-05-04 tool focused check 覆盖 `dashboard open --dry-run` bundled entrypoint 检查；当前 shipped flags 不包含 `--timeout` |

**状态分布：** proven 9 / documented 0 / experimental 0

## 设计决策

- `batch` 是单 session 串行编排，不追求完整 CLI flag parity。
- `code` 是 escape hatch，不是长流程 runner；复杂等待拆回一等命令。
- `route` 是 controlled testing / diagnostics mock 层，不扩成通用场景平台或 GraphQL DSL。
- `environment` 只在确定性测试或复现场景中引入，不是常规探索默认步骤。
- `doctor` 输出恢复建议，但不替 Agent 自动执行修复。
- `skill` 只负责 packaged skill 分发，不实现外部 skill/plugin 市场。
- `dashboard` 是人类观察补充，不替代 CLI facts/action/evidence 主链。

---

*最后更新：2026-05-04*
*对应实现：`src/cli/commands/batch.ts` + `code.ts` + `route.ts` + `sse.ts` + `environment.ts` + `doctor.ts` + `profile.ts` + `skill.ts` + `dashboard.ts`*

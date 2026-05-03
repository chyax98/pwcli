# pw session

<!-- 命令设计决策文档。使用教程仍以 skills/pwcli/ 为准。 -->

## 是什么

一句话：`pw session` 管理 named browser session，是所有浏览器任务的生命周期入口。

## 为什么存在

Agent 需要一个可恢复、可命名、可串行化的浏览器执行上下文。`session create|attach|recreate` 把 browser shape、profile、trace、state 和启动恢复收口到一个命令族，避免 `open`、`auth` 或 action 命令隐式创建浏览器。

这个设计让后续 `status/read-text/action/wait/diagnostics` 都只需要显式目标 session。它也让同名 lifecycle 竞争可以返回结构化 `SESSION_BUSY`，而不是泄漏 Playwright substrate 的 raw startup error。

## 子命令

| 子命令 | 作用 |
|---|---|
| `pw session create <name>` | 创建 named managed session，默认打开 `about:blank`，可再 `--open <url>` |
| `pw session attach <name>` | 把 managed session 接到已有 browser endpoint 或 attachable server |
| `pw session recreate <name>` | 关闭并重建同名 session，尽量保存/恢复 state 和 bootstrap |
| `pw session list` | 列出 managed sessions，可补页面摘要或 attachable server |
| `pw session status <name>` | 读取 session socket、alive、workspace 等快速状态 |
| `pw session close <name>` | 关闭一个 session |
| `pw session close --all` | 关闭全部 managed sessions |

## 参数

公共参数：

| 参数 | 来源 | 作用 |
|---|---|---|
| `--output <text|json>` | `src/cli/commands/session.ts` args | 输出 text 或 JSON envelope |

`session create`：

| 参数 | 作用 |
|---|---|
| `--open <url>` | 创建后导航到 URL |
| `--profile <path>` | 使用 persistent profile path |
| `--from-system-chrome` | 使用本机 Chrome profile |
| `--chrome-profile <name>` | 指定 Chrome profile directory 或 display name |
| `--persistent` | 使用 persistent profile |
| `--state <path>` | 创建后 load storage state |
| `--headed` | headed browser |
| `--trace` | 启用 trace recording，默认 true |
| `--init-script <path>` | 创建时注入 init script |

`session attach`：

| 参数 | 作用 |
|---|---|
| `--ws-endpoint <url>` | Playwright websocket endpoint |
| `--browser-url <url>` | CDP browser URL |
| `--cdp <port>` | CDP port |
| `--attachable-id <id>` | `session list --attachable` 返回的 server id/title |
| `--trace` | attach 后启用 trace recording，默认 true |

`session recreate`：

| 参数 | 作用 |
|---|---|
| `--headed` | 重建为 headed browser；未传时沿用当前 headed 状态 |
| `--open <url>` | 重建后打开指定 URL |
| `--trace` | 重建后启用 trace recording，默认 true |

`session list`：

| 参数 | 作用 |
|---|---|
| `--with-page` | 为 live session 补 best-effort 页面摘要 |
| `--attachable` | 列出当前 workspace 可 attach 的 Playwright browser servers |

`session close`：

| 参数 | 作用 |
|---|---|
| `--all` | 关闭全部 session；`pw session close all` 等价 |

## 技术原理

- CLI 入口是 `src/cli/commands/session.ts`，子命令通过 `defineCommand({ subCommands })` 注册。
- `create` 调用 `managedOpen(..., reset: true)` 创建 substrate，再按需调用 `managedStateLoad`、`managedTrace("start")`、`managedBootstrapApply`。
- `attach` 通过 `resolveAttachTarget` 或 `listAttachableBrowserServers` 解析 endpoint，再调用 `attachManagedSession`。
- `recreate` 读取 registry entry，尝试 `managedStateSave` 到临时文件，`stopManagedSession` 后用同名 `managedOpen` 重建，再 load state 和重新 apply bootstrap。
- `list/status/close` 走 `listManagedSessions`、`getManagedSessionStatus`、`stopManagedSession`、`stopAllManagedSessions`。
- session name 校验和 `SESSION_REQUIRED` 等 routing error 由 helper 与 engine/session 统一输出。

## 已知限制

- `SESSION_REQUIRED`：需要显式 session；恢复路径是先 `pw session create <name> --open <url>`。
- `SESSION_NAME_INVALID` / session 名最长 16 字符：只用 `[a-zA-Z0-9_-]`。
- `SESSION_NOT_FOUND`：先 `pw session list`，再 create 或换名。
- `SESSION_BUSY`：同 session lifecycle 或 command 正在运行；等待、查 status 后重试，不并发发同名 lifecycle。
- `SESSION_RECREATE_STARTUP_TIMEOUT`：recreate 旧 session 已停但新 browser 启动超时；不要循环 recreate，同 profile 锁定时换 session/profile。
- `SESSION_ATTACH_FAILED`：endpoint 或 `--attachable-id` 不可连接；先 `session list --attachable`。
- `CHROME_PROFILE_NOT_FOUND`：先 `profile list-chrome`，再用有效 `--chrome-profile`。
- `open` 不是 lifecycle；换 headed/profile/persistent/state 必须回到 `session create|recreate`。

## 使用证据

| 命令 | 状态 | 依据 |
|---|---|---|
| `session create` | `proven` | dogfood 覆盖 lifecycle create；benchmark runner 也以 session create 启动任务 |
| `session attach` | `proven` | dogfood stable conclusions 记录 `create|attach|recreate|close` 收口 |
| `session recreate` | `proven` | dogfood stable conclusions 记录 recreate 限制和恢复策略 |
| `session close` | `proven` | dogfood targeted cleanup 和脚本收尾覆盖 close |
| `session list` | `proven` | controldog 覆盖 `session list --with-page` |
| `session status` | `proven` | controldog 覆盖 active/socket/workspace status |

**状态分布：** proven 6 / documented 0 / experimental 0

## 设计决策

- session-first 是主路：所有浏览器任务先得到 named session，再执行观察、动作、等待和诊断。
- `open` 只导航已有 session，不创建 session，避免隐式改变 browser shape。
- `auth` 只运行 provider，不负责创建或重建 session。
- 同 session lifecycle 和 managed command 需要串行化，失败时返回可恢复的 `SESSION_BUSY`。
- `recreate` 做一次 state/bootstrap best-effort 恢复，但启动超时后要求换名或换 profile，不鼓励循环重试。

---

*最后更新：2026-05-03*
*对应实现：`src/cli/commands/session.ts` + `src/engine/session.ts` + `src/engine/identity.ts`*

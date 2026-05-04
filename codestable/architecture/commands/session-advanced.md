# pw session advanced

<!-- 命令设计决策文档。使用教程仍以 skills/pwcli/ 为准。 -->

## 是什么

一句话：高级 session 命令族管理身份、storage、cookies、profile 和 BrowserContext bootstrap。

## 为什么存在

Agent 的浏览器任务经常需要复用登录态、判断认证状态、保存/加载 storage、调整当前 origin 的测试状态，或在 session 创建后注入 init script/headers。把这些能力从 lifecycle 和 action 中拆出来，可以保持 `session create|attach|recreate` 的边界清晰，也避免 `auth` 隐式决定 browser shape。

## 子命令

| 命令 | 作用 |
|---|---|
| `pw auth list` | 列出内置 auth providers |
| `pw auth info <name>` | 查看 provider 参数和说明 |
| `pw auth probe` | 只读判断当前 session 身份状态 |
| `pw auth dc` | 运行内置 `dc` provider |
| `pw auth fixture-auth` | 运行内部 fixture auth provider |
| `pw state save [file]` | 保存 storage state |
| `pw state load <file>` | 加载 storage state |
| `pw state diff` | 比较 state diff 摘要 |
| `pw storage local` | 读取或修改 current-origin localStorage |
| `pw storage session` | 读取或修改 current-origin sessionStorage |
| `pw storage indexeddb export` | 只读导出 current-origin IndexedDB 摘要 |
| `pw cookies list` | 列出 cookies |
| `pw cookies set` | 设置 cookie |
| `pw bootstrap apply` | 对已有 session apply init script 和 headers |
| `pw profile list-chrome` | 列出本机 Chrome profiles |

## 参数

公共参数：

| 参数 | 作用 |
|---|---|
| `-s, --session <name>` | 目标 managed session |
| `--output <text|json>` | 输出格式，默认 text |

`auth`：

| 命令 | 参数 |
|---|---|
| `auth probe` | `--url <url>`，先只读导航到 protected URL 后 probe |
| `auth <provider>` | `--save-state <path>`、`--arg <key=value>` |
| `auth list/info` | provider name 来自 positional |

`state`：

| 参数 | 作用 |
|---|---|
| positional action 或 `--action <save|load|diff>` | 指定动作 |
| positional file | `save/load` 的文件路径 |
| `--before <path>` | diff before file |
| `--after <path>` | diff after file |
| `--include-values` | diff 输出包含 value 级变化 |

`storage`：

| 参数 | 作用 |
|---|---|
| positional kind | `local`、`session` 或 `indexeddb` |
| positional action | `get|set|delete|clear`；indexeddb 仅 `export` |
| positional key/value | storage mutation 的 key/value |
| `--database <name>` | IndexedDB database filter |
| `--store <name>` | IndexedDB object store filter |
| `--limit <n>` | IndexedDB records limit，默认 20 |
| `--include-records` | 返回 IndexedDB sample records |

`cookies`：

| 命令 | 参数 |
|---|---|
| `cookies list` | `--domain <domain>` |
| `cookies set` | `--name <name>`、`--value <value>`、`--domain <domain>`、`--path <path>`，path 默认 `/` |

`bootstrap/profile`：

| 命令 | 参数 |
|---|---|
| `bootstrap apply` | `--action <apply>`、`--init-script <path>`、`--headers-file <path>`、`--remove-init-script <path>` |
| `profile list-chrome` | `--user-data-dir <path>`、`--output <text|json>` |

## 技术原理

- `auth.ts` 从 `#auth/registry.js` 读取 built-in providers；provider 通过 `managedRunCode` 在现有 page 上执行。
- `auth probe` 调用 `managedAuthProbe`，只读推断 `authenticated|anonymous|uncertain`。
- `state.ts` 调用 `managedStateSave`、`managedStateLoad`、`managedStateDiff`。
- `storage.ts` 调用 `managedStorageRead`、`managedStorageMutation`、`managedStorageIndexedDbExport`。
- `cookies.ts` 调用 `managedCookiesList`、`managedCookiesSet`。
- `bootstrap.ts` 调用 `managedBootstrapApply`，并通过 store/config 移除持久化 init script。
- `profile.ts` 调用 `listChromeProfiles`，用于 `session create --from-system-chrome` 的 profile discovery。

## 已知限制

- `auth` 不创建 session，不决定 headed/profile/persistent；session shape 先由 `session create|recreate` 决定。
- `auth probe` 是 generic heuristic，不调用站点级 `/me` API，不等同强认证结论。
- `auth probe status=uncertain`：遇到 challenge/two_factor/interstitial 时 human handoff，不自动循环登录。
- `STORAGE_ORIGIN_UNAVAILABLE`：storage 或 auth probe 在 `about:blank`、`data:` 等 null origin 上不可用；先 `open` 到 http/https origin。
- `INDEXEDDB_ORIGIN_UNAVAILABLE` / `INDEXEDDB_UNSUPPORTED`：IndexedDB export 只读、只看 current origin，不做 mutation/import/clear。
- `STATE_DIFF_BEFORE_REQUIRED` / `STATE_DIFF_AFTER_REQUIRED` / `STATE_DIFF_SNAPSHOT_INVALID`：`state diff` 必须使用由 `state diff` 生成的 before/after snapshot。
- `CHROME_PROFILE_NOT_FOUND`：先 `profile list-chrome`，再选择有效 Chrome profile。
- `BOOTSTRAP_REAPPLY_FILE_NOT_FOUND`：recreate 自动重放 bootstrap 时 init script 路径不存在；用 `bootstrap apply --remove-init-script` 或更新路径。
- `cookies set` 需要 `--domain`；storage mutation 只作用于当前页 origin。

## 使用证据

| 命令 | 状态 | 依据 |
|---|---|---|
| `auth probe` | `proven` | benchmark generated auth-state tasks 覆盖；statedog 验证 storage signal 与 login-page heuristic |
| `auth list/info/fixture-auth` | `proven` | statedog 覆盖 provider discovery、provider info 和 fixture-auth save-state |
| `auth dc` | `proven` | 2026-05-04 使用 live Forge `targetUrl` 真实验证通过：provider 返回 `ok=true`、`resolvedBy=targetUrl`，页面落到 TapTap 开发者服务并可读“选择厂商”厂商列表；`auth probe` 为 generic heuristic，返回 `uncertain/medium`，但页面非登录/挑战态且存在会话 cookie，按 Forge/DC SOP 判定 provider proof 通过；原 blocker issue 已 resolved |
| `state save` | `proven` | dogfood 保存登录态覆盖 |
| `state load` | `proven` | dogfood 新 session 复用 state 覆盖 |
| `state diff` | `proven` | 2026-05-04 auth/state focused check 覆盖 baseline、before/after、`--include-values`、IndexedDB metadata；同轮修复 value-only local/session storage changedBuckets 漏报 |
| `storage local` | `proven` | dogfood localStorage read 覆盖 |
| `storage session` | `proven` | dogfood sessionStorage read 覆盖 |
| `storage indexeddb export` | `proven` | statedog 覆盖 database/store filter 和 sample records |
| `cookies list` | `proven` | dogfood cookies list 覆盖 |
| `cookies set` | `proven` | dogfood cookies set 覆盖 |
| `bootstrap apply` | `proven` | 2026-05-04 route/mock/bootstrap focused check 覆盖 init script、headers、remove-init-script 和 session recreate reapply |
| `profile list-chrome` | `proven` | local dogfood 返回 system Chrome profiles |

**状态分布：** proven 12 / blocked 1 / documented 0 / experimental 0

## 设计决策

- 身份能力和 session lifecycle 分离：`auth` 只执行 provider，profile/state 决策留给 `session create`。
- `state save/load` 是跨 session 登录态复用主路；`storage/cookies` 是 current-origin 临时状态操作。
- `state diff --include-values` 的 `summary.changedBuckets` 必须和明细保持一致；只要 `localStorage.changed` 或 `sessionStorage.changed` 非空，就必须包含对应 bucket。
- `auth probe` 保持 generic，不扩成站点智能层。
- IndexedDB 只做只读摘要，避免把 storage 命令扩成数据库迁移工具。
- bootstrap 配置按 sessionName 持久化，recreate 后自动重放，但文件路径有效性由用户维护。

---

*最后更新：2026-05-04*
*对应实现：`src/cli/commands/auth.ts` + `state.ts` + `storage.ts` + `cookies.ts` + `bootstrap.ts` + `profile.ts`*

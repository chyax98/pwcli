# Command Reference — 状态、Auth 与自动化

适用：登录态复用、auth provider、batch 编排、环境控制、`pw code` 脚本。
进入时机：需要跨 session 保存状态、构建确定性自动化、控制浏览器环境。

核心交互命令见 `command-reference.md`；
诊断 / mock 命令见 `command-reference-diagnostics.md`。

## 状态复用

### `pw state save [file] --session <name>`

- 导出 storage state（cookies + localStorage）

### `pw state load <file> --session <name>`

- 导入 storage state

### `pw state diff --session <name> --before <file>`

- 读取当前 managed session 的只读 state 摘要，并与 `before` 基线文件比较
- 首次运行时，如果 `before` 文件不存在：
  - 当前摘要会被保存成 baseline
  - 返回 `baselineCreated: true`
- 后续再运行同一条命令：
  - 比较 baseline 和当前状态
  - 返回 compact diff buckets
- 可选：
  - `--after <file>`：把当前 after 摘要额外保存到文件，便于离线复查或二次比较
  - `--include-values`：在 diff 输出中包含 cookie、localStorage、sessionStorage 的 value 级变化；默认只比较 key/摘要

### `pw state diff --before <file> --after <file>`

- 比较两份已保存的 state diff 摘要文件
- 不需要 session
- 适合离线比较 before/after artifact

返回：

- `summary.changed`
- `summary.changedBuckets`：包含发生变化的 bucket；`--include-values` 下 value-only 的 `localStorage.changed` / `sessionStorage.changed` 也会计入
- `cookies.added/removed/changed`
- `localStorage.added/removed/changed`
- `sessionStorage.added/removed/changed`
- `indexeddb.databasesAdded/databasesRemoved/storesChanged`

`--include-values` 时，value 级 diff 输出格式为 `before` / `after` 字符串对；只改 value、不改 key 时，对应 bucket 仍会出现在 `summary.changedBuckets`。

限制：

- 只读比较，不修改浏览器状态
- 当前 MVP 的 storage 范围是：
  - cookie 摘要（`--include-values` 时包含 value）
  - `localStorage` key 集合（`--include-values` 时包含 value）
  - `sessionStorage` key 集合（`--include-values` 时包含 value）
  - IndexedDB database/store metadata + `countEstimate`
- 不做 Cache Storage / service worker diff
- `--include-values` 可能产生较大输出；长 value 会被截断

### `pw cookies list --session <name>`

- `--domain <domain>`

### `pw cookies set --session <name>`

- 必填：`--name`、`--value`、`--domain`
- 可选：`--path`（默认 `/`）

### `pw storage local|session --session <name>`

- 读取当前页 origin 的 `localStorage` / `sessionStorage`
- 无效 origin 返回 `accessible: false`

### `pw storage local|session get|set|delete|clear --session <name>`

- `get <key>`：读取当前页 origin 的单个 storage 值
- `set <key> <value>`：写入当前页 origin 的单个 storage 值
- `delete <key>`：删除当前页 origin 的单个 storage 值
- `clear`：清空当前页 origin 的对应 storage

这只是受控测试状态操作，不替代 `state save|load`、cookies 或 auth provider。不会跨 origin 修改 storage。

### `pw storage indexeddb export --session <name>`

- 只读导出当前页 origin 下可见的 IndexedDB 摘要
- 可选：
  - `--database <name>`：只看一个 database
  - `--store <name>`：只看一个 object store
  - `--limit <n>`：采样记录上限，默认 `20`
  - `--include-records`：返回采样记录 preview
- 返回：
  - `origin`
  - `databaseCount`
  - `databases[].name`
  - `databases[].version`
  - `stores[].name`
  - `stores[].keyPath`
  - `stores[].autoIncrement`
  - `stores[].indexNames`
  - `stores[].countEstimate`
  - `stores[].sampledRecords[]`（仅 `--include-records`）

限制：

- 只读
- 只看当前页 origin
- 不支持 mutation / import / clear
- 不替代 Cache Storage / service worker 探测

### `pw profile inspect <path>`

- 检查 profile 路径是否存在、可写、可用
- 返回：
  - `profile`
  - `capability`
    - `capability: "persistent-profile-path"`
    - `supported`
    - `available`
    - `exists`
    - `writable`
    - `willCreateOnOpen`

### `pw profile list-chrome`

- 列出本机 Chrome profiles，输出 `directory`、`name`、`userDataDir`、`profilePath`
- 配合 `pw session create --from-system-chrome --chrome-profile <directory-or-name>` 使用
- 这是 session 启动身份来源，不是 `auth provider`
- 额外返回：
  - `capability`
    - `capability: "system-chrome-profile-source"`
    - `supported`
    - `available`
    - `profileCount`
    - `defaultProfileAvailable`

## Auth

### `pw auth probe --session <name>`

- 只读判断当前 managed session 的身份状态
- 返回：
  - `status`: `authenticated | anonymous | uncertain`
  - `confidence`: `high | medium | low`
  - `blockedState`: `none | challenge | two_factor | interstitial | unknown`
  - `recommendedAction`: `continue | save_state | inspect | reauth | human_handoff`
  - `capability`
    - `capability: "auth-state-probe"`
    - `supported`
    - `available`
    - `blocked`
    - `reusableStateLikely`
  - `signals.pageIdentity[]`
  - `signals.protectedResource[]`
  - `signals.storage[]`
- 三层信号分别回答：
  - 页面本身像不像登录后页面
  - 当前页面是不是还卡在登录/验证入口
  - cookie / localStorage / sessionStorage 里是否有 auth/session-like 痕迹
- 可选：
  - `--url <protected-url>`：先做一次只读导航，再基于落地页做 probe

限制：

- 只读 probe，不执行登录
- 不创建 session
- 当前 MVP 不调用站点特化 `/me` API，也不做站点 pack
- `--url` 会改变当前页，但不做写操作
- 结果是通用启发式判断，不等同于站点级强认证结论
- 命令边界冻结在 generic probe：不把它扩成 site-aware auth intelligence

### `pw auth list`

- 列出内置 auth provider；以 provider summary 判断用途，业务登录优先使用用户目标对应的 provider

### `pw auth info <name>`

- 返回 provider 的参数、默认值、示例、说明

### `pw auth <provider> --session <name>`

- `--save-state <file>`、`--arg <key=value>`（可重复）
- 在现有 session 中运行内置 provider；session shape 先通过 `session create` 建好
- 外部脚本走 `pw code --file <path>`，不走 `auth`

### `pw auth dc --session <name>`

- Provider 参数以 `pw auth info dc` 为准，不在文档里硬编码账号或验证码
- 常用参数：`--arg phone=<number>`、`--arg smsCode=<code>`、`--arg targetUrl=<url>`、`--arg baseURL=<origin>`
- 传 `targetUrl` 则使用指定业务 URL；未传时优先用当前 Forge 页面，最后回退 provider 默认目标；不支持 `instance`
- auth 输出给 Agent 的主字段是 `provider`、`resolvedTargetUrl`、`resolvedBy`、`pageState`，不输出原始 provider args

## Bootstrap

### `pw session create <name> --init-script <file> --open <url>`

- 在 session 创建时直接注入 init script，单步完成；`--init-script` 可重复传多个

### `pw bootstrap apply --session <name>`

- `--init-script <file>`（可重复）、`--headers-file <file>`
- `--remove-init-script <file>`：从持久化配置中删除单条 init script，不重新 apply
- 对已存在 session 做 live bootstrap；当前只支持 `apply`
- init script 配置自动持久化到 workspace，`session recreate` 后自动重新 apply
- 输出包含 `bootstrapApplied`（session create）或 `bootstrapReapplied`（session recreate）字段
- `pw doctor --session <name>` 报告 bootstrap 配置状态（`initScriptCount`、`appliedAt`）
- 2026-05-04 route/mock/bootstrap focused check 已验证 init script、headers、remove-init-script 和 `session recreate` 重放；移除后的 init script 不再重放，headers 仍可重放

## pw code

### `pw code [source] --session <name>`

- `--file <path>`：执行本地脚本
- `--retry <count>`
- 失败保留 Playwright 原始错误，常见 locator 问题后追加 `PWCLI_HINT`
- modal 阻塞时可能返回 `MODAL_STATE_BLOCKED`，先恢复 dialog
- 2026-05-04 route/mock/bootstrap focused check 已覆盖 inline、`--file`、`--retry`；长流程仍拆成一等命令 + 显式 wait，不把 `pw code` 当 workflow runner

## Batch

### `pw batch --session <name>`

输入：`--stdin-json` / `--file <path>`，格式均为 `string[][]`。

选项：`--continue-on-error`、`--include-results`、`--summary-only`

稳定 argv 子集：

- `snapshot`、`snapshot -i`、`snapshot -c`
- `click <ref>`、`click --selector <selector>`、`click --text <text>`、`click --role <role> --name <name>`
- `fill <ref> <value>`、`fill --selector <selector> <value>`
- `press <key>`、`scroll <direction> [distance]`、`type [ref] <value>`
- `hover <ref>`、`check <ref>`、`uncheck <ref>`、`select <ref> <value>`
- `open <url>`
- `read-text` / `text`、`read-text --max-chars <n>`、`read-text --selector <selector>`、`read-text --no-include-overlay`
- `locate --text <text>`、`locate --selector <selector>`、`locate --role <role> --name <name>`
- `get text|value|count --text <text>`、`get text|value|count --selector <selector>`
- `is visible|enabled|checked --text <text>`、`is visible|enabled|checked --selector <selector>`
- `verify text|text-absent|visible|hidden|enabled|disabled|checked|unchecked --text <text>`
- `verify url --contains <text>`、`verify url --equals <url>`、`verify url --matches <regex>`
- `verify count --equals <n>`、`verify count --min <n>`、`verify count --max <n>`
- `wait network-idle`（或 `--networkidle`）、`wait --text`、`wait --selector`、`wait --selector <selector> --state <state>`、`wait --request`、`wait --response`
- `screenshot ...`、`status` / `observe`、`errors recent|clear`
- `route list|add|load|remove ...`、`bootstrap apply ...`
- `state save|load`、`page current|list|frames|dialogs`

Batch route 子集只覆盖常用 `list|load|remove|add` 与基础 fulfill/abort/patch 参数。完整 `route add` 匹配能力（如复杂 query/header/json/body matcher 或 header merge 组合）请单独运行 `pw route ...`，不要放进 batch。

Supported batch click targets:

- `["click", "e12"]`
- `["click", "--selector", "#submit"]`
- `["click", "--text", "Submit"]`
- `["click", "--text", "Submit", "--nth", "2"]`
- `["click", "--role", "button", "--name", "Submit"]`
- `["click", "--role", "button", "--name", "Submit", "--nth", "2"]`

Other semantic click flags stay outside batch. Run the single `pw click ...` command when you need them.

注意：

- `batch --stdin-json` 表示 stdin steps 是 JSON，不表示输出 JSON；要 JSON 输出加 `pw batch --output json ...`
- `session` / `auth` / `environment` / `dialog` / diagnostics query 不属于稳定子集
- `data.analysis.warnings` 是串行依赖提示
- 默认 text 输出是轻量摘要，包含 step 数、成功/失败数、首个失败和 warnings，不倾倒嵌套 JSON
- 脚本解析和字段断言必须加 `--output json`；JSON envelope 保持 `data.summary` 和 compact `data.results`
- 默认 JSON `results` 只保留 step metadata、command、page summary 和可用 summary，避免 `status` 等命令重复嵌套完整 payload
- 需要完整 step 输出时加 `--include-results`
- 只需要 JSON 汇总时加 `--summary-only`；失败信息看 `firstFailure*` 和 `failedSteps`
- text 输出需要紧凑 step 明细时也加 `--include-results`

## Dashboard

### `pw dashboard open`

Opens Playwright-core's bundled session dashboard. This is a thin wrapper around Playwright's internal `playwright cli show` surface.

Use for human observation or takeover. Do not use as a required Agent workflow step.

If the bundled entrypoint is missing, the command fails with `DASHBOARD_UNAVAILABLE`.
If the dashboard subprocess exits during the startup observation window, the command fails with `DASHBOARD_LAUNCH_FAILED` instead of reporting `launched: true`.

## Environment

### `pw environment offline on|off --session <name>`

- `offline on` 后当前 context 网络请求失败；`offline off` 恢复。
- 2026-05-04 environment focused check 已验证 fetch 失败为 `net::ERR_INTERNET_DISCONNECTED`，恢复后同一请求返回 200。

### `pw environment geolocation set --session <name> --lat <lat> --lng <lng>`

- 可选：`--accuracy <meters>`
- 页面要读取 `navigator.geolocation` 时，先 `pw environment permissions grant geolocation --session <name>`。
- 2026-05-04 environment focused check 已验证页面侧 `navigator.geolocation.getCurrentPosition()` 返回设定坐标。

### `pw environment permissions grant <perm...>|clear --session <name>`

- grant 示例：`geolocation clipboard-read`
- `clear` 清空当前 context permissions state。

### `pw environment clock install|set|resume --session <name>`

- `install`：安装 fake timers（`set` / `resume` 前必须先 `install`）
- `set <iso>`：将 fake time 设到目标时间
- `resume`：恢复时钟流逝
- 未先 `install` 直接 `set/resume` 时，当前顶层 envelope code 是 `ENVIRONMENT_CLOCK_SET_FAILED` / `ENVIRONMENT_CLOCK_RESUME_FAILED`，message 内包含 `CLOCK_REQUIRES_INSTALL`。
- 2026-05-04 environment focused check 已验证 `install -> set` 后页面侧 `new Date().toISOString()` 返回固定时间。

## Skill

### `pw skill path`

- 返回随包分发的 skill 路径

### `pw skill install <dir>`

- 安装到 `<dir>/pwcli`

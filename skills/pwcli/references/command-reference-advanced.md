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

这只是受控测试状态操作，不替代 `state save|load`、cookies 或 auth provider。不会跨 origin 修改 storage，也不支持 IndexedDB。

### `pw profile inspect <path>`

- 检查 profile 路径是否存在、可写、可用

## Auth

### `pw auth list`

- 列出内置 auth provider；含内部测试 provider，看 summary 区分用途

### `pw auth info <name>`

- 返回 provider 的参数、默认值、示例、说明

### `pw auth <provider> --session <name>`

- `--save-state <file>`、`--arg <key=value>`（可重复）
- 在现有 session 中运行内置 provider；session shape 先通过 `session create` 建好
- 外部脚本走 `pw code --file <path>`，不走 `auth`

### `pw auth dc --session <name>`

- 默认 `phone=19545672859`、`smsCode=000000`
- `--arg phone=<number>`、`--arg smsCode=<code>`、`--arg targetUrl=<url>`、`--arg baseURL=<origin>`
- 传 `targetUrl` 则使用指定业务 URL；不支持 `instance`

## Bootstrap

### `pw bootstrap apply --session <name>`

- `--init-script <file>`（可重复）、`--headers-file <file>`
- 对已存在 session 做 live bootstrap；当前只支持 `apply`

## pw code

### `pw code [source] --session <name>`

- `--file <path>`：执行本地脚本
- `--retry <count>`
- 失败保留 Playwright 原始错误，常见 locator 问题后追加 `PWCLI_HINT`
- modal 阻塞时可能返回 `MODAL_STATE_BLOCKED`，先恢复 dialog

## Batch

### `pw batch --session <name>`

输入：`--stdin-json` / `--json`（别名）/ `--file <path>`，格式均为 `string[][]`。

选项：`--continue-on-error`、`--include-results`、`--summary-only`

稳定 argv 子集：

- `snapshot`、`snapshot -i`、`snapshot -c`
- `click <ref>`、`click --selector <selector>`、`click --text <text>`、`click --role <role> --name <name>`
- `fill <ref> <value>`、`fill --selector <selector> <value>`
- `press <key>`、`scroll <direction> [distance]`、`type [ref] <value>`
- `open <url>`
- `read-text`、`read-text --max-chars <n>`、`read-text --selector <selector>`、`read-text --include-overlay`
- `wait network-idle`（或 `--networkidle`）、`wait --text`、`wait --selector`、`wait --request`、`wait --response`
- `screenshot ...`、`observe status`、`errors recent|clear`
- `route list|add|load|remove ...`、`bootstrap apply ...`
- `state save|load`、`page current|list|frames|dialogs`

Supported batch click targets:

- `["click", "e12"]`
- `["click", "--selector", "#submit"]`
- `["click", "--text", "Submit"]`
- `["click", "--text", "Submit", "--nth", "2"]`
- `["click", "--role", "button", "--name", "Submit"]`
- `["click", "--role", "button", "--name", "Submit", "--nth", "2"]`

Other semantic click flags stay outside batch. Run the single `pw click ...` command when you need them.

注意：

- `batch --stdin-json` 表示 stdin steps 是 JSON，不表示输出 JSON；要 JSON 输出加 `pw --output json batch ...`
- `session` / `auth` / `environment` / `dialog` / diagnostics query 不属于稳定子集
- `data.analysis.warnings` 是串行依赖提示
- 默认 text 输出是轻量摘要，包含 step 数、成功/失败数、首个失败和 warnings，不倾倒嵌套 JSON
- 脚本解析和字段断言必须加 `--output json`；JSON envelope 保持 `data.summary` 和 `data.results`
- 只需要 JSON 汇总时加 `--summary-only`；失败信息看 `firstFailure*` 和 `failedSteps`
- text 输出需要紧凑 step 明细时加 `--include-results`

## Dashboard

### `pw dashboard open`

Opens Playwright-core's bundled session dashboard. This is a thin wrapper around Playwright's internal `playwright cli show` surface.

Use for human observation or takeover. Do not use as a required Agent workflow step.

If the bundled entrypoint is missing, the command fails with `DASHBOARD_UNAVAILABLE`.
If the dashboard subprocess exits during the startup observation window, the command fails with `DASHBOARD_LAUNCH_FAILED` instead of reporting `launched: true`.

## Environment

### `pw environment offline on|off --session <name>`

### `pw environment geolocation set --session <name> --lat <lat> --lng <lng>`

- 可选：`--accuracy <meters>`

### `pw environment permissions grant <perm...>|clear --session <name>`

- grant 示例：`geolocation clipboard-read`

### `pw environment clock install|set|resume --session <name>`

- `install`：安装 fake timers（`set` / `resume` 前必须先 `install`）
- `set <iso>`：将 fake time 设到目标时间
- `resume`：恢复时钟流逝

## Skill

### `pw skill path`

- 返回随包分发的 skill 路径

### `pw skill install <dir>`

- 安装到 `<dir>/pwcli`

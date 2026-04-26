# Command Reference

当前基线：

- 以 `src/app/commands/*` 和 `node dist/cli.js --help` 为准
- 命令输出默认是 JSON envelope
- 浏览器命令默认要求 `--session <name>`

## 1. 通用 contract

### session 规则

- 最大长度：`16`
- 允许字符：`[a-zA-Z0-9_-]`
- 缺失：`SESSION_REQUIRED`
- 超长：`SESSION_NAME_TOO_LONG`
- 非法字符：`SESSION_NAME_INVALID`

### 成功输出

```json
{
  "ok": true,
  "command": "click",
  "session": { "name": "bug-a" },
  "page": { "url": "https://example.com" },
  "data": {}
}
```

### 失败输出

```json
{
  "ok": false,
  "command": "click",
  "error": {
    "code": "CLICK_FAILED",
    "message": "click failed",
    "retryable": false,
    "suggestions": []
  }
}
```

## 2. 生命周期

### `pw session list`

- 列出当前 workspace bucket 下的 managed sessions
- 返回 session 元数据和 best-effort 页面摘要

### `pw session create <name>`

选项：

- `--open <url>`
- `--profile <path>`
- `--persistent`
- `--state <file>`
- `--headed`
- `--headless`
- `--trace`
- `--no-trace`

语义：

- 创建新的 named managed session
- 默认打开 `about:blank`
- `--state` 在 session 创建后加载

### `pw session attach <name> [endpoint]`

选项：

- `--ws-endpoint <url>`
- `--browser-url <url>`
- `--cdp <port>`
- `--trace`
- `--no-trace`

语义：

- 将 named managed session 绑定到现有浏览器 endpoint
- attach source 只允许提供一种

### `pw session recreate <name>`

选项：

- `--headed`
- `--headless`
- `--open <url>`
- `--trace`
- `--no-trace`

语义：

- 关闭并重建 named session
- 尝试保存并恢复 state
- `--headed` / `--headless` 改变 browser shape

### `pw session status <name>`

- 返回 best-effort session 状态

### `pw session close <name>`

- 关闭一个 named managed session

## 3. 页面读取

### `pw open <url> --session <name>`

语义：

- 在现有 session 中导航
- 不负责 lifecycle shape
- 如果要加载 state，先显式运行 `state load`
- 如果要换 profile/headed/persistent，走 `session create|recreate`

### `pw page current --session <name>`

- 返回当前 page projection

### `pw page list --session <name>`

- 返回当前 runtime session 下的 page projections

### `pw page frames --session <name>`

- 返回当前 page 的 frame projections

### `pw page dialogs --session <name>`

- 返回观测到的 dialog 事件投影
- 不是 authoritative live dialog set

### `pw dialog accept [prompt] --session <name>`

- 接受当前 browser dialog
- 适用于 `MODAL_STATE_BLOCKED` 后的原地恢复
- `prompt` 只在 prompt dialog 需要显式文本时传

### `pw dialog dismiss --session <name>`

- 关闭当前 browser dialog
- 适用于 `MODAL_STATE_BLOCKED` 后的原地恢复

### `pw snapshot --session <name>`

选项：

- `--mode ai|default`

### `pw screenshot [ref] --session <name>`

选项：

- `--selector <selector>`
- `--path <path>`
- `--full-page`

### `pw read-text --session <name>`

选项：

- `--selector <selector>`
- `--max-chars <count>`

### `pw observe status --session <name>`

- 默认返回 compact 摘要：
  - `summary`
  - `currentPage`
  - `dialogs`
  - `routes`
  - `pageErrors`
  - `console`
  - `network`
  - `trace`
  - `har`
  - `bootstrap`
- `--verbose` 返回完整状态载荷

### session defaults

- 默认值集中在 `src/domain/session/defaults.ts`
- 可选本地配置文件：`.pwcli/config.json`
- 当前默认 `trace: true`
- 显式 `--no-trace` 优先于默认值

## 4. 动作与等待

### `pw click [ref] --session <name>`

定位方式：

- aria ref
- `--selector`
- `--role <role> --name <name>`
- `--text <text>`
- `--label <label>`
- `--placeholder <text>`
- `--testid <id>`

附加选项：

- `--nth <n>`，1-based

### `pw fill [parts...] --session <name>`

选项：

- `--selector <selector>`

### `pw type [parts...] --session <name>`

选项：

- `--selector <selector>`

### `pw press <key> --session <name>`

- 对当前焦点元素发送按键

### `pw scroll <direction> [distance] --session <name>`

- 页面滚动

### `pw upload [parts...] --session <name>`

选项：

- `--selector <selector>`

### `pw download [ref] --session <name>`

选项：

- `--selector <selector>`
- `--path <path>`
- `--dir <dir>`

### `pw drag [parts...] --session <name>`

选项：

- `--from-selector <selector>`
- `--to-selector <selector>`

### `pw resize --session <name>`

选项：

- `--view <width>x<height>`
- `--preset desktop|ipad|iphone`

### `pw wait [target] --session <name>`

条件：

- 毫秒 delay
- aria ref
- `--text <text>`
- `--selector <selector>`
- `--networkidle`
- `--request <url>`
- `--response <url>`

附加过滤：

- `--method <method>`
- `--status <code>`

规则：

- 一次只等一个条件

## 5. 诊断

### `pw console --session <name>`

选项：

- `--level info|warning|error`
- `--text <text>`
- `--since <iso>`
- `--limit <n>`

### `pw network --session <name>`

选项：

- `--request-id <id>`
- `--url <substring>`
- `--kind request|response|requestfailed`
- `--method <method>`
- `--status <code>`
- `--resource-type <type>`
- `--text <text>`
- `--since <iso>`
- `--limit <n>`

说明：

- 对文本类 request/response，sample/detail 可能带：
  - `requestBodySnippet`
  - `responseBodySnippet`
- 这是裁剪后的诊断片段，不是全量 body

### `pw errors recent --session <name>`

- 查看当前页错误记录
- 支持：
  - `--text <substring>`
  - `--since <iso>`
  - `--limit <n>`

### `pw errors clear --session <name>`

- 清当前错误基线

### `pw diagnostics export --session <name> --out <file>`

- 导出当前 session 的 workspace / console / network / errors / routes / bootstrap
- 可选：
  - `--section all|workspace|console|network|errors|routes|bootstrap`
  - `--limit <n>`
  - `--since <iso>`
  - `--text <substring>`
  - `--fields <list>`
- `--fields` 支持 `path` 和 `alias=path`

### `pw diagnostics runs`

- 列出 `.pwcli/runs/` 下的 run 摘要
- 可选：
  - `--limit <n>`
  - `--session <name>`
  - `--since <iso>`，按 run 的 `lastTimestamp` 过滤
- 返回：
  - `runId`
  - `sessionName`
  - `firstTimestamp`
  - `lastTimestamp`
  - `commandCount`
  - `summary`

### `pw diagnostics digest`

选项：

- `--session <name>`
- `--run <runId>`
- `--limit <n>`

规则：

- `--session` 和 `--run` 二选一
- `--session` 返回 live session 摘要
- `--run` 返回一次 run 的摘要
- 当前适合作为 Agent 的第一层诊断入口

### `pw diagnostics show --run <runId>`

- 打印一个 run 的事件
- 可选：
  - `--command <name>`
  - `--since <iso>`
  - `--fields <list>`
  - `--limit <n>`
- `--fields` 支持 `path` 和 `alias=path`

### `pw diagnostics grep --run <runId> --text <substring>`

- 按子串过滤 run 事件
- 可选：
  - `--command <name>`
  - `--since <iso>`
  - `--fields <list>`
  - `--limit <n>`
- `--fields` 支持 `path` 和 `alias=path`

### `pw route list --session <name>`

- 返回当前 managed session 的 active route metadata

### `pw route add <pattern> --session <name>`

选项：

- `--abort`
- `--method <method>`
- `--body <text>`
- `--body-file <path>`
- `--headers-file <path>`
- `--status <code>`
- `--content-type <type>`

### `pw route load <file> --session <name>`

- 从 JSON 文件批量加载 route specs

### `pw route remove [pattern] --session <name>`

- 省略 `pattern` 时清空全部 managed-session routes

### `pw trace start|stop --session <name>`

- 管理 trace recording

### `pw har start [path]|stop --session <name>`

- 当前用于暴露 HAR substrate 边界
- 热录制未形成稳定 contract

### `pw doctor`

选项：

- `--plugin <name>`
- `--profile <path>`
- `--state <file>`
- `--endpoint <url>`
- `--session <name>`
- `--verbose`

用途：

- 诊断 session substrate
- 诊断 profile/state 路径
- 探测 endpoint reachability
- 默认返回 compact 诊断和恢复建议
- `--verbose` 返回完整 probe 细节

## 6. 状态复用

### `pw state save [file] --session <name>`

- 导出 storage state

### `pw state load <file> --session <name>`

- 导入 storage state

### `pw cookies list --session <name>`

选项：

- `--domain <domain>`

### `pw cookies set --session <name>`

必填：

- `--name <name>`
- `--value <value>`
- `--domain <domain>`

可选：

- `--path <path>`，默认 `/`

### `pw storage local --session <name>`

- 读取当前页 origin 的 `localStorage`

### `pw storage session --session <name>`

- 读取当前页 origin 的 `sessionStorage`

### `pw profile inspect <path>`

- 检查 profile 路径是否存在、可写、可用

## 7. 扩展与分发

### `pw code [source] --session <name>`

选项：

- `--file <path>`

### `pw auth [plugin] --session <name>`

选项：

- `--plugin <name>`
- `--save-state <file>`
- `--arg <key=value>`，可重复

语义：

- 在现有 named managed session 中运行本地 auth plugin
- 需要的 session shape 先通过 `session create` 建好
- 可选地在完成后保存 state

### `pw bootstrap apply --session <name>`

选项：

- `--init-script <file>`，可重复
- `--headers-file <file>`

语义：

- 对已存在 session 做 live bootstrap
- 当前只支持 `apply`

### `pw batch --session <name> --json`

选项：

- `--continue-on-error`

stdin 输入格式：

```json
[
  ["snapshot"],
  ["click", "--selector", "#fire"],
  ["wait", "--response", "/fixture", "--status", "200"]
]
```

### `pw batch --session <name> --file <path>`

选项：

- `--continue-on-error`

文件内容格式与 `--json` 相同，都是 `string[][]`。

当前稳定 argv 命令：

- `snapshot`
- `click <ref>`
- `click --selector <selector>`
- `wait networkIdle`
- `wait --selector <selector>`
- `wait --text <text>`
- `wait --request <url> [--method <method>]`
- `wait --response <url> [--method <method>] [--status <code>]`
- `screenshot ...`
- `observe status`
- `errors recent|clear`
- `route list`
- `route add|load|remove ...`
- `bootstrap apply ...`
- `state save|load`
- `page current|list|frames|dialogs`
- `page dialogs`

说明：

- `batch` 当前只承诺稳定子集
- 这是有意 trade-off
- Agent 需要的是稳定可消费的编排，不是“看起来什么都能跑”的脆弱 parity
- 超出子集时，直接运行单命令或转 `pw code`

### `pw environment offline on|off --session <name>`

- 切换 BrowserContext 离线模式

### `pw environment geolocation set --session <name> --lat <lat> --lng <lng>`

- 可选：
  - `--accuracy <meters>`

### `pw environment permissions grant <perm...> --session <name>`

- 例子：`geolocation clipboard-read`

### `pw environment permissions clear --session <name>`

- 清除所有权限覆盖

### `pw environment clock install --session <name>`

- 安装 fake timers

### `pw environment clock set --session <name> <iso>`

- 当前 managed substrate 下可能返回 limitation

### `pw environment clock resume --session <name>`

- 恢复时钟流逝

### `pw plugin list`

- 列出可发现的本地插件

### `pw plugin path <name>`

- 返回插件解析路径

### `pw skill path`

- 返回随包分发的 skill 路径

### `pw skill install <dir>`

- 安装到 `<dir>/pwcli`

## 8. 当前限制

- modal state 会阻断 `page *` / `observe status` 的读取链路
- `session status` 是 best-effort
- `session attach --browser-url/--cdp` 依赖本地 attach bridge registry
- `storage local|session` 对无效 origin 返回 `accessible: false`
- 默认 artifact run 目录尚未落地

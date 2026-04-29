# Command Reference — 核心交互

适用：session 生命周期、页面读取、动作与等待。这是每个任务都会用到的命令层。

诊断 / mock 命令见 `command-reference-diagnostics.md`；
state / auth / batch / environment 命令见 `command-reference-advanced.md`。

基线：以 `src/app/commands/*` 和 `node dist/cli.js --help` 为准。

## 通用 contract

**session 规则**：最大 16 字符，允许 `[a-zA-Z0-9_-]`。错误码：`SESSION_REQUIRED` / `SESSION_NAME_TOO_LONG` / `SESSION_NAME_INVALID`。

**输出模式**：默认 agent-readable text。脚本解析加 `--output json`，envelope 为 `{ ok, command, session, page, data }` / `{ ok, command, error: { code, message, retryable, suggestions } }`。

## 生命周期

### `pw session create <name>`

- `--open <url>`、`--profile <path>`、`--persistent`、`--state <file>`
- `--headed` / `--headless`、`--trace` / `--no-trace`
- 默认打开 `about:blank`；`--state` 在创建后加载

### `pw session attach <name>`

- `--ws-endpoint <url>` / `--browser-url <url>` / `--cdp <port>`（三选一）
- `--trace` / `--no-trace`

### `pw session recreate <name>`

- `--headed` / `--headless`、`--open <url>`、`--trace` / `--no-trace`
- 关闭并重建；尝试保存并恢复 state

### `pw session list`

- `--with-page`：为 live session 补 best-effort 页面摘要

### `pw session status <name>`

- best-effort 状态；页面忙或弹窗阻塞时用 `pw doctor` 复查

### `pw session close <name>` / `pw session close --all`

- `pw session close all` 等价于 `--all`

## 页面读取

### `pw open <url> --session <name>`

- 在现有 session 中导航；不负责 lifecycle shape
- 换 profile / headed / persistent 走 `session create|recreate`

### `pw observe status --session <name>`

- compact 摘要：summary / currentPage / dialogs / routes / pageErrors / console / network / trace / har / bootstrap
- `--verbose` 返回完整载荷

### `pw page current|list|frames|dialogs --session <name>`

- `dialogs` 是事件投影，不是 authoritative live dialog set

### `pw tab select|close <pageId> --session <name>`

- 写操作只接受 `pageId`
- 先用 `pw page list --session <name>` 获取 `pageId`
- `tab close` 关闭当前页后按 opener、前一个 page、后一个 page 的顺序回退 active target；没有剩余页面则 workspace 为空
- 不接受 index、title、URL substring 作为目标

### `pw read-text --session <name>`

- `--selector <selector>`、`--include-overlay`、`--max-chars <count>`

### `pw snapshot --session <name>`

- `-i, --interactive`：只输出可交互节点（找 ref 首选）
- `-c, --compact`：移除低信号结构节点

### `pw screenshot [ref] --session <name>`

- `--selector <selector>`、`--path <path>`、`--full-page`

### `pw dialog accept [prompt]|dismiss --session <name>`

- `MODAL_STATE_BLOCKED` 后的原地恢复；`prompt` 只在 prompt dialog 需要显式文本时传

## 动作与等待

### `pw click [ref] --session <name>`

定位：aria ref / `--selector` / `--role <role> --name <name>` / `--text` / `--label` / `--placeholder` / `--testid`；附加 `--nth <n>`（1-based）

所有 click 定位方式都会记录 action evidence：`target`、`diagnosticsDelta`、`run`。需要追踪动作后信号时用 `diagnostics runs/show/grep` 查对应 run。

### `pw fill [parts...] --session <name>`

定位：aria ref / `--selector` / `--role <role> --name <name>` / `--text` / `--label` / `--placeholder` / `--testid`；附加 `--nth <n>`（1-based）

有 `--selector` 或语义定位参数时，所有 `parts` 拼成填充值；否则第一个 part 是 ref，后续 parts 拼成填充值。

### `pw type [parts...] --session <name>`

定位：focused element / aria ref / `--selector` / `--role <role> --name <name>` / `--text` / `--label` / `--placeholder` / `--testid`；附加 `--nth <n>`（1-based）

无 `--selector` 和语义定位时：单个 part 输入到当前 focused element；多个 parts 时第一个 part 是 ref，后续 parts 拼成输入值。有 `--selector` 或语义定位参数时，所有 `parts` 拼成输入值。

### `pw press <key> --session <name>`

### `pw check [ref] --session <name>`

- `--selector <selector>`
- 支持 checkbox / radio；输出复用 action evidence：`diagnosticsDelta`、`run`

### `pw uncheck [ref] --session <name>`

- `--selector <selector>`
- 支持 checkbox；输出复用 action evidence：`diagnosticsDelta`、`run`

### `pw select [ref] <value> --session <name>`

- `--selector <selector>`
- `value` 是 option value；输出包含 `value` / `values` 和 action evidence

### `pw scroll <direction> [distance] --session <name>`

### `pw drag --session <name>`

- `--from-selector <selector>`、`--to-selector <selector>`

### `pw upload [parts...] --session <name>`

- `--selector <selector>`

### `pw download [ref] --session <name>`

- `--selector <selector>`、`--path <path>`、`--dir <dir>`

### `pw resize --session <name>`

- `--view <width>x<height>`、`--preset desktop|ipad|iphone`

### `pw wait [target] --session <name>`

条件（一次只等一个）：毫秒 delay / aria ref / `--text` / `--selector` / `network-idle`（或 `--networkidle`）/ `--request <url>` / `--response <url>`

附加过滤：`--method <method>`、`--status <code>`

## 当前限制

- modal state 阻断 `page *` / `observe status` 读取链路
- `session status` 是快速检查；异常时用 `pw doctor --session <name>`
- `session attach --browser-url/--cdp` 只接管本机可连接的调试端口
- `storage local|session` 对无效 origin 返回 `accessible: false`
- 默认 `trace: true`；显式 `--no-trace` 优先；可用 `.pwcli/config.json` 设默认值
- pwcli 启动的新 session 会把 Playwright 原始附件写入 `.pwcli/playwright/`；已有 session 需要 recreate 才切换目录

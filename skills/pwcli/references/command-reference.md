# Command Reference — 核心交互

适用：session 生命周期、页面读取、动作与等待。这是每个任务都会用到的命令层。

诊断 / mock 命令见 `command-reference-diagnostics.md`；
state / auth / batch / environment 命令见 `command-reference-advanced.md`。

基线：以 `src/app/commands/*` 和 `node dist/cli.js --help` 为准。

## 通用 contract

**session 规则**：最大 16 字符，允许 `[a-zA-Z0-9_-]`。错误码：`SESSION_REQUIRED` / `SESSION_NAME_TOO_LONG` / `SESSION_NAME_INVALID` / `SESSION_BUSY`。

**同 session 串行化**：同一个 session 上的 lifecycle startup/reset/close 和 managed command dispatch 都会用 per-session lock 串行进入 Playwright substrate；如果等待锁超时，返回可重试的 `SESSION_BUSY`。依赖步骤仍然按顺序发，稳定子集可用 `pw batch --session <name>`。

**输出模式**：默认 agent-readable text。脚本解析加 `--output json`，envelope 为 `{ ok, command, session, page, data }` / `{ ok, command, error: { code, message, retryable, suggestions } }`。

## 生命周期

### `pw session create <name>`

- `--open <url>`、`--profile <path>`、`--persistent`、`--state <file>`
- `--from-system-chrome`、`--chrome-profile <directory-or-name>`：从本机 Chrome profile 启动 session，复用已有登录态
- `--headed` / `--headless`、`--trace` / `--no-trace`
- 默认打开 `about:blank`；`--state` 在创建后加载
- `--profile` 与 `--from-system-chrome` 互斥；系统 Chrome profile 正被 Chrome 使用时，底层可能返回 profile locked，需要关闭 Chrome 或换 profile
- 同名 session 的并发 create/reset 会按 per-session lock 串行；Agent 不应并发发同名 lifecycle 命令

### `pw session attach <name>`

- `--ws-endpoint <url>` / `--browser-url <url>` / `--cdp <port>`（三选一）
- `--attachable-id <id>`：用 `pw session list --attachable` 返回的 server id/title 直接接管当前 workspace 里的现成 browser server
- `--trace` / `--no-trace`

### `pw session recreate <name>`

- `--headed` / `--headless`、`--open <url>`、`--trace` / `--no-trace`
- 关闭并重建；尝试保存并恢复 state
- stop + startup + registry load 受同一把 per-session lock 保护

### `pw session list`

- `--with-page`：为 live session 补 best-effort 页面摘要
- `--attachable`：列出当前 workspace 内 Playwright server registry 中可供接管的 browser servers；只做 discovery，不自动 attach
- 传 `--attachable` 时额外返回：
  - `capability`
    - `capability: "existing-browser-attach"`
    - `supported`
    - `available`
    - `attachableCount`
    - `connectableCount`
    - `endpointCount`
    - `workspaceScoped`
  - `attachable.servers[].capability`
    - `capability: "existing-browser-attach-target"`
    - `available`
    - `connectable`
    - `endpointExposed`
    - `attachableId`

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

### `pw page assess --session <name>`

- compact、read-only 的页面评估摘要
- 输出 `summary`、`dataHints`、`complexityHints`、`nextSteps`、`limitations`、`evidence`
- 目标是帮助 Agent 判断当前页更适合先走：
  - `read-text`
  - `snapshot -i`
  - `code`
  - `storage local`
  - `diagnostics digest`
- 不是 action planner，不返回具体点击目标，不替代 extractor / auth probe / diagnostics bundle
- `nextSteps` 只给“下一类观察命令”，不替 Agent 决定业务动作
- 当前结论是 inference-only；涉及 runtime / network / storage 的 authoritative 事实，要继续跑对应命令家族
- 当前边界冻结在 compact summary，不继续把它扩成页面智能层

### `pw tab select|close <pageId> --session <name>`

- 写操作只接受 `pageId`
- 先用 `pw page list --session <name>` 获取 `pageId`
- `tab close` 关闭当前页后按 opener、前一个 page、后一个 page 的顺序回退 active target；没有剩余页面则 workspace 为空
- 不接受 index、title、URL substring 作为目标

### `pw read-text --session <name>`

- `--selector <selector>`、`--no-include-overlay`、`--max-chars <count>`（默认 8000，overlay 默认纳入）

### `pw locate --session <name>`

低噪声定位，返回总匹配数 `count` 和最多 10 个候选摘要；不返回 ref，不生成动作计划。

候选 metadata：

- `index`：1-based candidate index；传 `--nth <n>` 时仍保留总 `count`，候选只返回该 index。
- `text` / `tagName` / `visible`
- `href`：候选或最近链接祖先的绝对 URL，适合导航目标判断。
- `role` / `name`：显式或常见隐式 role，以及可消费 name hint。
- `region` / `ancestor`：最近 landmark/区域和父级摘要，帮助区分重复文本。
- `selectorHint`：best-effort CSS 路径提示；可作为下一步 selector 起点，但不是稳定契约。

目标（一次只传一个）：

- `--selector <selector>`
- `--text <text>`
- `--role <role> --name <name>`
- `--label <label>`
- `--placeholder <text>`
- `--testid <id>`
- `--nth <n>`：1-based disambiguation

### `pw get <fact> --session <name>`

支持 facts：

- `text`：目标首个匹配节点的 `textContent`
- `value`：目标首个匹配表单控件的 `inputValue()`
- `count`：匹配数量，目标不存在时返回 `0`

目标同 `locate`。`get text|value` 要求目标至少存在一个；需要先探测数量时用 `get count` 或 `locate`。

### `pw is <state> --session <name>`

支持 states：

- `visible`
- `enabled`
- `checked`

目标同 `locate`。目标不存在时返回 `value: false` 和 `count: 0`。`checked` 只适合 checkbox/radio 等可检查控件。

### `pw verify <assertion> --session <name>`

Read-only assertion command for agent loops after actions and waits. Success returns `{ assertion, passed: true, actual, expected, target?, count?, retryable: false, suggestions: [] }`. Failure exits non-zero with `VERIFY_FAILED` and the same assertion result under `error.details`.

Assertions:

- `text` / `text-absent` with a target, usually `--text <text>`
- `url` with exactly one of `--contains <text>` / `--equals <url>` / `--matches <regex>`
- `visible` / `hidden`
- `enabled` / `disabled`
- `checked` / `unchecked`
- `count` with `--equals <n>` / `--min <n>` / `--max <n>`

Examples:

```bash
pw verify text --session bug-a --text '保存成功'
pw verify visible --session bug-a --selector '#submit'
pw verify enabled --session bug-a --role button --name '提交'
pw verify url --session bug-a --contains '/dashboard'
pw verify count --session bug-a --selector '.row' --equals 3
```

Use `locate/get/is/verify` for narrow state checks. Use `snapshot -i` when you need fresh refs. Do not use these commands as an action planner.

### `pw snapshot --session <name>`

- `-i, --interactive`：只输出可交互节点（找 ref 首选）
- `-c, --compact`：移除低信号结构节点
- `snapshot status`：检查当前 snapshot 是否 fresh / stale / navigated / missing

大页面顺序：先 `read-text --selector ... --max-chars ...` 或 `locate` 缩小范围，再 `snapshot -i` / `snapshot -c`，最后才跑全量 `snapshot`。如果当前命令面暴露 depth 参数，优先用 depth 限制层级；不要默认倾倒全量结构树。

### `pw screenshot [ref] --session <name>`

- `--selector <selector>`、`--path <path>`、`--full-page`

### `pw pdf --session <name> --path <path>`

- 将 active page 导出为 PDF
- 低频页面归档证据；不做报告模板、合并或批量归档
- 依赖当前 Playwright substrate 的 Chromium PDF 能力

### `pw dialog accept [prompt]|dismiss --session <name>`

- `MODAL_STATE_BLOCKED` 后的原地恢复；`prompt` 只在 prompt dialog 需要显式文本时传

## 动作与等待

### `pw click [ref] --session <name>`

定位：aria ref / `--selector` / `--role <role> --name <name>` / `--text` / `--label` / `--placeholder` / `--testid`；附加 `--nth <n>`（1-based）

`--nth` 对 selector 和语义定位都生效；多匹配 selector 会先应用 `.nth(n-1)` 再执行 click，不触发 Playwright strict-mode 多匹配。

所有 click 定位方式都会记录 action evidence：`target`、`diagnosticsDelta`、`run`。需要追踪动作后信号时用 `diagnostics runs/show/grep` 查对应 run。

### `pw fill [parts...] --session <name>`

定位：aria ref / `--selector` / `--role <role> --name <name>` / `--text` / `--label` / `--placeholder` / `--testid`；附加 `--nth <n>`（1-based）

`--nth` 对 selector 和语义定位都生效；多匹配 selector 会先应用 `.nth(n-1)` 再填值。

有 `--selector` 或语义定位参数时，所有 `parts` 拼成填充值；否则第一个 part 是 ref，后续 parts 拼成填充值。

### `pw type [parts...] --session <name>`

定位：focused element / aria ref / `--selector` / `--role <role> --name <name>` / `--text` / `--label` / `--placeholder` / `--testid`；附加 `--nth <n>`（1-based）

`--nth` 对 selector 和语义定位都生效；多匹配 selector 会先应用 `.nth(n-1)` 再输入。

无 `--selector` 和语义定位时：单个 part 输入到当前 focused element；多个 parts 时第一个 part 是 ref，后续 parts 拼成输入值。有 `--selector` 或语义定位参数时，所有 `parts` 拼成输入值。

### `pw press <key> --session <name>`

### `pw hover [ref] --session <name>`

- `--selector <selector>`
- `--nth <n>`：selector 多匹配时的 1-based 目标序号
- 支持 hover 触发的 menu / popover / tooltip；输出复用 action evidence：`target`、`diagnosticsDelta`、`run`
- hover 后读取浮层时，用 `pw read-text --session <name>`（overlay 默认包含）

### `pw check [ref] --session <name>`

- `--selector <selector>`
- `--nth <n>`：selector 多匹配时的 1-based 目标序号
- 支持 checkbox / radio；输出复用 action evidence：`diagnosticsDelta`、`run`

### `pw uncheck [ref] --session <name>`

- `--selector <selector>`
- `--nth <n>`：selector 多匹配时的 1-based 目标序号
- 支持 checkbox；输出复用 action evidence：`diagnosticsDelta`、`run`

### `pw select [ref] <value> --session <name>`

- `--selector <selector>`
- `value` 是 option value；输出包含 `value` / `values` 和 action evidence

### `pw scroll <direction> [distance] --session <name>`

### `pw drag --session <name>`

- `--from-selector <selector>`、`--to-selector <selector>`

### `pw upload [parts...] --session <name>`

- `--selector <selector>`
- 返回前 best-effort 等待 input `files` 数量和 `change` / `input` 事件 settle
- 如果无法完全判定页面已接收上传，输出 `nextSteps`，按提示补 `pw wait` / `pw verify` / `pw get` 后再继续

### `pw download [ref] --session <name>`

- `--selector <selector>`、`--path <path>`、`--dir <dir>`
- `--path` 不能和 `--dir` 同时使用

### `pw resize --session <name>`

- `--view <width>x<height>`、`--preset desktop|ipad|iphone`

### `pw wait [target] --session <name>`

条件（一次只等一个）：毫秒 delay / aria ref / `--text` / `--selector` / `network-idle`（或 `--networkidle`）/ `--request <url>` / `--response <url>`

附加过滤：`--method <method>`、`--status <code>`

## 当前限制

- modal state 阻断 `page *` / `observe status` 读取链路
- `page assess` 只做 inference summary，不直接导出 runtime state、storage state、network payload，也不做 selector-scoped assessment
- `session status` 是快速检查；异常时用 `pw doctor --session <name>`
- `session attach --browser-url/--cdp` 只接管本机可连接的调试端口
- `storage local|session` 对无效 origin 返回 `accessible: false`
- 默认 `trace: true`；显式 `--no-trace` 优先；可用 `.pwcli/config.json` 设默认值
- pwcli 启动的新 session 会把 Playwright 原始附件写入 `.pwcli/playwright/`；已有 session 需要 recreate 才切换目录

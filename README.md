# pwcli

`pwcli` 是一个面向内部 Agent 的 Playwright orchestration CLI，默认命令名是 `pw`。

当前真相：

- 浏览器命令走 **strict session-first**
- 先显式创建或接管 session
- 后续浏览器命令都显式带 `--session <name>`
- 输出默认是稳定 JSON envelope
- 目标用户是 agent，不为人类交互式体验做额外兼容

## 1. 稳定主链

```bash
pw session create bug-a --open 'https://example.com'
pw snapshot --session bug-a
pw click e6 --session bug-a
pw wait --session bug-a networkIdle
pw read-text --session bug-a
pw session close bug-a
```

接管已有浏览器：

```bash
pw session attach bug-a --ws-endpoint ws://127.0.0.1:9222/devtools/browser/...
pw session attach bug-a --browser-url http://127.0.0.1:9222
pw session attach bug-a --cdp 9222
```

## 2. session 规则

- session 名最长 `16` 个字符
- 只允许：字母、数字、`-`、`_`
- 缺失 session 会返回 `SESSION_REQUIRED`
- 超长会返回 `SESSION_NAME_TOO_LONG`
- 非法字符会返回 `SESSION_NAME_INVALID`

推荐命名：

- `bug-a`
- `diag-q2`
- `auth-a`
- `dc-main`

## 3. 输出 contract

成功：

```json
{
  "ok": true,
  "command": "snapshot",
  "session": { "name": "bug-a" },
  "page": { "url": "https://example.com" },
  "data": { "resolvedSession": "bug-a" }
}
```

失败：

```json
{
  "ok": false,
  "command": "snapshot",
  "error": {
    "code": "SESSION_REQUIRED",
    "message": "Session is required",
    "retryable": false,
    "suggestions": ["Run `pw session create <name> --open <url>` first"]
  }
}
```

约束：

- `command` 始终存在
- 成功时有 `data`
- 失败时有 `error`
- `session` / `page` / `diagnostics` 按命令需要返回
- `resolvedSession` 在大多数 session 相关命令里会出现在 `data`

## 4. 当前命令面

### 生命周期

```text
pw session list
pw session create <name> [--open <url>] [--profile <path>] [--persistent] [--state <file>] [--headed | --headless] [--trace | --no-trace]
pw session attach <name> [endpoint] [--ws-endpoint <url> | --browser-url <url> | --cdp <port>] [--trace | --no-trace]
pw session recreate <name> [--headed | --headless] [--open <url>] [--trace | --no-trace]
pw session status <name>
pw session close <name>
```

### 页面读取

```text
pw open <url> --session <name> [--headed] [--profile <path>] [--persistent] [--state <file>]
pw page current --session <name>
pw page list --session <name>
pw page frames --session <name>
pw page dialogs --session <name>
pw snapshot --session <name> [--mode ai|default]
pw screenshot [ref] --session <name> [--selector <selector>] [--path <path>] [--full-page]
pw read-text --session <name> [--selector <selector>] [--max-chars <count>]
pw observe status --session <name>
```

### 动作与等待

```text
pw click [ref] --session <name> [--selector <selector> | --role <role> --name <name> | --text <text> | --label <label> | --placeholder <text> | --testid <id>] [--nth <n>]
pw fill [parts...] --session <name> [--selector <selector>]
pw type [parts...] --session <name> [--selector <selector>]
pw press <key> --session <name>
pw scroll <direction> [distance] --session <name>
pw upload [parts...] --session <name> [--selector <selector>]
pw download [ref] --session <name> [--selector <selector>] [--path <path>] [--dir <dir>]
pw drag [parts...] --session <name> [--from-selector <selector>] [--to-selector <selector>]
pw resize --session <name> [--view <width>x<height>] [--preset desktop|ipad|iphone]
pw wait [target] --session <name> [--text <text>] [--selector <selector>] [--networkidle] [--request <url>] [--response <url>] [--method <method>] [--status <code>]
```

### 诊断

```text
pw console --session <name> [--level info|warning|error] [--text <text>]
pw network --session <name> [--request-id <id>] [--url <substring>] [--kind request|response|requestfailed] [--method <method>] [--status <code>] [--resource-type <type>] [--text <text>] [--limit <n>]
pw errors recent --session <name> [--text <substring>] [--limit <n>]
pw errors clear --session <name>
pw diagnostics export --session <name> --out <file>
pw diagnostics runs
pw diagnostics show --run <runId>
pw diagnostics grep --run <runId> --text <substring>
pw route list --session <name>
pw route add <pattern> --session <name> [--abort] [--method <method>] [--body <text> | --body-file <path>] [--headers-file <path>] [--status <code>] [--content-type <type>]
pw route load <file> --session <name>
pw route remove [pattern] --session <name>
pw trace start --session <name>
pw trace stop --session <name>
pw har start [path] --session <name>
pw har stop --session <name>
pw doctor [--plugin <name>] [--profile <path>] [--state <file>] [--endpoint <url>] [--session <name>]
```

### 状态复用

```text
pw state save [file] --session <name>
pw state load <file> --session <name>
pw cookies list --session <name> [--domain <domain>]
pw cookies set --session <name> --name <name> --value <value> --domain <domain> [--path <path>]
pw storage local --session <name>
pw storage session --session <name>
pw profile inspect <path>
pw profile open <path> <url> --session <name>
```

### 环境控制

```text
pw environment offline on|off --session <name>
pw environment geolocation set --session <name> --lat <lat> --lng <lng> [--accuracy <meters>]
pw environment permissions grant <perm...> --session <name>
pw environment permissions clear --session <name>
pw environment clock install --session <name>
pw environment clock set --session <name> <iso>
pw environment clock resume --session <name>
```

### 扩展与分发

```text
pw code [source] --session <name> [--file <path>]
pw auth [plugin] --session <name> [--plugin <name>] [--save-state <file>] [--arg <key=value>]
pw bootstrap apply --session <name> [--init-script <file> ...] [--headers-file <file>]
pw batch --session <name> --json|--file <path> [--continue-on-error]
pw plugin list
pw plugin path <name>
pw skill path
pw skill install <dir>
```

## 5. 推荐使用路径

### 5.1 探索页面

```bash
pw session create bug-a --open 'https://example.com'
pw snapshot --session bug-a
pw page current --session bug-a
pw read-text --session bug-a --max-chars 1200
```

### 5.2 执行动作并拿诊断

```bash
pw click e6 --session bug-a
pw wait --session bug-a networkIdle
pw console --session bug-a --level warning
pw network --session bug-a --resource-type xhr
pw errors recent --session bug-a
```

### 5.3 复用状态

```bash
pw state save ./auth.json --session bug-a
pw session close bug-a
pw session create bug-b --open 'https://example.com' --state ./auth.json
```

### 5.4 运行本地插件登录

```bash
pw auth dc-login --session auth-a --arg targetUrl='https://example.com' --save-state ./auth.json
```

### 5.5 批量步骤

```bash
cat <<'JSON' | pw batch --session bug-a --json
[
  ["click", "e6"],
  ["wait", "networkIdle"],
  ["observe", "status"],
  ["errors", "recent"]
]
JSON
```

## 6. 当前已知限制

- session defaults 当前集中在：
  - `src/domain/session/defaults.ts`
  - 可选本地配置：`.pwcli/config.json`
- `trace` 默认开启；显式 `--no-trace` 才关闭
- `session status` 是 best-effort 视图
- `page dialogs` 返回观测到的 dialog 事件投影
- modal state 当前统一报 `MODAL_STATE_BLOCKED`
- 动作命令当前会回传 `diagnosticsDelta`
- `session attach --browser-url/--cdp` 依赖本地 attach bridge registry；raw CDP 外部浏览器还未形成通用 contract
- `storage local|session` 只读当前页 origin；无效 origin 会返回 `accessible: false`
- `console` / `network` 返回最近记录与过滤结果；当前没有事件流服务
- `diagnostics export` 当前导出的是 session 内结构化 records，不是持久化数据库
- `environment clock set` 当前在 managed substrate 下会返回 limitation，不写成稳定能力
- `har start|stop` 当前用于暴露 substrate 能力边界，热录制尚未形成稳定 contract
- 当前只有最小 `.pwcli/runs/<runId>/events.jsonl`

## 7. 文档入口

- 项目真相：[.claude/project/16-project-truth.md](./.claude/project/16-project-truth.md)
- 命令面：[.claude/project/04-command-surface.md](./.claude/project/04-command-surface.md)
- runtime state：[.claude/project/05-runtime-state-model.md](./.claude/project/05-runtime-state-model.md)
- diagnostics：[.claude/project/07-artifacts-diagnostics.md](./.claude/project/07-artifacts-diagnostics.md)
- shipped skill：[skills/pwcli/SKILL.md](./skills/pwcli/SKILL.md)

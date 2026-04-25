# pwcli

`pwcli` 是一个面向内部 Agent 的 Playwright 命令壳，默认命令名是 `pw`。

当前项目真相已经收口成：

- 浏览器命令主路径是 **strict session-first**
- 先 `session create <name>`
- 后续所有浏览器相关命令都显式带 `--session <name>`
- 不再保留自动 fallback

## 当前命令集

```text
pw session create|list|status|close|recreate
pw open <url> --session <name>
pw connect [endpoint] --session <name>
pw code [source] --session <name>
pw auth [plugin] --session <name>
pw batch <steps...> --session <name>
pw page current|list|frames --session <name>
pw snapshot --session <name>
pw screenshot [ref] --session <name>
pw resize --session <name>
pw read-text --session <name>
pw fill [parts...] --session <name>
pw type [parts...] --session <name>
pw press <key> --session <name>
pw scroll <direction> [distance] --session <name>
pw upload [parts...] --session <name>
pw download [ref] --session <name>
pw drag [parts...] --session <name>
pw console --session <name>
pw network --session <name>
pw click [ref] --session <name>
pw wait [target] --session <name>
pw trace <action> --session <name>
pw state <action> [file] --session <name>
pw profile inspect|open
pw plugin list|path
pw skill path|install
```

## 当前推荐主链

```bash
pw session create dc-main --open 'https://developer-192-168-5-18.tap.dev/forge/89347/all-app'
pw snapshot --session dc-main
pw click e6 --session dc-main
pw wait networkIdle --session dc-main
pw read-text --session dc-main
pw resize --session dc-main --preset desktop
pw session close dc-main
```

对 Agent，这条规则最清楚：

- 先创建 session
- 后面重复带同一个 `--session`
- CLI 不会替你猜目标 session

## 到达真实已登录页面

### 1. 直接打开真实页

```bash
pw session create dc-main --open 'https://developer-192-168-5-18.tap.dev/forge/89347/all-app'
```

### 2. 复用已登录 profile

```bash
pw session create dc-main \
  --open 'http://127.0.0.1:4110/forge' \
  --profile ~/.forge-browser/profiles/acceptance-login
```

### 3. 复用 state

```bash
pw session create dc-main --open 'https://developer-192-168-5-18.tap.dev/forge/89347/all-app'
pw state save ./auth.json --session dc-main
pw session close dc-main

pw session create dc-main --open 'https://developer-192-168-5-18.tap.dev/forge/89347/all-app' --state ./auth.json
```

### 4. 动态登录

```bash
pw auth dc-login \
  --session dc-main \
  --open 'https://developer-192-168-5-18.tap.dev/forge/89347/all-app'
```

`dc-login` 当前规则：

- 用户给完整 deep link，插件直接把它当 `targetUrl`
- 并从它提取 `baseURL`
- 用户没给完整链接，才回落到 `accounts.json / instance / 本地端口探测`

## 当前值得记住的事实

- `-s` 是 `--session` 的短别名
- `session create` 是唯一推荐的浏览器生命周期入口
- `session recreate <name> --headed|--headless` 用于切换有头/无头；底层是重建 session，不是原地切换
- `click` 支持：
  - `aria-ref`
  - `--selector`
  - semantic locator：`--role` / `--text` / `--label` / `--placeholder` / `--testid`
- `open` / `auth` / `connect` 都要求显式 `--session`
- `console` / `network` 当前返回结构化摘要，不是完整事件流系统
- `download` 支持：
  - `--path <file>`：明确文件路径
  - `--dir <dir>`：保留浏览器建议文件名
- `resize` 支持：
  - `--view <width>x<height>`
  - `--view <width>_<height>`
  - `--preset desktop|ipad|iphone`

## 当前没有的东西

不要把这些当成已经存在：

- 自动选择唯一 live session
- `session use`
- 多 session 隐式切换
- 默认 artifact run 目录
- HAR / perf / video / screencast 管理
- 项目层 session log / diagnostics cache
- 完整 request/response wait 语义

## 当前已知限制

- `wait --request/--response/--method/--status` 还没接上
- `session status` 仍然只是 best-effort 视图
- `download` 的稳定验证当前建立在 managed page 内已有下载元素，不把 `file://` 打开本地下载页写成稳定 contract
- `dc-login` 动态登录已接入，但在当前机器上最稳的 DC 2.0 入口仍然是直接打开真实页或复用 profile/state

## 手工验证

本轮已真实执行并通过的最小集合见：

- [.claude/project/08-manual-verification.md](./.claude/project/08-manual-verification.md)

## 文档入口

- 项目真相：[.claude/project/16-project-truth.md](./.claude/project/16-project-truth.md)
- Playwright 能力映射：[.claude/project/03-playwright-capability-mapping.md](./.claude/project/03-playwright-capability-mapping.md)
- runtime state：[.claude/project/05-runtime-state-model.md](./.claude/project/05-runtime-state-model.md)
- plugin / auth：[.claude/project/06-plugin-auth-model.md](./.claude/project/06-plugin-auth-model.md)
- artifact / diagnostics：[.claude/project/07-artifacts-diagnostics.md](./.claude/project/07-artifacts-diagnostics.md)
- borrowing rules：[.claude/project/17-borrowing-rules.md](./.claude/project/17-borrowing-rules.md)

# Project Truth

更新时间：2026-04-26  
状态：active

## 项目定位

`pwcli` 当前是一个面向 Agent 的 Playwright 命令壳。

核心目标：

1. 提供严格可控的浏览器生命周期主链
2. 把 Playwright 常用能力压成低心智 CLI
3. 提供稳定 JSON 输出、plugin、skill、最薄项目层编排

## 当前最可信的三条闭环

### 1. 探索闭环

```text
pw session create <name> --open <url>
pw snapshot --session <name>
pw page current|list|frames --session <name>
pw read-text --session <name>
```

### 2. 执行诊断闭环

```text
pw click|fill|type|press|scroll|wait ... --session <name>
pw console --session <name>
pw network --session <name>
pw errors recent --session <name>
pw observe status --session <name>
```

### 3. 接管复用闭环

```text
pw session attach <name> ...
pw state save|load --session <name>
pw auth <plugin> --session <name>
pw profile open <path> <url> --session <name>
```

## 当前 session 真相

- 多个 managed sessions 可以并存
- 浏览器相关命令显式带 `--session <name>`
- CLI 不自动挑选唯一 live session
- `SESSION_REQUIRED` 是稳定错误语义
- session 名最长 `16` 个字符
- session 名只允许字母、数字、`-`、`_`

唯一推荐生命周期入口：

```text
pw session create <name> --open <url>
pw session attach <name> ...
pw session recreate <name> ...
```

## 当前源码结构

```text
src/
  app/
    commands/
    batch/
    output.ts
  domain/
    session/
    workspace/
    interaction/
    identity-state/
    diagnostics/
    bootstrap/
  infra/
    playwright/
    plugins/
    fs/
```

责任边界：

- `app`：CLI、batch、输出
- `domain`：按领域编排
- `infra`：Playwright substrate、plugin/fs、解析适配

## 当前 shipped command surface

### 生命周期

```text
session create|attach|recreate|list|status|close
```

### 页面读取

```text
open
page current|list|frames|dialogs
snapshot
screenshot
read-text
observe status
```

### 动作与等待

```text
click
fill
type
press
scroll
upload
download
drag
resize
wait
```

### 诊断

```text
console
network
errors recent|clear
route add|remove
trace start|stop
har start|stop
doctor
```

### 状态复用

```text
state save|load
cookies list|set
storage local|session
profile inspect|open
environment offline|geolocation|permissions|clock
```

### 扩展与分发

```text
code
auth
bootstrap apply
batch
plugin list|path
skill path|install
```

## 当前输出 contract

所有命令走 JSON stdout。

成功：

- `ok: true`
- `command`
- `data`
- 按需返回 `session`
- 按需返回 `page`
- 按需返回 `diagnostics`

失败：

- `ok: false`
- `command`
- `error.code`
- `error.message`
- `error.retryable`
- `error.suggestions`

## 当前项目层负责的事情

- 命令语义收口
- named session 路由
- JSON 输出整形
- 最近 diagnostics 记录读取
- page summary / AI snapshot 解析
- 本地 auth plugin 发现与执行
- packaged skill / plugin 分发

## 当前项目层不负责的事情

- 自建浏览器后端
- 自建 daemon 协议
- 自建页面 ref 协议
- 自建 artifact 平台
- 自建 diagnostics cache 系统
- 自动 session fallback

## 当前已知限制

- `session status` 是 best-effort 视图
- `page dialogs` 是事件投影
- modal state 会阻断当前 `browser_run_code` 路径；当前统一收口成 `MODAL_STATE_BLOCKED`
- `session attach --browser-url/--cdp` 依赖本地 attach bridge registry
- `storage local|session` 只读当前页 origin；无效 origin 返回 `accessible: false`
- `console` / `network` 返回最近记录与过滤结果；事件流服务未落地
- `har start|stop` 当前暴露 substrate 边界，热录制未稳定
- 当前只有最小 `.pwcli/runs/<runId>/events.jsonl`

## 文档口径

后续文档必须满足：

- 以 `src/app/commands/*` 和 `dist/cli.js --help` 为准
- 只写已落地命令和已落地 flag
- 只写已验证或已在源码中实现的行为
- skill 文档和 README 视为 shipped agent contract
- 不再把已删除命令写进 shipped contract

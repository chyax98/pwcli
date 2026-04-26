# Command Surface

更新时间：2026-04-26  
状态：active

## 目标

定义当前 shipped command surface。只记录已落地命令、已落地 flag、已落地错误语义。

## 总原则

- agent-only
- strict session-first
- 输出优先机器稳定消费
- 命令名优先直接动作或稳定名词
- 新自动化脚本优先唯一主路径

## 全局规则

- 浏览器相关命令默认要求 `--session <name>`
- session 名最长 `16` 个字符
- 允许字符：字母、数字、`-`、`_`
- 成功输出 `ok: true`
- 失败输出 `ok: false`
- 裸命令缺 session 返回 `SESSION_REQUIRED`

## 当前 shipped 命令

### 生命周期

- `session list`
- `session create <name>`
- `session attach <name> [endpoint]`
- `session recreate <name>`
- `session status <name>`
- `session close <name>`

### 页面读取

- `open <url> --session <name>`
- `page current --session <name>`
- `page list --session <name>`
- `page frames --session <name>`
- `page dialogs --session <name>`
- `snapshot --session <name>`
- `screenshot [ref] --session <name>`
- `read-text --session <name>`
- `observe status --session <name>`

### 动作与等待

- `click [ref] --session <name>`
- `fill [parts...] --session <name>`
- `type [parts...] --session <name>`
- `press <key> --session <name>`
- `scroll <direction> [distance] --session <name>`
- `upload [parts...] --session <name>`
- `download [ref] --session <name>`
- `drag [parts...] --session <name>`
- `resize --session <name>`
- `wait [target] --session <name>`

### 诊断

- `console --session <name>`
- `network --session <name>`
- `errors recent --session <name>`
- `errors clear --session <name>`
- `route add <pattern> --session <name>`
- `route remove [pattern] --session <name>`
- `trace start|stop --session <name>`
- `har start|stop --session <name>`
- `doctor [--session <name>]`

### 状态复用

- `state save [file] --session <name>`
- `state load <file> --session <name>`
- `cookies list --session <name>`
- `cookies set --session <name>`
- `storage local --session <name>`
- `storage session --session <name>`
- `profile inspect <path>`
- `profile open <path> <url> --session <name>`
- `environment offline|geolocation|permissions|clock --session <name>`

### 扩展与分发

- `code [source] --session <name>`
- `auth [plugin] --session <name>`
- `bootstrap apply --session <name>`
- `batch --session <name> --json|--file`
- `plugin list`
- `plugin path <name>`
- `skill path`
- `skill install <dir>`

## 当前推荐主路径

### 生命周期

- 创建：`session create`
- 接管：`session attach`
- 重建：`session recreate`
- 关闭：`session close`

### 诊断

- 常规状态：`observe status`
- 控制台：`console`
- 网络：`network`
- 页面错误：`errors recent`
- 深层探测：`doctor`

### 认证和状态

- 可复用状态文件：`state save|load`
- 本地插件登录：`auth`
- live bootstrap：`bootstrap apply`

## 明确不写进当前命令面的项

- `session use`
- 自动选择唯一 live session
- tab 写操作
- observe stream
- raw CDP global substrate
- artifact index/search
- HAR 热录制平台
- perf / video / screencast 管理

## 当前 surface 的关键限制

- `page dialogs` 是事件投影
- modal state 会阻断当前读路径
- `session attach --browser-url/--cdp` 依赖 attach bridge registry
- `har` 当前暴露 substrate 边界，热录制未稳定
- `batch` 当前输入是 JSON argv 数组

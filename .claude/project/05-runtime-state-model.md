# Runtime State Model

更新时间：2026-04-26
状态：active

当前 `pwcli` 的 runtime truth 已经切成 **strict session-first**。

## 1. Session truth

- 多个 managed sessions 可以并存
- 主路径必须显式带 `--session <name>`
- CLI 不再自动落到唯一 live session
- 裸命令统一报 `SESSION_REQUIRED`

当前用户可见 session 面：

- `pw session create <name> ...`
- `pw session list`
- `pw session status <name>`
- `pw session close <name>`
- `pw session recreate <name> --headed|--headless`

当前没有：

- `session use`
- 隐式当前绑定态
- 自动 single-session fallback

## 2. 命令如何拿到 session

所有浏览器相关命令都按这个规则：

1. 解析 `--session <name>` 或 `-s <name>`
2. 没有就直接报 `SESSION_REQUIRED`
3. usage 命令命中不存在的 session 报 `SESSION_NOT_FOUND`
4. 只有 `session create` 负责建立新的 session

## 3. Acquisition truth

当前 acquisition 命令：

- `session create <name> --open <url>`
- `session attach <name> --ws-endpoint <url>`
- `session attach <name> --browser-url <url>`
- `session attach <name> --cdp <port>`
- `open <url> --session <name>`
- `connect ... --session <name>`
- `auth ... --session <name>`
- `profile open ... --session <name>`

项目叙事上，唯一推荐入口是：

```text
session create <name> --open <url>
```

其他 acquisition 命令仍然存在，但都要求显式 `--session`。

`session recreate` 的真实语义：

- 保留 session 名
- best-effort 保留当前 URL 与 storage state
- 重建有头/无头形态
- 不是在同一个 browser process 上原地切换

## 4. Page truth

当前没有项目层持久 page registry。page truth 当前来自 session 内 projection：

- `observe status` 是当前最完整的 workspace projection
- `page current/list/frames/dialogs` 现在都复用同一套 projection
- `pageId` / `navigationId` 是 session 内稳定投影，不承诺跨 session 稳定
- `dialogs` 当前是事件投影，不是 authoritative live set

这意味着：

- page truth 是 session 内的命令级快照
- 还没有 tab 写操作 contract
- modal state 仍然会阻断 `browser_run_code` 路径

## 5. Profile / state / auth 的边界

- `profile`：本地 profile 检查与 persistent open 入口
- `state`：显式 `storageState` 文件 save/load
- `auth`：在指定 session 的 page 上执行本地插件函数

它们都不是另一套 runtime。

## 6. Connect 的真实语义

`connect` 当前只是 `session attach` 的兼容壳：

- `connect [endpoint] --session <name>`
- `connect --ws-endpoint <url> --session <name>`
- `connect --browser-url <url> --session <name>`
- `connect --cdp <port> --session <name>`

实现上：

- 命中显式 session 名
- 先解析成最终 attach source
- 通过 endpoint 附着
- 立刻跑一次 `snapshot` 探测当前页是否可读
- 输出里会带 `compatibilityAlias: "session attach"`

`session attach` 当前支持三类来源：

- `--ws-endpoint <url>`：直接 attach
- `--browser-url <url>`：先读 CDP `/json/version`，再通过本地 attach bridge registry 解析成 Playwright `wsEndpoint`
- `--cdp <port>`：解析成 `http://127.0.0.1:<port>` 后走同一条 browser-url 路径

## 7. 当前输出模型

大多数命令输出统一为：

```json
{
  "ok": true,
  "command": "xxx",
  "session": { "...": "..." },
  "page": { "...": "..." },
  "data": {
    "...": "...",
    "resolvedSession": "bug-a"
  }
}
```

`resolvedSession` 是这轮新增的关键字段，用来把最终命中的 session 明确写回输出。

## 8. 当前观察到的限制

- `session status` 仍然是 best-effort liveness 视图，不是强一致 truth
- `wait --request/--response/--method/--status` 已实现
- `--browser-url` / `--cdp` 当前依赖本地 attach bridge registry，不能通用于任意只暴露 raw CDP 的外部浏览器
- `storage local/session` 只对当前页 origin 有意义
- `cookies set` 当前只做最小 `name/value/domain/path` 写入
- 项目层仍然没有 artifact run dir truth / session log index / diagnostics cache

## 9. 当前没有的 state

以下内容现在都不存在，文档不要写成已经有：

- 自动路由到唯一 live session
- `session use`
- 自建 page ref 协议
- profile/state/session 三者之间的高级绑定关系
- 多 session 的自动上下文切换

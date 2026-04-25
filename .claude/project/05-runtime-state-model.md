# Runtime State Model

更新时间：2026-04-25
状态：active

当前 `pwcli` 没有自建一套复杂 runtime state。现状更接近：

```text
default managed session
  -> current page summary
  -> 当前命令返回的 data
```

## 1. Session truth

当前只有一条默认 managed session 线：

- session 名固定走 `default`
- session substrate 直接复用 `playwright-core/lib/tools/cli-client/session.js`
- registry truth 直接复用 `playwright-core/lib/tools/cli-client/registry.js`
- 用户可见 session 面只有：
  - `pw session status`
  - `pw session close`

当前没有：

- 多 session 命令路由
- 显式 session create/switch/list
- 自定义 daemon 协议
- 项目层 session store

## 2. 命令如何拿到 session

- `open` / `connect` / `profile open`：显式 `reset: true`
- 其他命令：按需 `ensureManagedSession()`，默认继续使用 `default`
- `batch`：串行调用当前 managed helpers，仍然只打向 `default`

当前推荐入口仍然是：

```text
open -> wait/snapshot/read-text -> action
```

原因很实际：这条链在这轮手工 smoke 里最稳定。

## 3. Page truth

当前没有项目层持久 page registry。page truth 来自每次命令执行后的即时结果：

- `parsePageSummary(result.text)` 解析 CLI 输出里的 `### Page`
- `page current/list/frames` 用 `pw code` 现查现返
- `page current/list` 里的 `p1`、`activePageId` 是当前命令构造的结构化别名，不是全局 page id 系统

这意味着：

- page truth 是命令级快照
- 不存在跨命令稳定 page identity contract

## 4. Profile / state / auth 的边界

- `profile`：本地 profile 目录检查与 persistent open 入口
- `state`：显式 `storageState` 文件 save/load
- `auth`：在当前 page 上执行本地插件函数

它们都不是另一套 runtime。

## 5. Connect 的真实语义

`connect` 当前只是 session acquisition 的另一种来源：

- `connect [endpoint]`
- `connect --ws-endpoint <url>`
- `connect --browser-url <url>`
- `connect --cdp <port>`

实现上：

- reset `default` managed session
- 通过 endpoint 附着
- 立刻跑一次 `snapshot` 探测当前页是否可读

## 6. 当前输出模型

大多数命令输出统一为：

```json
{
  "ok": true,
  "command": "xxx",
  "session": { "...": "..." },
  "page": { "...": "..." },
  "data": { "...": "..." }
}
```

但不是每个字段都必有：

- `session` 可省略
- `page` 可省略
- `diagnostics` 当前几乎不用

## 7. 当前观察到的限制

这轮手工 smoke 里已观察到：

- `session status` 经常返回 `{ active: false }`，即使前一个 `open` 刚刚成功
- 某些 `pw code` / selector 动作链后续会遇到 `Target page, context or browser has been closed`

所以当前 `session status` 只能当 best-effort registry 视图，不能当强一致 liveness truth。

## 8. 当前没有的 state

以下内容现在都不存在，文档不要写成已经有：

- artifact run dir truth
- session log index
- console/network 项目层持久缓存
- 自建 page ref 协议
- profile/state/session 三者之间的高级绑定关系

# Runtime State Model

更新时间：2026-04-25
状态：draft

需要定义清楚：
- current session truth
- current page truth
- profile / state / session 的边界
- connect 后的 truth
- artifact run 目录
- diagnostics cache 生命周期

## 基本实体

### session

含义：
- 一个可复用的浏览器工作上下文。

当前承接方式：
- managed session 复用 `cli-client/session.js` 与 `registry.js`
- 项目层不再自写一套主 session/daemon 协议

最小字段：
- `name`
- `kind`: `ephemeral | named | connected`
- `browserMode`
- `profileId?`
- `statePath?`
- `artifactRunDir`

### current page

含义：
- 当前 session 下默认接收命令的 page。

最小字段：
- `pageId`
- `url`
- `title`
- `selectedAt`

### profile

含义：
- 一个可长期复用的浏览器身份或用户数据目录。

### state

含义：
- 一个显式的 `storageState` 文件。

## truth 原则

- 每个时刻只有一个 current session truth。
- 每个 session 只有一个 current page truth。
- `profile` 不是 `session`。
- `state` 不是 `session`。
- `connect` 不是另一套 runtime，它只是 session acquisition 的一种。

## session substrate 原则

- managed session：优先建立在 Playwright CLI 内部 session/registry substrate 上
- ephemeral 单次命令：直接使用 Playwright runtime
- `batch`：默认共享同一单进程 runtime session
- daemon：采用官方 CLI 的 detached + socket + registry 模式

## 路由原则

- 不允许隐式粘滞路由。
- 命令如果命中 named session，要在结果里显式返回 session truth。
- 需要 current page 变化时，结果里必须返回 page truth。

## artifact run 目录

建议形态：

```text
.pwcli/artifacts/<runId>/
```

包含：
- `session-log.jsonl`
- `trace.zip`
- `screenshot-*.png`
- 其他 artifact

## diagnostics cache

最小缓存：
- recent console messages
- recent network events

作用：
- 动作后 diagnostics summary
- 命令级查询
- 搜索与关联

禁止：
- 隐式粘滞路由
- 多套 page truth
- process.env 充当长期公共 API

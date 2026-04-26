# Artifacts And Diagnostics

更新时间：2026-04-26
状态：active

当前 `pwcli` 的 artifact / diagnostics 还是薄层。真相只有已经落地的这部分。

## 1. 当前真实 artifact

已落地：

- `screenshot --path <file>`
- `download --path <file>`
- `state save <file>`
- `trace start`
- `trace stop`
- `skill install <dir>`
- 最小 `.pwcli/runs/<runId>/events.jsonl`

当前行为：

- 动作命令当前会建立最小 run 目录，并把 step 级事件写入 `events.jsonl`
- `screenshot` 没传 `--path` 时会默认写到当前 command run dir
- `download` 没传 `--path/--dir` 时会默认复制到当前 command run dir
- `trace start/stop` 当前只暴露动作结果，没有稳定的 trace 文件路径输出
- `state save/load` 完全由用户显式路径驱动

## 2. 当前 diagnostics

### console

`pw console --session <name>` 当前输出：

```json
{
  "summary": {
    "total": 0,
    "errors": 0,
    "warnings": 0,
    "sample": []
  }
}
```

它来自当前 session `BrowserContext` 上挂的结构化 `consoleRecords[]`，记录至少包含：

- `kind`
- `sessionName`
- `timestamp`
- `pageId`
- `navigationId`
- `level`
- `text`

当前支持的查询面：

- `--level`
- `--text`
- `--limit`

### network

`pw network --session <name>` 当前输出：

```json
{
  "summary": {
    "total": 0,
    "sample": []
  }
}
```

它来自当前 session `BrowserContext` 上挂的结构化 `networkRecords[]`，记录至少包含：

- `kind`
- `sessionName`
- `timestamp`
- `requestId`
- `pageId`
- `navigationId`
- `url`
- `method`
- `resourceType`
- `status` / `ok` / `failureText`
- `frame`

当前支持的查询面：

- `--request-id`
- `--url`
- `--kind`
- `--method`
- `--status`
- `--resource-type`
- `--text`
- `--limit`

### errors

`pw errors recent --session <name>` 当前输出：

- `summary.total`
- `summary.visible`
- `summary.clearedCount`
- `errors[]`，字段包括 `name` / `message` / `stack`

来源是当前 session `BrowserContext` 上挂的结构化 `pageErrorRecords[]`，记录至少包含：

- `kind`
- `sessionName`
- `timestamp`
- `pageId`
- `navigationId`
- `text`
- `stack`

当前支持的查询面：

- `--text`
- `--limit`

`pw errors clear --session <name>` 只是把当前 page error 数量记为本 session 的 clear baseline。

### action diagnostics delta

当前动作命令会把最近诊断增量直接带回输出：

- `click`
- `fill`
- `type`
- `press`
- `scroll`
- `upload`
- `download`
- `drag`
- `wait`

当前 `data.diagnosticsDelta` 至少包含：

- `consoleDelta`
- `networkDelta`
- `pageErrorDelta`
- `lastConsole`
- `lastNetwork`
- `lastPageError`

### route

`pw route add/remove --session <name>` 当前行为：

- 直接调用当前 `BrowserContext` 的 public API `route / unroute / unrouteAll`
- 项目层只在 context 上挂最小 metadata，供 `observe status` 回显
- 当前支持：
  - `list`
  - `add <pattern> --abort`
  - `add <pattern> --method <method>`
  - `add <pattern> --body <text> | --body-file <path>`
  - `add <pattern> --headers-file <path>`
  - `load <file>`
  - `remove [pattern]`

### diagnostics

`pw diagnostics ...` 当前支持：

- `export --session <name> --out <file>`
- `runs`
- `show --run <runId>`
- `grep --run <runId> --text <substring>`

### observe

`pw observe status --session <name>` 当前输出的是 workspace-aware status，不是 stream server：

- 当前 page URL / title / `pageId` / `navigationId`
- workspace pages projection
- console summary
- network summary
- route metadata
- recent dialog metadata
- page error summary
- trace metadata
- har limitation status
- bootstrap metadata
- stream limitation status

`page dialogs` 和 `observe status.data.dialogs` 当前用的是同一套 dialog event projection。

明确边界：

- 这不是 authoritative live dialog set
- modal state 仍会阻断当前 managed-session 的 run-code 路径

`observe stream` 当前没有实现。

### doctor

`pw doctor` 当前是只读诊断聚合，至少覆盖：

- session substrate / named session probe
- observe status probe
- plugin resolution
- profile path inspect
- state path inspect
- endpoint reachability
- modal-blocked workspace probe

它当前不会：

- 自动修复
- 清理 session
- 重置 bootstrap
- 直接恢复 modal state

它不会修改任何 session、profile、state 或 plugin。

## 3. 当前没有的 artifact / diagnostics

以下都不要再写成现有能力：

- 默认 `.pwcli/artifacts/<runId>/`
- `session-log.jsonl`
- HAR 自动落盘
- perf 产物
- video / screencast
- artifact index / search
- 动作后自动附带 console/network diagnostics
- observe stream server
- 运行中 HAR start/stop substrate

## 4. 当前实现边界

当前项目层做的事只有：

- 把 CLI / Playwright 输出转成更稳一点的 JSON
- 把 session 内 diagnostics 挂成结构化 records
- 把部分结果整理成 `summary`
- 把动作后的 diagnostics delta 收口回结果
- 在少数命令里回传路径、URL、文件名
- 建立最小 run dir 并追加 `events.jsonl`
- 在当前 page/context 对象上挂最小 diagnostics metadata

当前项目层没做：

- 可检索 artifact 管理
- 跨命令 run 关联
- 诊断面默认开启与默认采样
- 新的 diagnostics runtime

## 4.1 Bootstrap ownership

当前 `bootstrap apply` 只认这两类 live 操作：

- `--init-script <file>`
- `--headers-file <file>`

当前没有：

- `bootstrap apply --state`
- `bootstrap apply --route-file`

原因很简单：

- `state` 属于 acquisition-time state
- route 当前仍然通过独立 `route add/remove` 暴露
- 这两类东西还没有稳定到需要揉进 bootstrap contract

## 5. 文档口径

当前 README 和 project docs 只能说：

- 支持显式截图、显式下载、显式 state save/load、trace start/stop
- 支持最小 `.pwcli/runs/<runId>/events.jsonl`
- `console` / `network` 提供结构化摘要，底层来自 session 内 records
- `errors` 提供结构化 page error 列表与 clear baseline
- 动作命令会回传 `diagnosticsDelta`
- `route` 提供最小 add/remove 命令面
- `observe` 当前只提供 `status`，但已带 workspace / bootstrap / diagnostics summary
- `doctor` 当前能识别 modal-blocked workspace
- `har` 当前只会明确返回 limitation，不会真的热启动录制
- `network` 当前支持 detail/filter 查询，但仍然是当前 session 内 records，不是持久化查询系统

不能说：

- 默认会记录整次运行生命周期
- 默认会落盘所有诊断证据
- 已有完整 artifact run 目录模型
- 已有运行中 HAR 录制 start/stop
- 已有 observe stream server

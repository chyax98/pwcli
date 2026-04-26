# Use Cases And Capabilities

更新时间：2026-04-25
状态：draft

## Use Case 1：页面勘察

目标：
- 打开页面后，快速知道当前 URL、title、tab、frame、dialog、可操作目标。

需要的能力：
- `open`
- `page current/list/frames/dialogs`
- `snapshot`
- `read-text`

实现归属：
- Playwright 原生负责页面对象与 frame/dialog 信息。
- 项目层负责快照整形、结果收口、artifact 落盘。

## Use Case 2：稳定执行页面动作

目标：
- click、fill、type、press、scroll、upload、download、drag、wait。

需要的能力：
- `click`
- `fill`
- `type`
- `press`
- `scroll`
- `upload`
- `download`
- `drag`
- `wait`

实现归属：
- 动作执行默认走 Playwright locator/page/context 原生 API。
- 项目层负责命令面、参数整形、错误包装、动作后 diagnostics。

## Use Case 3：复杂场景直接执行代码

目标：
- 处理 popup、iframe、bootstrap、复杂登录、组合动作、特权流程。

需要的能力：
- 一个一级命令，直接运行 Playwright code
- 支持 inline 和 file
- 在 current session/current page 上下文里执行

实现归属：
- Playwright 原生提供 `page/context/browser`。
- 项目层负责命令入口、返回值封装、日志、artifact 关联。

硬要求：
- 这是一级能力。
- 不能再被降成“前置步骤”或“补洞机制”。

## Use Case 4：登录并长期复用

目标：
- 一次登录，后续复用。

需要的能力：
- `auth`
- `state`
- `profile`
- `session`
- 项目登录插件

实现归属：
- Playwright 原生负责 `storageState`、persistent profile、context。
- 项目层负责复用策略。
- 项目接入层负责登录流程。

建议：
- 登录优先插件化。
- 插件数量控制在少量高价值项目。
- 插件只做登录与必要 bootstrap，不承载通用动作模型。

## Use Case 5：接入已有浏览器

目标：
- 接入已经打开的 Chrome / Chromium / profile，继续操作和诊断。

需要的能力：
- `connect`
- `page current/list`
- 后续所有常规命令可复用当前连接

实现归属：
- Playwright 原生负责 CDP / browser endpoint 接入。
- 项目层负责 route truth、session truth、artifact truth。

## Use Case 6：动作后即时诊断

目标：
- 动作执行后，不再额外跑多条命令才能知道 console error、warning、接口报错。

需要的能力：
- console recent capture
- network recent capture
- action 后 diagnostics summary

实现归属：
- Playwright 原生负责 console/request/response 事件采集。
- 项目层负责事件缓存、错误筛选、结果回传。

## Use Case 7：证据与回溯

目标：
- 出问题时快速拿到足够的证据。

需要的能力：
- `screenshot`
- `trace`
- `har`
- `perf`
- `screencast`
- `session log`

实现归属：
- Playwright 原生负责 trace/screenshot/video/HAR 能力。
- 项目层负责 artifact 命名、落盘、run 关联、索引。

## Use Case 8：日志与证据检索

目标：
- 从 session log、trace、console、network、snapshot、artifact 中快速搜索内容。

需要的能力：
- 文本搜索
- 命令名搜索
- URL / status / error 搜索
- 运行链路关联

实现归属：
- 这是项目层能力。
- 允许自研检索逻辑。

## Use Case 9：环境控制

目标：
- 用 mock/inject/offline/geolocation/permissions/clock 复现边界条件。

需要的能力：
- `mock`
- `inject`
- `offline`
- `geolocation`
- `permissions`
- `clock`

实现归属：
- 优先复用 Playwright 原生 route/context API。
- 只有明确的空白点才允许极薄补层。

## Use Case 10：Agent 可用性

目标：
- Agent 拿到工具后，能立即知道怎么用。

需要的能力：
- `skill path`
- `skill install <dir>`
- 精炼 skill 文档
- 稳定命令 contract

实现归属：
- 这是项目的一等公民能力。
- 发版时必须验证 skill path/install。

## 功能分层清单

必须保留：
- `open`
- `connect`
- `session`
- `profile`
- `state`
- `snapshot`
- `page`
- `read-text`
- `click/fill/type/press/scroll/wait/upload/download/drag`
- 直接执行 Playwright 代码
- `console`
- `network`
- `trace`
- `screenshot`
- `har`
- `perf`
- `mock`
- `inject`
- `offline`
- `geolocation`
- `permissions`
- `clock`
- `auth`
- `plugin`
- `skill`

应降级为辅助诊断：
- `a11y`

应重新评估命令面是否需要独立保留：
- `codegen`
- `screencast`
- 某些强依赖内部实现的 evidence 命令

## 明确禁止

- 自建默认元素定位系统。
- 自建默认 click/fill/type/drag 执行 substrate。
- 把 Playwright 内部私有模块当成主流程稳定依赖。
- 让登录插件长成通用业务逻辑框架。
- 让 skill 和项目规范漂移。


# Playwright Core Notes

更新时间：2026-04-25
状态：draft

## 目标

这份文档回答三件事：

1. Playwright Core 的核心是什么？
2. 它的核心能力是什么？
3. `pwcli` 应该怎么使用这些能力？

## Playwright Core 的本质

Playwright Core 不是“浏览器脚本集合”，而是一套浏览器自动化 runtime。

它最核心的公共对象就是：
- `BrowserType`
- `Browser`
- `BrowserContext`
- `Page`
- `Locator`

这五类对象已经覆盖了大部分浏览器自动化主路径。

## 核心能力

### 1. Browser Lifecycle

能力：
- 启动浏览器
- 连接浏览器
- 关闭浏览器

常用入口：
- `chromium.launch()`
- `chromium.launchPersistentContext()`
- `chromium.connectOverCDP()`

`pwcli` 怎么用：
- 用它承担 `open/connect/profile` 的底座。
- 项目层只负责 session truth 和命令 contract。

### 2. BrowserContext

能力：
- 多 page 共享环境
- cookies / storage / permissions / route / geolocation / clock
- tracing / storageState

为什么重要：
- `BrowserContext` 是 session/profile/state 的基础对象。

`pwcli` 怎么用：
- 所有 session/profile/state 逻辑都应围绕 `BrowserContext` 设计。
- 不要在项目层重新发明第二套环境模型。

### 3. Page

能力：
- 导航
- 页面级脚本执行
- 事件订阅
- 截图
- 对话框
- 下载
- frames

`pwcli` 怎么用：
- `open`
- `page current/list`
- `read-text`
- `console/network`
- `screenshot`
- `code`

### 4. Locator

能力：
- 元素定位
- 元素动作
- 自动等待
- actionability
- frame 中元素处理

常见 API：
- `page.locator()`
- `page.getByRole()`
- `page.getByText()`
- `page.getByLabel()`
- `page.getByPlaceholder()`
- `page.getByTestId()`

`pwcli` 怎么用：
- 所有默认动作都优先走 locator。
- 不要自建默认元素定位系统。
- 不要默认走 `backendDOMNodeId` + CDP action。

### 5. Script Execution

能力：
- `page.evaluate()`
- `locator.evaluate()`
- 直接运行 Playwright code

`pwcli` 怎么用：
- 这是一级能力。
- `pw code` 必须长期存在。
- 当命令面不够时，优先建议用这条路径。

### 6. Event System

能力：
- console
- request / response / requestfailed
- dialog
- download
- popup

`pwcli` 怎么用：
- 用这些事件组织 diagnostics。
- 动作后默认回传摘要。
- 详细记录写入 session log / artifact run 目录。

### 7. State Reuse

能力：
- `context.storageState()`
- persistent context / user data dir

`pwcli` 怎么用：
- 用于 `state/profile/auth`。
- 登录复用必须优先走这些原生能力。

### 8. Tracing / Artifacts

能力：
- `context.tracing`
- `page.screenshot()`
- 视频与其他 artifact

`pwcli` 怎么用：
- 项目层只做命令编排、路径管理、结果返回。
- 不在项目层重写 tracing 逻辑。

### 9. Network Control

能力：
- `context.route()`
- mock / abort / fulfill / continue

`pwcli` 怎么用：
- mock/inject/offline 等能力优先围绕这些原生能力展开。
- 只有明确空白点才补薄层。

## 使用原则

### 原则 1：默认使用公共 API

只有在公共 API 无法覆盖时，才允许进一步评估私有层。

### 原则 2：先组合，再补层

先尝试：
- Playwright 公共 API 直接用
- `pw code`
- 项目命令组合

之后才考虑补口。

### 原则 3：项目层只做编排

项目层要做的是：
- 命令路由
- 状态 truth
- diagnostics 汇总
- artifact 管理
- 登录插件
- skill 分发

项目层不该做的是：
- 第二套 locator
- 第二套 action engine
- 第二套 frame engine

## 当前结论

`pwcli` 未来的大部分能力，都应该是：

**Playwright Core 公共 API + 项目层薄编排**

这份文档后续要继续补：
- 每个命令对应的公共 API
- 哪些地方有真正空白点
- 哪些内部 API 如果必须依赖，为什么必须依赖

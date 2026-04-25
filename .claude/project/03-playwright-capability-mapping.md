# Playwright Capability Mapping

更新时间：2026-04-25
状态：draft

目标：
- 把每个 `pwcli` 功能映射到 Playwright Core 公共 API。
- 禁止在没有充分理由时重写上游原语。

## 映射原则

- 默认只使用 Playwright Core 公共 API。
- 先证明公共 API 不够，再讨论项目私有层。
- 先证明 `pw code` 不够，再讨论更高层命令。

## 页面探索

| 能力 | Playwright Core 公共 API | 项目层职责 |
|------|--------------------------|------------|
| open | `browserType.launch*` / `context.newPage()` / `page.goto()` | session 选择、输出 contract、artifact run 目录 |
| page current/list | `context.pages()` / `page.url()` / `page.title()` | current page truth、结构化返回 |
| frames | `page.frames()` | 信息整形 |
| dialogs | `page.on('dialog')` | 缓存、查询输出 |
| read-text | `locator.textContent()` / `locator.innerText()` / `page.evaluate()` | CLI 参数与错误包装 |
| snapshot | `page.ariaSnapshot({ mode: "ai" })` | agent-friendly 视图整形、输出裁剪 |

## 动作执行

| 能力 | Playwright Core 公共 API | 项目层职责 |
|------|--------------------------|------------|
| click | `page.locator('aria-ref=...').click()` / semantic locator | 参数解析、动作后 diagnostics |
| fill | `page.locator('aria-ref=...').fill()` / `selectOption()` / semantic locator | 参数解析、错误收口 |
| type | `page.locator('aria-ref=...').type()` / `page.keyboard.type()` / semantic locator | 参数解析、错误收口 |
| press | `page.keyboard.press()` | 参数解析 |
| scroll | `locator.evaluate()` / `mouse.wheel()` / `page.evaluate()` | 统一命令面 |
| drag | `locator.dragTo()` | 参数解析 |
| upload | `locator.setInputFiles()` / filechooser | 参数解析 |
| download | `page.waitForEvent('download')` | artifact 落盘 |
| wait | `locator.waitFor()` / `page.waitForLoadState()` / `page.waitForURL()` / `page.waitForFunction()` | 统一命令面 |

## 直接执行代码

| 能力 | Playwright Core 公共 API | 项目层职责 |
|------|--------------------------|------------|
| `pw code` | `page` / `context` / `browser` 全量暴露 | 命令入口、日志、结果包装、artifact 关联 |

## 诊断与证据

| 能力 | Playwright Core 公共 API | 项目层职责 |
|------|--------------------------|------------|
| console | `page.on('console')` | recent cache、error/warning 过滤、动作后默认回传 |
| network | `page.on('request')` / `response` / `requestfailed` | recent cache、4xx/5xx 过滤、动作后默认回传 |
| trace | `context.tracing` | 启停、路径管理、run 关联 |
| screenshot | `page.screenshot()` / `locator.screenshot()` | 路径管理、artifact 记录 |
| har | Playwright `recordHar` 能力 | 路径管理、命令面组织 |
| video/screencast | Playwright video / screenshot primitives | 仅在公共 API 明确可用时接入 |
| perf | 仅在 Playwright 公共能力不够时再评估 | 先不默认自研 |

## session / profile / state / connect

| 能力 | Playwright Core 公共 API | 项目层职责 |
|------|--------------------------|------------|
| session | `lib/tools/cli-client/session.js` + `registry.js` + browser/context/page 生命周期 | route truth、state truth、artifact truth |
| profile | persistent context / userDataDir | profile 命名与复用策略 |
| state | `context.storageState()` | 存取路径、命令 contract |
| connect | `chromium.connectOverCDP()` / browser endpoint | current page 选择、truth 收口 |

## 插件登录

| 能力 | Playwright Core 公共 API | 项目层职责 |
|------|--------------------------|------------|
| auth plugin | `page` / `context` / `storageState` | 插件发现、执行、state/profile 复用 |

## 允许的极少数自研点

- artifact index / search
- diagnostics summary
- session/page/artifact truth
- skill distribution
- 登录插件接入

## 默认禁止

- 自定义元素定位系统
- 自定义动作执行 substrate
- 默认依赖 `backendDOMNodeId`
- 大面积依赖 `playwright-core/lib/...`

## 当前明确采用

- AI snapshot ref：`page.ariaSnapshot({ mode: "ai" })`
- ref action：`page.locator('aria-ref=...')`
- managed session substrate：`playwright-core/lib/tools/cli-client/session.js`
- managed session registry：`playwright-core/lib/tools/cli-client/registry.js`

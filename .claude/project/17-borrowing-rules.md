# Borrowing Rules

更新时间：2026-04-25
状态：active

## 目标

明确告诉后续开发：
- 哪些 Playwright 能力应该直接借
- 哪些内部实现可以直接用
- 哪些东西不能把 `pwcli` 做成另一份 Playwright CLI

## 推荐借用清单

### 直接借用的公共 API

- `page.ariaSnapshot({ mode: "ai" })`
- `page.locator('aria-ref=...')`
- `page.getByRole/getByText/getByLabel/getByPlaceholder/getByTestId`
- `locator.click/fill/type/dragTo/setInputFiles`
- `page.keyboard.press/type`
- `page.waitForLoadState/waitForURL/waitForRequest/waitForResponse/waitForFunction`
- `context.storageState`
- `context.tracing`
- `page.screenshot`
- `context.route`
- `launchPersistentContext`
- `connectOverCDP`

### 直接借用的内部 substrate

- `playwright-core/lib/tools/cli-client/session.js`
- `playwright-core/lib/tools/cli-client/registry.js`

当前原因：
- 内部工具
- 版本锁死
- 用户极少
- 重点是完成工具，不是做上游兼容层

## 条件借用

这些可以参考甚至 vendor，但不能直接成为主产品面：

- `cli-daemon/daemon.ts`
- `cli-client/help.json`
- `tools/backend/runCode.ts`

## 禁止直接借来当主流程

- `program.ts`
- `commands.ts`
- `BrowserBackend` 整套命令 runtime

原因：
- 这会把 `pwcli` 变成另一份 Playwright CLI
- 你会失去自己的命令语义
- 你会回到文本 CLI 包装器，而不是 Agent 工具

## 借用原则

能借底层，就别自己造底层。
能保留自己的命令语义，就别吞上游整套产品面。

## 当前结论

`pwcli` 采用的正确组合是：

- 生命周期 substrate：借 `session.js + registry.js`
- 页面与动作能力：优先公共 API
- 语义命令 / diagnostics / artifact / plugin / skill：自己做薄层

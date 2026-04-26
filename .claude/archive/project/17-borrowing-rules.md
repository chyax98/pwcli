# Borrowing Rules

更新时间：2026-04-25
状态：active

这份规则只服务当前 `pwcli`。目标很明确：借底层，不借上游整套产品面。

## 1. 当前应该直接借的公共 API

- `page.ariaSnapshot({ mode: 'ai' })`
- `page.locator('aria-ref=...')`
- `page.locator(selector)`
- `page.getByRole()`
- `page.getByText()`
- `page.getByLabel()`
- `page.getByPlaceholder()`
- `page.getByTestId()`
- `locator.click()`
- `locator.fill()`
- `locator.type()`
- `locator.dragTo()`
- `locator.setInputFiles()`
- `page.keyboard.type()`
- `page.keyboard.press()`
- `page.mouse.wheel()`
- `page.waitForLoadState()`
- `page.waitForTimeout()`
- `locator.waitFor()`
- `page.waitForEvent('download')`
- `page.screenshot()`
- `locator.screenshot()`
- `context.storageState()`
- `context.tracing`
- `launchPersistentContext`
- `connectOverCDP`

## 2. 当前允许直接借的内部 substrate

- `playwright-core/lib/tools/cli-client/session.js`
- `playwright-core/lib/tools/cli-client/registry.js`

这是当前 managed browser 的正路。

## 3. 当前可以参考，但不要直接变成主流程的东西

- Playwright CLI 其他命令层
- `cli-daemon` 相关实现
- `tools/backend/runCode.ts`
- 任何围绕 `program.ts` / `commands.ts` 的完整产品外壳

原因：

- `pwcli` 需要自己的命令语义
- 当前重点是 Agent 工作流，不是复制官方 CLI

## 4. 当前明确禁止

- 自建第二套 browser backend
- 自建第二套 session registry
- 自建 ref 协议替代 `aria-ref`
- 大面积依赖 `playwright-core/lib/...` 未审查内部模块
- 把上游 CLI 的帮助、命令层、产品结构整包搬进来

## 5. 当前正确组合

```text
session lifecycle     -> session.js + registry.js
page/action/wait      -> Playwright public API
command semantics     -> pwcli 自己的 commands/*
auth plugin           -> 本地文件 + pw code
skill distribution    -> pwcli 自己的 packaged skill
```

## 6. 文档与实现都要守的边界

- 借底层是为了少造轮子
- 保留自己的命令语义是为了保持 agent-first
- 一旦借到上游完整产品面，`pwcli` 就会退化成另一份 Playwright CLI

当前不允许这种漂移。

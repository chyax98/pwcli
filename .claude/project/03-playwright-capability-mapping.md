# Playwright Capability Mapping

更新时间：2026-04-25
状态：active

这份文档只描述当前 `pwcli` 已落地的映射。真相源是当前 `src/`，不是旧 forge-browser 文档，也不是想象中的未来产品面。

## 总原则

- 浏览器生命周期优先复用 Playwright CLI 内部 `cli-client/session.js` + `registry.js`。
- 页面动作、等待、截图、下载优先走 Playwright 公共 API。
- `pwcli` 自己只保留命令语义、输出整形、少量解析和本地插件装配。
- 没有必要时不碰 `playwright-core/lib/...` 其他产品层。

## 当前命令到能力映射

| 命令 | 当前实现 | 上游能力 |
| --- | --- | --- |
| `open <url>` | `managedOpen()` -> `runManagedSessionCommand({ _: ['goto', url] })` | Playwright CLI managed session + `page.goto()` |
| `connect [endpoint]` | reset default session 后直接发 `snapshot` 探测连接是否可用 | Playwright CLI endpoint attach |
| `snapshot` | `runManagedSessionCommand({ _: ['snapshot'] })`，再解析 `### Snapshot` yaml | `page.ariaSnapshot({ mode: 'ai' })` 经 CLI 输出 |
| `code [source]` | `runManagedSessionCommand({ _: ['run-code', source], filename? })`；`--file` 先本地读文件，再把源码内联过去 | Playwright CLI run-code |
| `page current/list/frames` | 通过 `pw code` 取 `page/context.frames()` | `page.url()` `page.title()` `context.pages()` `page.frames()` |
| `read-text` | selector 模式走 `locator.innerText()`；默认读 `document.body.innerText` | `locator.innerText()` `page.evaluate()` |
| `click [ref]` | ref 走 CLI `click`；selector/semantic locator 走 `pw code` | `aria-ref` click / `locator.click()` / `getByRole|getByText|...` |
| `fill` | ref 走 CLI `fill`；selector 走 `pw code` | `aria-ref` fill / `locator.fill()` |
| `type` | 无 ref/selector 时走 CLI `type`；有目标时走 `pw code` | `page.keyboard.type()` / `locator.type()` |
| `press` | CLI `press` | `page.keyboard.press()` |
| `scroll` | `pw code` 内调用 `page.mouse.wheel()` | `page.mouse.wheel()` |
| `wait` | `pw code` 内支持 delay/ref/text/selector/networkidle | `waitForTimeout` `locator.waitFor` `getByText().waitFor` `waitForLoadState('networkidle')` |
| `screenshot` | `pw code` 调 `page.screenshot()` 或 `locator.screenshot()` | `page.screenshot()` `locator.screenshot()` |
| `trace start/stop` | CLI `tracing-start` / `tracing-stop` | `context.tracing` |
| `state save/load` | CLI `state-save` / `state-load` | `context.storageState()` |
| `upload` | `pw code` 调 `locator.setInputFiles()` | `locator.setInputFiles()` |
| `drag` | `pw code` 调 `locator.dragTo()` | `locator.dragTo()` |
| `download` | `pw code` 触发点击；项目层解析 backend `Events` 里的下载日志，再按 `--path/--dir` 复制到目标路径 | Playwright backend download handling + `locator.click()` |
| `console` | CLI `console` 输出，项目层只解析摘要 | Playwright CLI diagnostics |
| `network` | CLI `network` 输出，项目层只解析摘要 | Playwright CLI diagnostics |
| `profile inspect/open` | inspect 是本地路径检查；open 最终还是 `managedOpen(..., { profile, persistent: true })` | persistent context |
| `plugin list/path` | 本地文件系统发现与路径解析 | 无 Playwright 依赖 |
| `auth` | 读取本地插件源码，包装成 `async page => plugin(page, args)` 后交给 `pw code` | `page` + `pw code` |
| `skill path/install` | 本地文件系统复制 packaged skill | 无 Playwright 依赖 |
| `session status/close` | 直接调 `Registry.load()` / `Session(entry)` | `cli-client/session.js` + `registry.js` |

## 当前明确存在的边界

- `wait --request/--response/--method/--status` 已出现在 CLI 帮助里，当前 `managedWait()` 还没有实现这几条路径。文档不能把它写成已稳定支持。
- `console` / `network` 现在只有结构化摘要：
  - `console.summary = { total, errors, warnings, sample[] }`
  - `network.summary = { total, sample[] }`
- `screenshot`、`download`、`state save` 都是显式路径驱动。当前没有默认 artifact run 目录。
- `code --file` 当前实现是本地读文件内容后内联给 `run-code`，不是把文件路径交给另一套自定义执行器。

## 当前允许借用的内部层

- `playwright-core/lib/tools/cli-client/session.js`
- `playwright-core/lib/tools/cli-client/registry.js`

除此之外，当前实现没有把 Playwright CLI 的完整命令层搬进来。

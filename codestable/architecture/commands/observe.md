# pw observe/read

<!-- 命令设计决策文档。使用教程仍以 skills/pwcli/ 为准。 -->

## 是什么

一句话：观察命令族读取当前 session 的页面事实、结构、文本和视觉证据，不执行业务动作。

## 为什么存在

Agent 需要在每一步行动前后低噪声确认页面状态。这个命令族把“我在哪、页面有什么、可交互结构是什么、证据如何保存”分成多个只读入口，避免默认倾倒全量 DOM 或直接进入动作规划。

主链是 `status/observe` 看 workspace 摘要，`read-text` 看可见文本，`locate` 或 `snapshot -i` 缩小目标，必要时用 `screenshot/pdf/accessibility` 留证据。`page` 提供 workspace projection，不承担写操作。

## 子命令

| 命令 | 作用 |
|---|---|
| `pw status` | 显示 session 和页面状态摘要 |
| `pw observe` | `status` 的兼容别名，同一实现 |
| `pw page current` | 当前 active page 摘要 |
| `pw page list` | 当前 browser context pages 列表 |
| `pw page frames` | frame projection |
| `pw page dialogs` | browser dialog 事件投影 |
| `pw page assess` | compact read-only 页面评估摘要 |
| `pw snapshot` | accessibility snapshot |
| `pw snapshot status` | 查看最新 snapshot ref epoch |
| `pw read-text` | 读取当前页可见文本 |
| `pw text` | `read-text` 的短别名 |
| `pw screenshot` | 截取页面或元素图片 |
| `pw pdf` | 保存当前页为 PDF |
| `pw accessibility` | 捕获 ARIA accessibility tree |

## 参数

公共参数：

| 参数 | 作用 |
|---|---|
| `-s, --session <name>` | 目标 managed session |
| `--output <text|json>` | 输出格式，默认 text |

`status/observe/page *`：

| 参数 | 作用 |
|---|---|
| `-s, --session <name>` | 目标 session |
| `--output <text|json>` | 输出格式 |

`snapshot`：

| 参数 | 作用 |
|---|---|
| `-i, --interactive` | 只返回 likely interactive lines |
| `-c, --compact` | compact structural output |

`read-text/text`：

| 参数 | 作用 |
|---|---|
| `--selector <css>` | 只读 selector 内文本 |
| `--include-overlay` / `--no-include-overlay` | 是否包含 overlay 文本，默认 true |
| `--max-chars <n>` | 最大输出字符数 |

`screenshot`：

| 参数 | 作用 |
|---|---|
| `--ref <ref>` | snapshot aria ref |
| `--selector <css>` | CSS selector |
| `--path <path>` | 输出文件路径 |
| `--full-page` | 全页截图 |
| `--annotate` | 标注 interactive elements |
| `--format <png|jpeg>` | 图片格式，默认 png |

`pdf`：

| 参数 | 作用 |
|---|---|
| `--path <path>` | PDF 输出路径；也可用第一个 positional path |

`accessibility`：

| 参数 | 作用 |
|---|---|
| `--interactive-only` / `--interactive` | 只返回 interactive nodes |
| `--root <css>` | 从指定 root selector 开始 |

## 技术原理

- `status.ts` 调用 `managedObserveStatus`，返回 summary/currentPage/dialogs/routes/errors/console/network/trace/har/bootstrap/modals。
- `page.ts` 调用 `managedPageCurrent`、`managedPageList`、`managedPageFrames`、`managedPageDialogs`、`managedPageAssess`。
- `snapshot.ts` 调用 `managedSnapshot`，`snapshot status` 调用 `managedSnapshotStatus` 检查 ref epoch。
- `read-text.ts` 调用 `managedReadText`，自动处理 selector、overlay 和 max chars。
- `screenshot.ts` 在普通 screenshot 和 `managedAnnotatedScreenshot` 之间按 `--annotate` 分流。
- `pdf.ts` 调用 active page PDF substrate，只做单页归档。
- `accessibility.ts` 调用 `managedAccessibilitySnapshot`，输出 role/name/ARIA 属性结构。

## 已知限制

- `SESSION_REQUIRED` / `SESSION_NOT_FOUND`：所有 live session 观察命令都需要有效 session。
- `MODAL_STATE_BLOCKED`：browser dialog 会阻断 `status`、`page assess` 和部分 run-code-backed reads；先 `dialog accept|dismiss`。
- `PAGE_ASSESS_FAILED`：`page assess` 是 inference-only compact summary，失败后改用 `page current`、`read-text`、`snapshot -i`。
- `READ_TEXT_SELECTOR_NOT_FOUND`：`read-text --selector` 零匹配会失败；先用 `locate` 或全页 `read-text` 缩小范围。
- iframe 内容限制：`read-text` 读不到 iframe body；用 `snapshot -i` 获取 iframe ref，或 `pw code` + `frameLocator()`。
- Snapshot ref 只在当前 page/navigation epoch 内有效；跨导航或重新 snapshot 后旧 ref 可能 `REF_STALE`。
- `page dialogs` 是未阻塞状态下的 observed event 投影，不是 authoritative live dialog set，也不是 pending browser dialog live list。browser dialog pending 时 run-code-backed projection 会返回 `MODAL_STATE_BLOCKED`，先 `dialog accept|dismiss`。
- `pdf` 依赖 Playwright/Chromium PDF 能力，不做报告模板、合并或批量归档。

## 使用证据

| 命令 | 状态 | 依据 |
|---|---|---|
| `status` | `proven` | dogfood 覆盖 `observe status` / workspace 摘要 |
| `observe` | `proven` | dogfood 使用兼容别名 `observe status` |
| `page current` | `proven` | dogfood workspace projection 覆盖 |
| `page frames` | `proven` | dogfood iframe projection 覆盖 |
| `page list` | `proven` | controldog 覆盖 page list workspace projection |
| `page dialogs` | `proven` | page-tab focused check 覆盖 zero-dialog projection、pending dialog blocked limitation、dismiss 后 observed event |
| `page assess` | `proven` | controldog 覆盖 inference summary、nextSteps 和 limitations |
| `snapshot` | `proven` | dogfood 登录页 snapshot 和 benchmark perception 覆盖 |
| `snapshot status` | `proven` | page-tab focused check 覆盖 fresh/stale ref epoch，并固化 `--output json` 单 envelope |
| `read-text` | `proven` | dogfood、benchmark perception 和 workflow 主链覆盖 |
| `text` | `proven` | controldog 覆盖 `read-text` 短别名输出 |
| `screenshot` | `proven` | benchmark generated perception/diagnostics task 允许并记录截图证据 |
| `pdf` | `proven` | artdog dogfood 输出 PDF artifact 并验证文件非空 |
| `accessibility` | `proven` | artdog dogfood 输出 interactive accessibility tree |

**状态分布：** proven 14 / documented 0 / experimental 0

## 设计决策

- `status` 是主名，`observe` 保留为兼容别名。
- 页面理解优先低噪声文本和摘要，只有需要 ref 或结构时再跑 `snapshot -i`。
- `locate/get/is/verify` 不放进 observe 文档主体，它们属于 state check 闭环，见 `wait.md`。
- 视觉和归档证据拆成 `screenshot/pdf/accessibility`，不把它们变成通用报告生成器。
- `page assess` 只给下一类观察建议，不替 Agent 选业务动作。

---

*最后更新：2026-05-03*
*对应实现：`src/cli/commands/status.ts` + `page.ts` + `snapshot.ts` + `read-text.ts` + `screenshot.ts` + `pdf.ts` + `accessibility.ts`*

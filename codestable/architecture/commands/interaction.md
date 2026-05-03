# pw interaction

<!-- 命令设计决策文档。使用教程仍以 skills/pwcli/ 为准。 -->

## 是什么

一句话：交互命令族在已有 session 的当前 page 上执行可观察、可诊断的用户动作。

## 为什么存在

Agent 需要像用户一样点击、输入、选择、拖拽、上传和下载，但每个动作都要有稳定 target contract、结构化失败码和 action evidence。这个命令族把 Playwright primitive 包成 Agent 可恢复的一等命令，动作后再由 `wait/verify/diagnostics` 闭环确认结果。

它不负责规划目标，也不负责创建 session。目标来源必须是 fresh snapshot ref、CSS selector 或语义定位参数。

## 子命令

| 命令 | 作用 |
|---|---|
| `pw click` | 点击 ref、selector 或语义 locator |
| `pw fill` | 填充输入控件 |
| `pw type` | 向当前 focus 或目标元素输入文本 |
| `pw press` | 按键 |
| `pw hover` | hover 目标元素 |
| `pw check` | 勾选 checkbox/radio |
| `pw uncheck` | 取消 checkbox |
| `pw select` | 选择 select option value |
| `pw drag` | 从一个元素拖到另一个元素 |
| `pw upload` | 给 file input 设置文件 |
| `pw download` | 点击目标并保存 download |
| `pw scroll` | 滚动当前页面 |
| `pw resize` | 调整 viewport |
| `pw mouse move|click|dblclick|wheel|drag` | 坐标级 mouse action |
| `pw dialog accept|dismiss` | 处理当前 browser dialog |

## 参数

公共参数：

| 参数 | 作用 |
|---|---|
| `-s, --session <name>` | 目标 managed session |
| `--output <text|json>` | 输出格式，默认 text |

标准 action target 参数，适用于 `click/fill/type/hover/check/uncheck/select`：

| 参数 | 作用 |
|---|---|
| `--ref <ref>` | snapshot aria ref；也可用第一个 positional ref |
| `--selector <css>` | CSS selector |
| `--text <text>` | Text content locator |
| `--role <role>` | ARIA role |
| `--name <name>` | Accessible name，通常与 `--role` 配合 |
| `--label <text>` | Label text |
| `--placeholder <text>` | Placeholder text |
| `--test-id <id>` / `--testid <id>` | data-testid value |
| `--nth <n>` | 1-based element index，默认 1 |

命令特有参数和 positional：

| 命令 | 参数 |
|---|---|
| `click` | `--button <left|right|middle>`，默认 left |
| `fill` | flag target 存在时所有 positionals 拼成 value；否则第一个 positional 是 ref，其余是 value |
| `type` | 单个 positional 输入当前 focus；多个 positionals 时第一个可作 ref，其余是 value |
| `press` | positionals 拼成 key |
| `select` | flag target 存在时 positionals 拼成 value；否则第一个 positional 是 ref，其余是 value |
| `drag` | `--from-selector <css>`、`--to-selector <css>`；也可用两个 positional refs |
| `upload` | `--selector <css>`、`--ref <ref>`，其余 positionals 是 files |
| `download` | `--ref <ref>`、`--selector <css>`、`--path <path>`、`--dir <dir>` |
| `scroll` | positional direction/distance 或默认向下滚动；完整参数以 help 为准 |
| `resize` | `--width <px>`、`--height <px>`、`--preset <name>`、`--view <name>` |
| `mouse` | `move/click/dblclick/wheel/drag` 坐标参数 |
| `dialog` | `accept|dismiss` |

## 技术原理

- `click/fill/type/hover/check/uncheck/select` 共享 `actionArgs` 和 `_helpers.actionTarget`。
- 这些标准 action 分别调用 `managedClick`、`managedFill`、`managedType`、`managedHover`、`managedCheck`、`managedUncheck`、`managedSelect`。
- action executor 在 engine 层统一做 baseline capture、runCode、diagnostics delta、run event recording 和失败截图。
- ref target 会校验最新 snapshot epoch；selector/semantic target 则在 Playwright locator 上执行。
- `drag/upload/download` 在 `#engine/act/page.js`，处理页面级动作、文件和 download artifact。
- `scroll/resize/mouse/dialog` 是页面级或坐标级动作，用于补齐无法通过语义 locator 表达的操作和恢复路径。
- `click` 输出可能包含 `openedPage`，后续用 `tab select <pageId>` 接管新页面。

## 已知限制

- `REF_STALE`：ref 来自旧 snapshot、旧 pageId 或旧 navigationId；恢复是重新 `snapshot -i` 并选 fresh ref。
- `ACTION_TARGET_NOT_FOUND`：目标不存在；先 `snapshot -i` 或 `locate`。
- `ACTION_TARGET_AMBIGUOUS`：locator 多匹配；使用更窄 locator 或 `--nth`。
- `ACTION_TARGET_INDEX_OUT_OF_RANGE`：`--nth` 超出匹配数量；先 inspect candidates。
- `ACTION_TIMEOUT_OR_NOT_ACTIONABLE`：目标不可操作或超时；先 `wait --selector` 或确认页面状态。
- `MODAL_STATE_BLOCKED`：browser dialog 阻断；优先 `dialog accept|dismiss`，不要重试原 click。
- iframe 内元素只能通过 snapshot ref 操作；`--selector` 不直接穿透 iframe。
- `upload` 成功只代表 input files 已设置；应用级接收需继续 `wait/verify/get`。
- `download` 的 `--path` 与 `--dir` 互斥。
- 语义定位是 substring 匹配，多匹配时必须 `--nth` 或改窄目标。
- 坐标级 `mouse` 没有语义 target contract；优先级低于 ref/selector/semantic action，只在画布、拖拽或无法定位元素时使用。
- `dialog` 只处理 browser dialog，不处理页面内 modal；页面内 modal 仍走 `observe/read-text/click` 或 `doctor` 判断。

## 使用证据

| 命令 | 状态 | 依据 |
|---|---|---|
| `click` | `proven` | dogfood 登录、导航、route、modal 和 diagnostics delta 覆盖 |
| `fill` | `proven` | dogfood 登录表单覆盖 |
| `type` | `proven` | dogfood test plan Actions 覆盖 |
| `press` | `proven` | dogfood test plan Actions 覆盖 |
| `drag` | `proven` | dogfood upload/drag/download 场景覆盖 |
| `upload` | `proven` | dogfood upload 场景覆盖 |
| `download` | `proven` | dogfood download artifact 场景覆盖 |
| `hover` | `documented` | skill command reference 记录 |
| `check` | `documented` | skill command reference 记录 |
| `uncheck` | `documented` | skill command reference 记录 |
| `select` | `documented` | skill command reference 记录 |
| `scroll` | `documented` | skill command reference 记录 |
| `resize` | `documented` | skill command reference 记录 |
| `mouse` | `documented` | skill command reference 记录 |
| `dialog` | `proven` | dogfood modal/dialog recovery 覆盖 |

**状态分布：** proven 8 / documented 7 / experimental 0

## 设计决策

- action 命令只执行，不规划；目标选择由 `read-text/locate/snapshot` 前置完成。
- ref 是短生命周期 identity，必须绑定 active page/navigation epoch。
- selector 和 semantic locator 都保留，因为 Agent 既需要稳定 CSS，也需要 UI 文本驱动的低门槛操作。
- action 后不把成功等同业务完成；必须显式 `wait` 和 `verify`。
- 坐标级 `mouse`、`scroll`、`resize` 是低层 escape hatch；Agent 默认先用 ref/selector/semantic action。

---

*最后更新：2026-05-04*
*对应实现：`src/cli/commands/click.ts` + `fill.ts` + `type.ts` + `press.ts` + `hover.ts` + `check.ts` + `uncheck.ts` + `select.ts` + `drag.ts` + `upload.ts` + `download.ts` + `scroll.ts` + `resize.ts` + `mouse.ts` + `dialog.ts`*

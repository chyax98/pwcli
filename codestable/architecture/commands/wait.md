# pw wait/state-check

<!-- 命令设计决策文档。使用教程仍以 skills/pwcli/ 为准。 -->

## 是什么

一句话：等待和状态检查命令族把动作后的页面变化验证成显式、可恢复的 read-only 闭环。

## 为什么存在

Agent 不能把“click 命令成功”当作业务状态成功。页面可能还在导航、请求未完成、DOM 未更新或断言失败。`wait/verify/is/get/locate` 提供小粒度事实读取和断言，让 Agent 在下一步前确认“页面已经到预期状态”。

这个命令族是 action 和 diagnostics 之间的桥：先等状态，再读事实，再断言；断言失败时不是 action failure，而是进入 recovery 或 diagnostics bundle。

## 子命令

| 命令 | 作用 |
|---|---|
| `pw wait` | 等待 delay、文本、selector、network idle、request/response 或 element state |
| `pw verify` | 对 URL、文本、可见性、启用态、选中态和数量做 read-only assertion |
| `pw is` | 读取 boolean state：visible/enabled/checked |
| `pw get` | 读取 target fact：text/value/count |
| `pw locate` | 返回低噪声候选摘要，可选尝试返回 fresh ref |

## 参数

公共参数：

| 参数 | 作用 |
|---|---|
| `-s, --session <name>` | 目标 managed session |
| `--output <text|json>` | 输出格式，默认 text |

`wait`：

| 参数 | 作用 |
|---|---|
| positional target | delay ms、ref 或 `network-idle` |
| `--text <text>` | 等待文本出现 |
| `--selector <css>` | 等待 selector |
| `--networkidle` / `--network-idle` | 等待 network idle |
| `--request <url>` | 等待 request URL |
| `--response <url>` | 等待 response URL |
| `--method <method>` | request/response method filter |
| `--status <code>` | response status filter |
| `--state <visible|hidden|stable|attached|detached>` | element state |

`verify` target 参数：

| 参数 | 作用 |
|---|---|
| `--ref <ref>` | snapshot aria ref |
| `--selector <css>` | CSS selector |
| `--text <text>` | Text content locator 或 expected text |
| `--role <role>` / `--name <name>` | ARIA role + accessible name |
| `--label <text>` | Label text |
| `--placeholder <text>` | Placeholder text |
| `--test-id <id>` / `--testid <id>` | data-testid value |
| `--nth <n>` | 1-based element index，默认 1 |

`verify` assertion 参数：

| 参数 | 作用 |
|---|---|
| positional assertion 或 `--assertion` | `text|text-absent|url|visible|hidden|enabled|disabled|checked|unchecked|count` |
| `--contains <text>` | URL substring |
| `--equals <value>` | exact value 或 count exact |
| `--matches <regex>` | URL regex |
| `--min <n>` / `--max <n>` | count bounds |

`is/get/locate`：

| 命令 | 参数 |
|---|---|
| `is` | target 参数 + positional state 或 `--state <visible|enabled|checked>` |
| `get` | target 参数 + positional fact 或 `--fact <text|value|count>` |
| `locate` | target 参数 + `--return-ref` / `--ref` |

## 技术原理

- `wait.ts` 调用 `managedWait`，把 text/selector/network/request/response/method/status 映射到 engine 等待。
- `verify.ts` 调用 `managedVerify`，先解析 assertion，再对 URL 或 target 做 read-only assertion。
- `is.ts` 调用 `managedIsState`，返回 boolean value 和 count。
- `get.ts` 调用 `managedGetFact`，读取 text/value/count。
- `locate.ts` 调用 `managedLocate`，返回 count、候选摘要和可选 fresh ref。
- `verify/is/get/locate` 共享 `actionArgs` 和 `stateTarget`，但不执行 action。

## 已知限制

- `VERIFY_FAILED`：断言完成但不通过；恢复是 `read-text`、`locate`、`snapshot -i`、`page current`，必要时 `diagnostics bundle`。
- `STATE_TARGET_NOT_FOUND`：`get text|value` 零匹配；先用 `locate` 或 `get count`。
- `REF_STALE`：用旧 ref 做 target check 会失败；重新 `snapshot -i`。
- `ACTION_TARGET_AMBIGUOUS` / `ACTION_TARGET_INDEX_OUT_OF_RANGE`：target 多匹配或 nth 越界；先缩窄 locator。
- `RUN_CODE_TIMEOUT`：长流程或等待嵌在 `pw code` 里可能超时；优先拆成一等 `wait`。
- `get value` 依赖 Playwright `inputValue()`，只适合 input/textarea/select 等表单控件。
- `locate/get/is/verify` 不返回 action plan；需要结构和 fresh ref 时用 `snapshot -i`。
- `wait` 一次只表达一个主要等待条件，不做多条件 planner。

## 使用证据

| 命令 | 状态 | 依据 |
|---|---|---|
| `wait` | `proven` | dogfood 多个 selector/text/network 场景和 benchmark diagnostics plan 覆盖 |
| `verify` | `proven` | dogfood test plan State checks 和 benchmark task allowed/evaluation 覆盖 |
| `is` | `proven` | dogfood test plan State checks 覆盖 |
| `get` | `proven` | dogfood test plan State checks 覆盖 |
| `locate` | `proven` | benchmark perception plan 和 dogfood test plan State checks 覆盖 |

**状态分布：** proven 5 / documented 0 / experimental 0

## 设计决策

- `wait` 处理时间和状态到达，不替代 assertion。
- `verify` 失败返回 `VERIFY_FAILED`，不伪装成 action failure。
- `locate` 默认只返回低噪声候选，不返回 ref；`--return-ref` 是显式 opt-in。
- `get count` 允许零匹配返回 0，`get text/value` 零匹配报错，区分探测和读取。
- 这些命令是 read-only state check，不负责规划下一步点击或输入。

---

*最后更新：2026-05-03*
*对应实现：`src/cli/commands/wait.ts` + `verify.ts` + `is.ts` + `get.ts` + `locate.ts`*

# Workflow Index

主 skill 覆盖高频主链；当你需要按任务类型执行标准链路时，从这里路由。

## 选择规则

1. **先判定目标**：探索页面 / 诊断问题 / 做确定性测试。
2. **只打开一个 workflow**：先跑最短闭环，避免一次加载过多命令。
3. **每条 workflow 都要收口**：动作后必须 `wait` + read-only 验证；失败时必须有 diagnostics / recovery / handoff 证据。
4. **命令参数以 reference 为准**：遇到参数细节回查 `references/command-reference*.md`。

## 1.0 任务矩阵

| 任务 | 入口 | 必须覆盖 |
|---|---|---|
| 浏览器探索 / 常规自动化 | `../workflows/browser-task.md` | `session create` -> `status/page/read-text` -> `locate/snapshot` -> action -> `wait` -> `verify/read-text` |
| 自动化测试 / mock | `../workflows/controlled-testing.md` | `route`、`environment`、`bootstrap`、动作、断言、失败证据 |
| 填表 / 上传 / 下载 / PDF | `../workflows/browser-task.md` | `fill/type/check/select`、`upload`、`download`、`screenshot/pdf`、结果复查 |
| 简单爬取 / 内容提取 | `../workflows/browser-task.md` | 多页导航、低噪声 `read-text`、`get count`、必要时小范围 `pw code` |
| Deep Bug 复现与分析 | `../workflows/diagnostics.md` | `errors clear`、复现动作、`diagnostics digest`、`console/network/errors`、bundle |
| 失败恢复和证据交接 | `../workflows/diagnostics.md` + `./failure-recovery.md` | blocked state 判定、`doctor`、恢复命令、恢复后 `diagnostics bundle --task` |
| HAR replay / deterministic stubbing | `./command-reference-diagnostics.md` | `har replay <file>` / `har replay-stop`；`har start|stop` 只会返回 `UNSUPPORTED_HAR_CAPTURE` |

这些是 1.0 前 Agent dogfood 的最小任务面；不能只用单命令成功替代 workflow 证明。

## Workflows

- 浏览器探索：`../workflows/browser-task.md`
- 诊断与证据链：`../workflows/diagnostics.md`
- 受控自动化测试：`../workflows/controlled-testing.md`

## 配套文档

- 错误恢复：`./failure-recovery.md`
- 核心交互命令：`./command-reference.md`
- 诊断命令：`./command-reference-diagnostics.md`
- 高级命令（state/auth/batch/environment）：`./command-reference-advanced.md`
- 领域详细说明：`../domains/README.md`

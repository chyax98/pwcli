# Workflow Index

主 skill 覆盖高频主链；当你需要按任务类型执行标准链路时，从这里路由。

## 选择规则

1. **先判定目标**：探索页面 / 诊断问题 / 做确定性测试。
2. **只打开一个 workflow**：先跑最短闭环，避免一次加载过多命令。
3. **命令参数以 reference 为准**：遇到参数细节回查 `references/command-reference*.md`。

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

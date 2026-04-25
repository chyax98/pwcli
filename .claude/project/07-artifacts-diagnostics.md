# Artifacts And Diagnostics

更新时间：2026-04-25
状态：draft

目标：
- 默认打开有价值的观测能力。
- 默认落盘到可检索的 run 目录。
- 命令结果返回关键摘要和路径。

## 默认产物

- `session-log.jsonl`
- screenshot
- trace
- HAR
- 必要时的 perf 产物

## 默认 diagnostics

动作类命令默认检查：
- console `error`
- console `warning`
- network `requestfailed`
- network `response.status >= 400`

返回策略：
- 默认返回关键 diagnostics 摘要
- 详细内容落盘到 artifact run 目录

## 搜索与关联

项目层允许自研：
- 命令名搜索
- URL / 状态码搜索
- error / warning 文本搜索
- artifact 与 session log 的 run 关联

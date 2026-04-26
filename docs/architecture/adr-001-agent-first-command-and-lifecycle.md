# ADR-001 Agent-First Command And Lifecycle

状态：accepted  
更新时间：2026-04-26

## 决策

`pwcli` 的 lifecycle 只保留 3 条主路：

- `pw session create`
- `pw session attach`
- `pw session recreate`

附带规则：

- `open` 只做导航
- `auth` 只做 plugin 执行
- `profile` 只做 inspect
- `batch` 只接受结构化 `string[][]`
- skill 是唯一使用教程真相

## 原因

目标用户是 Agent。  
Agent 不需要多套同义入口，它需要稳定、窄、可预测的 contract。

之前的风险点很直接：

- `connect` 和 `session attach` 并存
- `auth` 能改 lifecycle shape
- `open` 能重建 session
- `profile open` 也能重建 session

这会让使用路径分叉，导致：

- skill 难以教清楚
- 文档容易漂移
- 错误恢复成本更高

## 当前取舍

### 收益

- lifecycle 只有一条心智模型
- session shape 只在生命周期命令上变化
- `open` / `auth` / `profile` 语义更窄
- skill 可以给出唯一教程

### 代价

- 少了若干“一把梭”命令
- 某些人手工使用路径会更长

这个代价对当前产品成立，因为它是 Agent-first 内部工具。

## 已知限制

- `session attach --browser-url/--cdp` 当前仍依赖本地 attach bridge registry
- `session status` 仍是 best-effort 视图

## 后续扩展原则

- 新 lifecycle 能力只允许长在 `session create|attach|recreate`
- 其它命令如果要碰 session shape，需要先过这条 ADR
- 如果未来要扩 raw CDP substrate，也只能落在 `session attach`

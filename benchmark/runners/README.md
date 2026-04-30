# Benchmark Runners

`benchmark/runners/` 现在已经有一个最小可执行 runner。

## 任务边界

runner 分两层：

- `task runner`
  - 读取单个 task spec
  - 启动/附着 benchmark session
  - 执行允许的 `pw` 命令链
  - 采集 stdout/stderr/json/artifacts
  - 输出单 task verdict
- `suite runner`
  - 读取一个 category 或整个 suite
  - 管理 fixture 生命周期
  - 聚合 task 结果
  - 输出 `reports/latest/*`

## Runner 最小职责

- 解析 task spec
- 接收外部 fixture port 并替换 task spec 里的 `<port>`
- 约束 `allowedCommands`
- 采集证据：
  - stdout / stderr
  - command JSON envelope
  - screenshot
  - diagnostics bundle
  - exported artifact
- 按 `benchmark/scoring/taxonomy.json` 分类失败 family
- 写出 run 目录：

```text
benchmark/artifacts/<taskId>/<runId>/
```

## 当前非目标

- 不在 runner 里内置 AI planner
- 不在 runner 里绕过目标站点风控
- 不把 runner 写成第二个 `pwcli`
- 不在这一版 runner 里支持所有 task category

## 当前 MVP 边界

当前 shipped runner 只稳定支持：

- `fixture-perception-basic-001`

MVP 结构：

- `benchmark/shared/load-task.mjs`
  - 读取 task spec
  - 做 `<port>` placeholder replacement
- `benchmark/runners/task/run-task.mjs`
  - 跑单 task
  - 写 `commands.jsonl`、`stdout.json`、`task-summary.json`
- `benchmark/runners/suite/run-suite.mjs`
  - 聚合一个或多个 task
  - 写 `summary.json`、`summary.md`

## 未来 runner 输出约定

至少要能稳定写出：

```text
benchmark/reports/latest/summary.md
benchmark/reports/latest/score.json
benchmark/reports/latest/tasks/<taskId>.json
benchmark/artifacts/<taskId>/<runId>/stdout.json
benchmark/artifacts/<taskId>/<runId>/commands.jsonl
```

当前 MVP 已经稳定写出：

```text
benchmark/reports/latest/summary.json
benchmark/reports/latest/summary.md
benchmark/artifacts/<taskId>/<runId>/stdout.json
benchmark/artifacts/<taskId>/<runId>/commands.jsonl
benchmark/artifacts/<taskId>/<runId>/task-summary.json
```

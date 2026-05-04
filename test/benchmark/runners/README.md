# Benchmark Runners

`benchmark/runners/` 当前只是稳定性评测执行面，不是独立 runner 平台。

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
- 写出 run 目录：

```text
benchmark/artifacts/<taskId>/<runId>/
```

## 当前非目标

- 不在 runner 里内置 AI planner
- 不在 runner 里绕过目标站点风控
- 不把 runner 写成第二个 `pwcli`
- 不在这一版 runner 里支持所有 task category
- 不继续优先扩成更重的 score/report/nightly 平台

## 当前实现边界

当前 runner 已支持的 deterministic families：

- `perception-article`
- `diagnostics-api500`
- `auth-state`

当前结构：

- `benchmark/shared/load-task.mjs`
  - 读取 task spec
  - 做 `<port>` placeholder replacement
  - 递归发现 tasks dir 下的 JSON task
- `benchmark/runners/task/run-task.mjs`
  - 按 `planKind` 跑单 task
  - 写 `commands.jsonl`、`stdout.json`、`task-summary.json`
- `benchmark/runners/suite/run-suite.mjs`
  - 聚合一个或多个 task
  - 写 `summary.json`
  - 聚合 failure family 计数
- `benchmark/scripts/generate-matrix.mjs`
  - 生成 deterministic task matrix
- `benchmark/scripts/run-closure-suite.mjs`
  - 启动 fixture server
  - 执行 closure suite

## 当前 runner 输出约定

至少要能稳定写出：

```text
benchmark/reports/latest/summary.json
benchmark/reports/latest/tasks/<taskId>.json
benchmark/artifacts/<taskId>/<runId>/stdout.json
benchmark/artifacts/<taskId>/<runId>/commands.jsonl
```

当前实现已经稳定写出：

```text
benchmark/reports/latest/summary.json
benchmark/artifacts/<taskId>/<runId>/stdout.json
benchmark/artifacts/<taskId>/<runId>/commands.jsonl
benchmark/artifacts/<taskId>/<runId>/task-summary.json
```

`summary.json` 当前包含：

- `total`
- `passed`
- `failed`
- `failures`

## 300+ suite 策略

当前 closure suite 不手写 300+ JSON。

采用：

- 少量 fixture 页面/接口
- 少量 family evaluator
- generator 产出 320 deterministic tasks

这样任务是真跑，同时不会把稳定性评测维护成本推到不可控。

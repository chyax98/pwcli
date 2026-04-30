# pwcli Benchmark

`benchmark/` 是 `pwcli` 的 repo-local benchmark scaffold。

这里评测的不是某个 LLM 的文案能力，而是 `pwcli` 作为 Agent-facing Browser CLI 的命令链、证据链和恢复链：

```text
session -> observe/read/snapshot -> act -> wait/verify -> diagnostics/evidence
```

## 目标

- 用 deterministic fixture 验证主链 contract
- 用 machine-readable taxonomy 收口失败分类
- 为后续 runner、scoring、reports、real-site dogfood 提供固定目录面

## 当前范围

当前已经落到第一版可执行 MVP：

- `tasks/`
  - task spec 样例 + generated deterministic matrix
- `fixtures/`
  - fixture 归属和确定性规则
- `runners/`
  - runner MVP（single task / suite / closure suite）
- `scripts/`
  - task matrix generator
  - closure suite launcher
- `scoring/`
  - machine-readable taxonomy 和后续 scoring 资产
- `reports/`
  - benchmark 汇总输出目录占位
- `artifacts/`
  - 单 task 单 run 原始工件目录占位

## 目录约定

```text
benchmark/
  tasks/
    perception/
    diagnostics/
  fixtures/
  runners/
  scoring/
  reports/
  artifacts/
```

后续会继续补：

- `tasks/action/`
- `tasks/auth/`
- `tasks/state-reuse/`
- `tasks/controlled-testing/`
- `tasks/script-injection/`
- `tasks/extraction/`
- `tasks/real-sites/`（当前先是 manual pack）

## 任务 spec 原则

- 每个任务一个 JSON 文件
- `id` 必须稳定、可追踪
- `allowedCommands` 只允许当前 benchmark 允许的 `pw` 命令家族
- `successCriteria`、`failureTaxonomy`、`evidenceRequired` 必须 machine-readable
- fixture task 优先，不把真实站点波动当成日常 gate

## 当前非目标

- 不在这里实现 planner
- 不把 stealth / anti-detection 做成 benchmark 主线
- 不把 benchmark 文档写成第二套 `pwcli` 教程

## Runner MVP

当前 runner 只保证一件事：

- 能读取 benchmark task spec
- 能替换 fixture `startUrl` 里的 `<port>`
- 能运行最小 `pw` 命令链
- 能为单 task 落 artifact
- 能为 suite 写 `summary.json` 和 `summary.md`

当前 deterministic family 支持：

- `perception-article`
- `diagnostics-api500`
- `auth-state`
- `extraction-list`

其他 task spec 还属于后续 tranche，不要包装成“当前已支持完整 suite”。

### 直接运行

单 task：

```bash
node benchmark/runners/task/run-task.mjs \
  --task benchmark/tasks/perception/fixture-perception-basic-001.json \
  --port 43210
```

suite 聚合：

```bash
node benchmark/runners/suite/run-suite.mjs \
  --task benchmark/tasks/perception/fixture-perception-basic-001.json \
  --port 43210
```

生成并跑 closure suite：

```bash
node benchmark/scripts/generate-matrix.mjs
node benchmark/scripts/run-closure-suite.mjs
```

可选参数：

- `--reports-dir <dir>`
- `--artifacts-dir <dir>`
- `--workspace-dir <dir>`

默认输出：

```text
benchmark/reports/latest/summary.json
benchmark/reports/latest/summary.md
benchmark/artifacts/<taskId>/<runId>/
```

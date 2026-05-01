# pwcli Benchmark

`benchmark/` 是 `pwcli` 的 repo-local 稳定性评测面。

这里不是独立评测平台。它只负责验证 `pwcli` 作为 Agent-facing Browser CLI 的关键能力是否稳定：

```text
session -> observe/read/snapshot -> act -> wait/verify -> diagnostics/evidence
```

## 目标

- 用 deterministic fixture 验证主链 contract
- 用少量固定能力用例做稳定性回归
- 为 real-site manual dogfood 提供最小工件面

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
  - machine-readable taxonomy 和最小稳定性聚合资产
- `reports/`
  - 最小汇总输出目录
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

后续只在真实需要时补：

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
- 能为 suite 写 `summary.json`

当前 deterministic family 支持：

- `perception-article`
- `diagnostics-api500`
- `auth-state`
- `extraction-list`

其他 task spec 还属于后续 tranche，不要包装成“当前已支持完整 suite”。

## 明确边界

- benchmark 在这个项目里是**稳定性回归工具**
- 不是独立产品
- 不继续优先扩 `score` / `report` / `nightly orchestration`
- 任何新增 benchmark 资产都必须服务某个已存在能力的稳定性验证

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
benchmark/artifacts/<taskId>/<runId>/
```

`summary.json` 是当前唯一稳定聚合输出，至少包含：

- `total`
- `passed`
- `failed`
- `failures`

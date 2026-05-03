# pwcli Agent Benchmark

## 设计理念

pwcli 是 AI Agent 的浏览器工具层。本 Benchmark 评测的不是命令是否可执行（那是 TC 评测的事），
而是：**当 Agent 拿到一个真实用户任务，能否用 pwcli 独立完成它？**

```
用户任务 → [Agent: Kimi/Codex] → pw 命令序列 → 浏览器执行 → 任务完成/失败
                                    ↑
                         Agent 自主决策，不预设命令
```

## Pipeline 结构

```
scripts/benchmark/
├── BENCHMARK.md         本文档
├── SCENARIOS.md         场景定义（目标、指标、评判标准）
├── tasks/               任务说明书（Agent 接收的输入）
│   ├── T01-login.md
│   ├── T02-mfa-login.md
│   └── ...
├── run_task.sh          单任务运行器（发给 Kimi 执行）
├── run_all.sh           全量 Benchmark 运行器
├── evaluate.py          结果评分脚本
└── results/             执行结果存放
    ├── T01_<ts>.md
    └── benchmark_<ts>.json
```

## 任务格式规范

每个 task 文件包含：
- **用户意图**（自然语言，Agent 读的）
- **上下文**（应用 URL、凭据、工具路径）
- **成功标准**（机器可判断的 checklist）
- **证据要求**（Agent 必须产出的 artifact）

## 指标体系

| 指标 | 说明 | 目标 |
|------|------|------|
| `task_complete` | Agent 是否完成任务 | ≥ 80% |
| `criteria_pass_rate` | 成功标准通过率 | ≥ 85% |
| `commands_used` | Agent 使用了多少条 pw 命令 | — |
| `efficiency` | commands_used / optimal_commands | ≤ 2.0 |
| `recovery_count` | 遇到错误后自主恢复次数 | — |
| `artifacts_count` | 产出的证据数量 | ≥ 1 for evidence tasks |
| `time_s` | 完成任务耗时 | ≤ 60s |
| `hallucination` | 是否使用了不存在的命令/flag | 0 |

## 运行方式

```bash
# 运行单个任务（发给 Kimi）
./run_task.sh T01

# 运行全量 Benchmark
./run_all.sh

# 只跑核心场景
./run_all.sh --core
```

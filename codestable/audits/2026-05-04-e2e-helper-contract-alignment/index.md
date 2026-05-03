---
doc_type: audit
slug: e2e-helper-contract-alignment
status: completed
created: 2026-05-04
tags: [e2e, dogfood, pre-1-0, contract]
related_roadmap: pre-1-0-breakthrough
---

# E2E Helper Contract Alignment Audit

## 结论

`scripts/e2e/pwcli-dogfood-e2e.sh` 本轮保留，定位为**辅助回归和 fixture 复用入口**，不作为 1.0 深度验证的唯一入口。

保留理由：

| 检查项 | 结论 |
|---|---|
| lifecycle 边界 | 符合。脚本通过 `session create` 创建 session，通过 `session close` 清理；`open` 只用于已有 session 导航 |
| `batch` 边界 | 符合。脚本只用结构化 `string[][]` 子集加载 route / read-only 组合，不把 batch 扩成全 CLI parity |
| auth 边界 | 符合。脚本只验证 `state save|load` 的本地 fixture 登录态复用，不冒充真实 Forge/DC auth |
| command contract | 当前通过。脚本使用的是当前 shipped command / flag / JSON envelope |
| 深度验证定位 | 不作为唯一深测入口。每个 command 和 workflow 的 1.0 深评必须拆成独立循环，由 Agent 按 `skills/pwcli/` 真实执行并记录证据 |

## 本轮验证

执行：

```bash
pnpm test:dogfood:e2e
```

结果：

```text
pass
duration: 420.6s
```

覆盖到的阶段：

```text
session create login
login page inspection
login flow
state save
deep navigation
workspace projection
summary request
trigger failing reproduce
page error and console
route add direct
route load file via batch
route match-body
route patch response
environment controls
upload drag download
bootstrap and code
cookies and storage
batch file
modal blockage and recovery
diagnostics export and run queries
state reuse on new session
session close
```

## 失败误判说明

首次执行使用 240 秒外部 timeout，脚本在 `route add direct` 后继续运行但被外层超时杀掉。诊断 `diagnostics runs` 显示当时 `route add direct`、route target click 和后续 route inject 已经成功，不是该 command contract 失败。

根因：该 shell E2E 覆盖面过宽，运行时间超过 4 分钟。后续不应继续把更多深测塞进这条脚本；1.0 深评必须拆成更小的 command / workflow 循环。

## 维护决策

- 保留 `pnpm test:dogfood:e2e`。
- 保留 `scripts/e2e/dogfood-server.js` 和 route/bootstrap fixture 文件。
- 不把大型 shell E2E 继续扩展成 1.0 全能力验收脚本。
- 1.0 release gate 可以要求它通过，但每个 command 的 proven 状态必须另有命令级评估证据或真实 Agent dogfood 证据。
- 若它未来失败，先分类为产品 P0/P1、contract 漂移或脚本维护问题，不默认修脚本。

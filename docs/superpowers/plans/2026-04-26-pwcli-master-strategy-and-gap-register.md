# pwcli Master Strategy And Gap Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 定义 `pwcli` 的最终产品形态、真实 agent story、全量技术债、优先级、trade-off 和决策门槛，给后续全部实现提供统一战略基线。

**Architecture:** `pwcli` 继续沿用 `app -> domain -> infra -> playwright-core`。产品建设围绕 3 条闭环推进：`探索闭环`、`执行诊断闭环`、`接管复用闭环`。先把闭环打透，再扩环境控制、workspace 写操作、证据检索和更深 substrate。

**Tech Stack:** Node 24、TypeScript、commander、playwright-core 1.59.1、Playwright CLI `session.js` / `registry.js`、BrowserContext/Page/Locator public API、本地 plugin/skill 分发

---

## 1. Product End State

`pwcli` 的终局不是“命令越来越多”，是下面 3 条闭环稳定可用。

### 1.1 探索闭环

目标：

- 创建或接管 session
- 快速知道当前页、workspace、dialog、frame、可见文本、操作入口

标准主链：

```bash
pw session create bug-a --open https://example.com
pw snapshot --session bug-a
pw page current --session bug-a
pw page frames --session bug-a
pw read-text --session bug-a
pw observe status --session bug-a
```

成功标准：

- agent 无需推断当前活跃目标
- 输出字段稳定
- 当前页、workspace、dialogs 的表达一致

### 1.2 执行诊断闭环

目标：

- 执行动作后立即拿到诊断增量
- 失败时不需要额外手工拼 `console/network/errors`

标准主链：

```bash
pw click e6 --session bug-a
pw wait networkIdle --session bug-a
```

成功标准：

- 动作命令直接回传 diagnostics delta
- batch 每一步也有 delta
- 失败路径带最小可用证据

### 1.3 接管复用闭环

目标：

- 登录、复用、切换、接管浏览器时少踩坑

标准主链：

```bash
pw session create dc-main --open https://target/
pw auth dc-login --session dc-main --open https://target/
pw state save ./auth.json --session dc-main
pw session attach reuse-a --browser-url http://127.0.0.1:9222
```

成功标准：

- 生命周期 ownership 清楚
- `session` / `auth` / `profile` / `state` 的职责不打架
- attach 错误能说人话

## 2. Real Agent Stories

### Story A: 快速接管问题现场

输入：

- 一个 URL，或者一个已经打开的浏览器

agent 需要：

1. 进入 session
2. 看清当前页和 workspace
3. 读文本
4. 给下一步动作建议

阻塞点：

- `page *` 和 `observe` 仍会被 modal state 阻断
- dialog 只有事件投影，没有恢复能力

### Story B: 执行一条多步问题复现链

输入：

- 一个复现步骤序列

agent 需要：

1. 批量执行动作
2. 每一步看到是否引发 console/network/error
3. 必要时截图或落 trace

阻塞点：

- 动作后 diagnostics 还没内建
- batch 还是字符串 step contract

### Story C: 复用登录态继续定位

输入：

- profile、state、auth plugin 三者之一

agent 需要：

1. 选择最稳的入口
2. 保留 session truth
3. 进入真实页

阻塞点：

- `auth` 当前仍能碰 lifecycle
- `profile open` 和 `session create --profile` 有重叠

### Story D: 带证据结束一轮排查

输入：

- 一条执行链和一组异常

agent 需要：

1. 拿到 screenshot/trace/download/state 路径
2. 把本轮 diagnostics 组织起来
3. 输出给上游 agent 或 PR review

阻塞点：

- 没有默认 run dir
- 没有 action-linked evidence truth

## 3. Non-Negotiable Rules

1. 只要 Playwright public API 够用，就不自研新层
2. session substrate 继续借 `session.js` / `registry.js`
3. 工具是 agent-only，命令面优先机器稳定，不优先人类手打舒服
4. 文档、skill、`--help` 一旦分裂，就算 shipped contract 失效
5. 除非有最小复现和上游失败证据，不新增私有层

## 4. Full Gap Register

### 4.1 P0 Gaps

| ID | Gap | Current truth | User impact | Category | Recommendation |
| --- | --- | --- | --- | --- | --- |
| P0-1 | modal state recoverability | modal state 会阻断 `browser_run_code`，进而影响 `page *` / `observe status` | agent 失明 | trade-off | 先做检测、错误码、doctor、恢复建议；再评估能否加 dialog 恢复命令 |
| P0-2 | 动作后即时 diagnostics | action 后还要额外跑 `console/network/errors` | agent 反馈链太长 | direct | 基于现有 records 做 baseline/delta，先做摘要增量 |
| P0-3 | agent contract 漂移 | README 大体对，skill reference 基本过期 | agent 误用命令，错误归因困难 | direct | README、skill、truth、`--help` 一致化 |

### 4.2 P1 Gaps

| ID | Gap | Current truth | User impact | Category | Recommendation |
| --- | --- | --- | --- | --- | --- |
| P1-1 | evidence 最小闭环 | screenshot/download/state/trace 都是显式路径驱动 | 结果能拿到，链路不能复盘 | direct | 建 `.pwcli/runs/<runId>/` 最小模型 |
| P1-2 | runtime lane 拆分 | [runtime.ts](/Users/xd/work/tools/pwcli/src/infra/playwright/runtime.ts) 1724 行 | 继续扩功能会回到大泥球 | direct | 按 session/workspace/interaction/identity-state/diagnostics/bootstrap 拆 |
| P1-3 | acquisition ownership 漂移 | `session create`、`profile open`、`auth` 都能触发生命周期动作 | 入口心智不清 | decision | 统一生命周期 owner |
| P1-4 | batch contract 脆弱 | 当前是 shell-like string parser | agent 复杂步骤容易出错 | decision | 增加 JSON batch contract，字符串模式冻结 |
| P1-5 | smoke/dogfood 不系统 | 有 fixture，没有稳定 ship gate | 重构回归成本高 | direct | 建 release-level smoke matrix |

### 4.3 P2 Gaps

| ID | Gap | Current truth | User impact | Category | Recommendation |
| --- | --- | --- | --- | --- | --- |
| P2-1 | environment control 缺口 | `offline/geolocation/permissions/clock/mock/inject` 大多未实现 | 复杂边界复现能力不足 | direct | 先做 BrowserContext 原生最贴近的 `offline/geolocation/permissions/clock` |
| P2-2 | workspace 写操作缺失 | 只有 read-only projection | 多 tab 排查效率一般 | trade-off | 先定义 stable target identity，再做 `tab select/close` |
| P2-3 | richer identity-state mutation | 只有 cookie set/list，storage 只读 | 轻量修复场景不够顺手 | direct | 补 `cookies remove/update` 和 storage write/remove |
| P2-4 | diagnostics 持久查询 | records 只在 live session 内 | 长链路回溯能力弱 | trade-off | 先做 JSONL 级别落盘，不做大系统 |

### 4.4 P3 / Deferred Oceans

| ID | Gap | Current truth | User impact | Category | Recommendation |
| --- | --- | --- | --- | --- | --- |
| P3-1 | raw CDP named-session substrate | `browser-url/cdp` 仍依赖 attach bridge registry | 外部浏览器接管面不通用 | trade-off | 暂缓，等真实 blocker |
| P3-2 | observe stream | 当前只有 `observe status` | 实时观测不够 | trade-off | 暂缓 |
| P3-3 | HAR 热录制 / perf / video | 还是 limitation | 证据体系不完整 | trade-off | 暂缓 |
| P3-4 | artifact index/search | 还没有 run index | 后续检索能力弱 | trade-off | 暂缓，先做最小 run dir |

## 5. Decision Register

### DEC-001 `connect` 是否继续保留

现状：

- `connect` 只是 `session attach` 兼容壳

选项：

1. 保留
2. 标记 deprecated
3. 删除

推荐：

- **选项 3，删除**

理由：

- agent-only 工具不需要兼容壳
- 多一个入口只会放大文档和 skill 漂移

决策状态：

- **需要你拍板**

### DEC-002 `auth` 是否继续持有 lifecycle 参数

现状：

- `auth` 现在能带 `--profile` / `--persistent` / `--state` / `--open`

选项：

1. 继续保留
2. 缩成只负责 plugin 执行，session shape 交给 `session create`

推荐：

- **选项 2**

理由：

- `auth` 负责登录
- `session` 负责生命周期
- ownership 更清楚

决策状态：

- **需要你拍板**

### DEC-003 `batch` 是否升级成 JSON contract

现状：

- 当前 `batch` 是字符串 step parser

选项：

1. 继续只用字符串
2. 增加 JSON mode，冻结字符串 mode

推荐：

- **选项 2**

理由：

- agent-only CLI 更适合结构化输入
- 可以减少 quoting、转义和 parser 歧义

决策状态：

- **需要你拍板**

### DEC-004 是否接受当前 workspace-scoped substrate

现状：

- named session substrate 继承 Playwright registry 的 workspace key 语义

选项：

1. 现在就改成全局桶
2. 先接受，等真实 blocker

推荐：

- **选项 2**

理由：

- 现在还没出现真实跨 workspace blocker
- 改底层 key 会引入额外副作用

决策状态：

- **可以直接定**

### DEC-005 是否立即做 raw CDP named-session substrate

现状：

- 依赖 attach bridge registry

选项：

1. 现在开工
2. 延后

推荐：

- **选项 2**

理由：

- 当前主要 blocker 不在这里
- 这条会明显增大底层复杂度

决策状态：

- **可以直接定**

## 6. Strategy Roadmap

### Wave 1

- P0-1 modal recoverability
- P0-2 action diagnostics delta
- P0-3 agent contract sync

### Wave 2

- P1-1 evidence 最小闭环
- P1-2 runtime lane 拆分
- P1-5 smoke / dogfood gate

### Wave 3

- P1-3 acquisition ownership
- P1-4 batch JSON contract
- P2-1 environment control

### Wave 4

- P2-2 workspace write operations
- P2-3 richer identity-state mutation
- P2-4 diagnostics persistence

### Deferred

- P3 全部 ocean 项

## 7. What Can Be Perfect, What Needs Trade-Off, What Needs Approval

### Can be implemented cleanly now

- action diagnostics delta
- agent contract sync
- evidence 最小 run dir
- runtime lane 拆分
- smoke / dogfood gate
- BrowserContext 级 environment control 第一批

### Needs explicit trade-off

- modal recoverability
- workspace 写操作
- raw CDP named-session substrate
- observe stream
- HAR 热录制 / perf / video
- diagnostics 持久查询系统

### Needs your decision

- `connect` 的去留
- `auth` lifecycle ownership
- `batch` 是否上 JSON mode

## 8. Success Criteria

这份战略计划算完成，要满足：

1. 团队知道接下来先做哪 5 条
2. 能清楚区分 P0/P1 和远期 ocean
3. 能清楚区分可直接实现、需要 trade-off、需要拍板
4. 后续执行不再回到“补命令清单”的工作方式

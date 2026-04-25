# Batch And Daemon

更新时间：2026-04-25
状态：draft

## 为什么要有 batch

`batch` 是核心能力，不是附属命令。

原因：
- Agent 经常需要连续执行一串动作。
- 一次命令内顺序执行可以减少反复启动 runtime 的成本。
- 同一条执行链更容易收口 diagnostics 和 artifacts。

## batch 的目的

- 在同一个 runtime session 中顺序执行多个语义命令。
- 让 Agent 可以把一段操作作为一个完整工作流提交。
- 让 artifacts / diagnostics 天然属于同一条运行链。

## batch 的最小原则

- 顺序执行
- 默认 fail-fast
- 可选继续执行
- 结果按 step 返回
- 共享同一个 runtime session

## 为什么要有 daemon

daemon 不是为了炫技。

需要它的原因：
- 保持浏览器长期存活
- 支持 headed 实时观察
- 支持 named session
- 支持长链路 Agent 工作流
- 避免每条命令都重新启动浏览器

## daemon 的目的

- 为 `session`、`page truth`、`current browser context` 提供稳定承载体。
- 支持多次 CLI 调用复用同一浏览器环境。

## batch 和 daemon 的关系

- `batch`：一个进程内的短链路编排
- `daemon`：跨命令、跨进程的长链路复用

二者都重要，但承担的问题不同。

## 当前实现策略

先做：
- 单进程 runtime session
- `batch`

再做：
- daemon / named session

原因：
- `batch` 依赖最小 runtime 抽象
- daemon 必须建立在清楚的 session/page truth 之上

## daemon substrate 决策

当前决策：
- 直接使用 Playwright CLI 内部的 `session.js` / `registry.js` 模式
- 不自写第二套主 session/registry 协议

原因：
- 当前项目是内部工具
- `playwright-core` 版本锁死
- 目标是快速得到完整工具，不做无意义抽象

## 对 Playwright 的使用原则

- `batch` 共享同一 `BrowserContext/Page`
- daemon 复用同一长期运行的 `BrowserContext/Page`
- 项目层只负责路由、truth、artifact、diagnostics

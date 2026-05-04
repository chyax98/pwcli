---
doc_type: issue-report
issue: 2026-05-04-run-code-timeout-cli-hang
status: confirmed
severity: P1
summary: pw code 触发 RUN_CODE_TIMEOUT 后 CLI 进程没有及时退出，外层 shell 只能超时杀掉
tags: [pre-1-0, recovery, run-code, timeout, session]
---

# RUN_CODE_TIMEOUT CLI Hang Issue Report

## 1. 问题现象

受控 `pw code` 长流程触发 `RUN_CODE_TIMEOUT` 后，CLI 已输出错误 envelope，但进程没有在 guard timeout 后及时退出。外层 shell 45s timeout 才杀掉该进程。

后续 `page current`、`status`、`diagnostics digest`、`doctor` 能恢复读取 session，说明 browser session 本身可恢复；问题集中在触发 timeout 的 CLI 进程退出路径。

## 2. 复现步骤

1. 创建 session：

   ```bash
   pw session create rctime1 --no-headed --open 'data:text/html,<main><h1 id="title">timeout recovery</h1></main>' --output json
   ```

2. 运行永不完成的 `pw code`：

   ```bash
   pw code --session rctime1 'async page => await new Promise(() => {})' --output json
   ```

3. 观察到：CLI 输出 `RUN_CODE_TIMEOUT` envelope，但进程未及时退出；外层 shell 超时返回 `SIGTERM` / `ETIMEDOUT`。

4. 同 session 继续读取：

   ```bash
   pw page current --session rctime1 --output json
   pw status --session rctime1 --output json
   pw diagnostics digest --session rctime1 --output json
   pw doctor --session rctime1 --output json
   ```

   观察到：session facts 可恢复。

复现频率：本轮稳定复现。

## 3. 期望 vs 实际

**期望行为**：`RUN_CODE_TIMEOUT` 到达 25s guard 后，CLI 进程及时返回非零状态和结构化错误；Agent 随后可按 SOP 运行 `page current` / `status` / `diagnostics digest` / 拆小步骤继续。

**实际行为**：错误 envelope 已出现，但 CLI 进程没有退出，导致自动化调用方只能依赖外层 timeout，破坏 Agent 恢复链路。

## 4. 环境信息

- 涉及模块 / 功能：managed session command timeout、`pw code`、run-code recovery
- 相关文件 / 函数：`src/engine/session.ts`、`src/engine/shared.ts`
- 运行环境：local，Node 24 + pnpm 10+
- 其他上下文：`auth dc` 真实环境尝试也暴露 `RUN_CODE_TIMEOUT` 后 session probe 不稳定问题；本 issue 只处理 CLI timeout 退出和恢复 contract，不改 auth provider 业务逻辑。

## 5. 严重程度

**P1** — 阻塞 Agent 按 SOP 从 run-code timeout 恢复。功能有绕过方式，但 1.0 recovery contract 不能接受 CLI 进程挂住。

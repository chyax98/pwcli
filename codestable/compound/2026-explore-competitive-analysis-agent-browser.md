---
doc_type: explore
status: reference
area: competitive-reference
summary: "Agent Browser 与同类工具对 pwcli 的稳定差异参考；不作为优先级或 roadmap。"
tags:
  - agent-browser
  - competitive-reference
  - local-cli
---

# Agent Browser 竞品差异参考

这份文档保留竞品差异的稳定判断。它不定义 P0/P1，不承诺时间线，也不替代 GitHub issue / PR。

## 1. 维度对比

| 维度 | 外部工具常见做法 | pwcli 当前判断 |
|---|---|---|
| 页面感知 | DOM、a11y tree、截图、视觉标注、token 压缩 | 优先使用 `read-text`、`snapshot`、`accessibility`、`screenshot`；是否增加视觉标注必须由真实任务证明 |
| 操作执行 | selector/ref、坐标、自然语言 act、planner loop | 保持 Playwright action 薄封装；坐标命令必须状态复查；不内置 planner |
| 证据链 | trace、screenshot、video、console/network、workflow history | `diagnostics` + run artifacts + trace/HAR 是 pwcli 的核心优势 |
| 集成方式 | MCP、SDK、云端浏览器、dashboard | 当前主产品面是本地 CLI + skill；dashboard 是人类观察面，不是 Agent 主链 |
| 运行边界 | Chromium/CDP 或云端容器 | pwcli 基于 Playwright-core，保持本地、三浏览器方向和 named session contract |

## 2. pwcli 已有优势

- named session lifecycle 清晰：`session create|attach|recreate` 是唯一主路。
- 诊断链更深：`diagnostics digest/export/bundle/runs/show/grep/timeline` 与 trace/HAR 形成证据闭环。
- 受控测试能力明确：`route`、`environment`、`bootstrap` 支撑确定性复现。
- 错误恢复面向 Agent：`REF_STALE`、`MODAL_STATE_BLOCKED`、`SESSION_BUSY` 等错误码带恢复路径。
- 产品边界清晰：不把云端托管、完整 Agent loop、外部插件生命周期塞进本地 CLI。

## 3. 可参考但不能直接写成任务的方向

- 视觉标注和 snapshot 压缩可能降低 Agent 上下文成本，但需要先有真实页面任务证据。
- diff、dashboard activity、自然语言 act、自动 state 策略都可能有价值，但不能仅凭竞品存在就进入产品面。
- 安全策略、domain allowlist、操作 policy 只有在真实敏感操作链路中被证明必要时才设计。

## 4. 维护规则

- 如果某个参考方向被真实任务证明为高价值，先建 issue 或设计文档，再进入 implementation。
- 进入 `architecture/` 的只能是已实现 contract、已拍板 ADR、明确 limitation 或稳定扩展口。
- 本文件只记录外部参考，不保存路线图和优先级。

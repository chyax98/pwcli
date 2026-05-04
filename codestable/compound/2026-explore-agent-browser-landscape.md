---
doc_type: explore
status: reference
area: competitive-reference
summary: "Agent 浏览器工具生态的稳定参考维度；不作为 pwcli roadmap 或 backlog。"
tags:
  - agent-browser
  - playwright
  - competitive-reference
---

# Agent Browser 生态稳定参考

这份文档只保留对 `pwcli` 长期有用的外部参考维度。它不是路线图、需求清单或发布承诺。

## 1. 参考对象

| 产品 | 定位 | 可借鉴点 | pwcli 边界 |
|---|---|---|---|
| browser-use | Python Agent 浏览器框架 | DOM + screenshot 双通道、Agent loop 自恢复 | 不内置 Agent planner |
| Stagehand | Playwright 上层 SDK | 确定性 Playwright + AI 原语的 hybrid 思路 | 不做 SDK 级抽象或 schema extraction 产品面 |
| Skyvern | Planner / Actor / Validator 分工的浏览器自动化 | 验证环节和视觉容错思路 | 不做云端 workflow 平台 |
| Playwright MCP | MCP tool surface | a11y tree、screenshot、标准 Playwright action 暴露 | `pwcli` 保持本地 CLI，不把 MCP 作为主产品面 |
| Playwright Codegen | 录制生成 Playwright 脚本 | 确定性代码和调试体验 | 不把录制器变成 pwcli 主链 |
| OpenAI Computer Use | screenshot-first 坐标操作 | 安全接管和视觉循环 | `pwcli` 默认优先 Playwright locator/ref/selector，不以坐标作为主路 |

## 2. 稳定结论

- `pwcli` 的主价值不是替 Agent 做规划，而是提供浏览器事实、动作、等待、验证和失败证据。
- Playwright-core 已覆盖的 primitive 不应重写；`pwcli` 只在 Agent 需要稳定 CLI contract、错误码和恢复提示时封装。
- 视觉、DOM、a11y、trace、screenshot 都是可用证据源，但进入产品前必须有真实 Agent 任务证据。
- 自然语言操作、站点模板、云端浏览器、workflow builder 和完整 Agent loop 都不属于当前默认边界。

## 3. 对 pwcli 的约束

- 优先深化 `read-text`、`snapshot`、`accessibility`、`screenshot`、`diagnostics` 这些“眼”和“证据”能力。
- 交互能力继续围绕现有 `click/fill/type/hover/select/check/uncheck/drag/upload/download/mouse`，并保持动作后 `wait/verify/diagnostics` 闭环。
- 新增能力必须先回答：真实 Agent 任务是什么、现有命令卡在哪里、验证方式是什么。
- 没有证据的外部差距只保留为参考，不进入 architecture active contract。

# 产品边界

`pwcli` 是 Agent-first Playwright CLI：本地薄命令层，向 Agent 暴露浏览器事实、动作、等待/验证、诊断、证据和恢复提示。

## 主链

```text
session create|attach|recreate
  -> status/read-text/snapshot/page/tab
  -> action
  -> wait/verify/get/is/locate
  -> diagnostics/trace/artifacts
  -> Agent 重新规划或使用 pw code
```

## 不做

除非用户明确改变产品边界，否则不做：

- MCP 产品面
- 云端浏览器平台
- extraction recipe 系统
- userscript 市场
- 内置 Agent planner
- 通用 benchmark 平台
- route/mock DSL 平台
- 外部 auth plugin lifecycle

## 产品纪律

- 优先使用 Playwright-core primitive，只为 Agent 可读 contract、错误、证据和恢复做薄封装。
- 新能力必须对应真实 Agent 阻塞任务。
- `route` / `environment` / `bootstrap` 是受控测试工具，不是场景平台。
- `code` 是逃生口，不是长流程 runner。

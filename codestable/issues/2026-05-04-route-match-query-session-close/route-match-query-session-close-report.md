---
doc_type: issue-report
issue: 2026-05-04-route-match-query-session-close
status: confirmed
severity: P1
summary: "route add --match-query-file 命中请求后关闭 browser session，破坏 controlled-testing workflow。"
tags:
  - route
  - mock
  - controlled-testing
  - command-contract
---

# route match query 关闭 session Issue Report

## 1. 问题现象

`command-eval-route-mock-bootstrap` focused check 中，使用 query matcher 后触发匹配请求：

```bash
pw route add '**/api/query*' --session rqf183 --method GET --match-query-file match-query.json --status 208 --content-type application/json --body '{"message":"query-matched"}'
pw click --session rqf183 --selector '#fetch-query' --output json
```

`click` 返回失败：

```json
{
  "ok": false,
  "command": "click",
  "error": {
    "code": "CLICK_FAILED",
    "message": "Session closed"
  }
}
```

随后 `pw session status rqf183 --output json` 显示 `active=false`。

## 2. 复现步骤

1. `pnpm build`
2. 启动本地页面，按钮点击后请求 `/api/query?token=abc`。
3. `pw session create <name> --no-headed --open <fixture-url>`
4. `pw route add '**/api/query*' --session <name> --method GET --match-query-file match-query.json --status 208 --content-type application/json --body '{"message":"query-matched"}'`
5. `pw click --session <name> --selector '#fetch-query' --output json`

复现频率：稳定复现。

## 3. 期望 vs 实际

**期望行为**：query matcher 命中后 route fulfill 返回 mock 响应，session 保持 active，Agent 可继续执行后续 workflow。

**实际行为**：命中 query matcher 后 browser session 被关闭，后续 action/read 命令失败。

## 4. 环境信息

- Node：`v24.12.0`
- pnpm：`10.33.0`
- `playwright-core`：`1.59.1`
- 相关文件：
  - `src/engine/diagnose/route.ts`
  - `scripts/test/route-query-header-match.test.ts`

## 5. 严重程度

**P1** — route/mock 是 controlled-testing 和复现 workflow 的核心能力；query matcher 一命中就关闭 session，会让 Agent 的受控测试链路中断。

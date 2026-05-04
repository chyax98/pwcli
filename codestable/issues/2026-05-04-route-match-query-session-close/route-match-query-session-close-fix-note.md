---
doc_type: issue-fix-note
issue: 2026-05-04-route-match-query-session-close
status: fixed
path: fastforward
severity: P1
root_cause_type: runtime-contract
tags:
  - route
  - mock
  - controlled-testing
---

# route match query 关闭 session Fix Note

## 1. 根因

`src/engine/diagnose/route.ts` 的 query matcher 在 route handler 中使用：

```js
new URL(request.url())
```

但该 handler 通过 Playwright `browser_run_code` 安装，运行环境没有 Node/浏览器全局 `URL`：

```bash
pw code --session <name> "async page => JSON.stringify({ URLType: typeof URL })"
```

返回：

```json
{"URLType":"undefined"}
```

因此 `--match-query-file` 命中请求时 handler 抛错，browser session 被关闭。

## 2. 修复内容

- 在 route handler 字符串内部实现自包含 query parser。
- 不依赖 `URL` / `URLSearchParams` 全局对象。
- matcher 比较时把 JSON 文件中的 value 转成 string，保持 query string 语义。
- 同步更新 `scripts/test/route-query-header-match.test.ts`：
  - 使用当前唯一命令面 `--match-query-file` / `--match-headers-file` / `--match-json-file` / `--patch-text-file`
  - 真实点击页面触发 fetch
  - `wait --text mocked`
  - `session status` 确认 session 仍 active
- 不恢复旧 `--match-query` / `--match-header` / `--match-json` / `--patch-text` flag。

## 3. 验证

RED：

```bash
pw route add '**/api/query*' --session rqf183 --method GET --match-query-file match-query.json --status 208 --content-type application/json --body '{"message":"query-matched"}'
pw click --session rqf183 --selector '#fetch-query' --output json
```

修复前失败为 `CLICK_FAILED: Session closed`。

GREEN：

```bash
pnpm build
pnpm exec tsx scripts/test/route-query-header-match.test.ts
```

完整 focused check：

```bash
node /tmp/pwcli-route-mock-eval-bhvZi1/harness.mjs /tmp/pwcli-route-mock-eval-bhvZi1 /tmp/pwcli-route-mock-eval-bhvZi1/port.txt
```

结果：

```text
route/mock/bootstrap focused check passed
evidence directory: /tmp/pwcli-route-mock-eval-bhvZi1
routeCountAfterAdd: 9
bootstrapAfterRecreate: {"boot":0,"header":"boot-header"}
```

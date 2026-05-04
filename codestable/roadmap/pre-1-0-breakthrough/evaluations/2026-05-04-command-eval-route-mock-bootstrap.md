---
doc_type: evaluation
slug: command-eval-route-mock-bootstrap
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, route, mock, bootstrap, code]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-route-mock-bootstrap
---

# Command Evaluation: Route / Mock / Bootstrap / Code

## 范围

本轮覆盖本地受控测试 substrate：

- `route add`
- `route list`
- `route remove`
- `bootstrap apply`
- `code`

验证维度：

- `route add` 覆盖 fulfill、method、query/header/body/json matcher、inject headers、JSON patch、text patch、abort。
- `route list` 返回 active route metadata。
- `route remove <pattern>` 和 `route remove` 能分别清单条和全部规则。
- `bootstrap apply` 覆盖 init script、extra headers、持久化配置、`session recreate` 重放和 `--remove-init-script`。
- `pw code` 覆盖 inline source、`--file`、`--retry`。

不扩大范围：

- 顶层 `pw route load` 不是当前 shipped command，不恢复。
- `batch` 内部 route 子集归 `command-eval-batch-code-dashboard-skill-sse` 继续验证。
- `pw code` 不是长流程 runner；`RUN_CODE_TIMEOUT` 归 recovery 专项。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `route add` | proven | fulfill/method/match-query/match-headers/match-body/match-json/inject/patch-json/patch-text/abort 均真实命中 |
| `route list` | proven | 9 条 active routes metadata 可查询 |
| `route remove` | proven | 指定 pattern 删除 1 条；无 pattern 清空剩余 8 条 |
| `bootstrap apply` | proven | init script + headers live apply；remove-init-script 后 recreate 只重放 headers |
| `code` | proven | inline、file、retry 均返回预期 JSON result |

## focused check

本轮使用独立本地 HTTP fixture，避免 test harness 阻塞 server event loop：

```bash
pnpm build
pw session create rtxtsubn --no-headed --open http://127.0.0.1:60814 --output json
pw code --session rtxtsubn '<inline title/url probe>' --output json
pw code --session rtxtsubn --file /tmp/pwcli-route-mock-eval-bhvZi1/code-file.js --output json
pw code --session rtxtsubn '<transient failure then success>' --retry 1 --output json
pw route add '**/api/hello*' --method GET --status 207 --content-type application/json --body '{"message":"mocked-get"}' --session rtxtsubn --output json
pw route add '**/api/query*' --method GET --match-query-file /tmp/pwcli-route-mock-eval-bhvZi1/match-query.json --status 208 --content-type application/json --body '{"message":"query-matched"}' --session rtxtsubn --output json
pw route add '**/api/header-match' --method GET --match-headers-file /tmp/pwcli-route-mock-eval-bhvZi1/match-headers.json --status 209 --content-type application/json --body '{"message":"header-matched"}' --session rtxtsubn --output json
pw route add '**/api/body-match' --method POST --match-body needle --status 210 --content-type application/json --body '{"message":"body-matched"}' --session rtxtsubn --output json
pw route add '**/api/json-match' --method POST --match-json-file /tmp/pwcli-route-mock-eval-bhvZi1/match-json.json --status 211 --content-type application/json --body '{"message":"json-matched"}' --session rtxtsubn --output json
pw route add '**/api/echo-header' --inject-headers-file /tmp/pwcli-route-mock-eval-bhvZi1/inject-headers.json --session rtxtsubn --output json
pw route add '**/api/source-json' --patch-json-file /tmp/pwcli-route-mock-eval-bhvZi1/patch-json.json --patch-status 299 --merge-headers-file /tmp/pwcli-route-mock-eval-bhvZi1/merge-headers.json --session rtxtsubn --output json
pw route add '**/api/source-text' --patch-text-file /tmp/pwcli-route-mock-eval-bhvZi1/patch-text.json --patch-status 298 --session rtxtsubn --output json
pw route add '**/api/abort' --abort --session rtxtsubn --output json
pw route list --session rtxtsubn --output json
pw click/wait ... # 逐个触发并验证 9 类 route 行为
pw route remove '**/api/hello*' --session rtxtsubn --output json
pw route remove --session rtxtsubn --output json
pw bootstrap apply --session rtxtsubn --init-script /tmp/pwcli-route-mock-eval-bhvZi1/bootstrap-init.js --headers-file /tmp/pwcli-route-mock-eval-bhvZi1/bootstrap-headers.json --output json
pw open http://127.0.0.1:60814/?boot=1 --session rtxtsubn --output json
pw code --session rtxtsubn '<boot/header probe>' --output json
pw bootstrap apply --session rtxtsubn --remove-init-script /tmp/pwcli-route-mock-eval-bhvZi1/bootstrap-init.js --output json
pw session recreate rtxtsubn --no-headed --open http://127.0.0.1:60814/?after-recreate --output json
pw code --session rtxtsubn '<recreate boot/header probe>' --output json
pw session close rtxtsubn --output json
```

结果：

```text
route/mock/bootstrap focused check passed
evidence directory: /tmp/pwcli-route-mock-eval-bhvZi1
session: rtxtsubn
routeCountAfterAdd: 9
bootstrapAfterRecreate: {"boot":0,"header":"boot-header"}
```

## 关键发现与修复

### P1：`route add --match-query-file` 命中后关闭 session

RED：

```bash
pw route add '**/api/query*' --session rqf183 --method GET --match-query-file match-query.json --status 208 --content-type application/json --body '{"message":"query-matched"}'
pw click --session rqf183 --selector '#fetch-query' --output json
```

修复前 `click` 返回：

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

根因：route handler 运行在 Playwright `browser_run_code` 环境，该环境没有 Node/浏览器全局 `URL`；旧实现用 `new URL(request.url())` 解析 query，命中 query matcher 时 handler 抛错并导致 browser session 关闭。

修复：`src/engine/diagnose/route.ts` 改为 handler 内自包含 query parser，不依赖 `URL` / `URLSearchParams` 全局，也不增加旧 flag fallback。

回归：

```bash
pnpm build
pnpm exec tsx scripts/test/route-query-header-match.test.ts
```

## 后续

- `command-eval-batch-code-dashboard-skill-sse` 继续覆盖 batch 内部 route 子集，不把顶层 `route load` 写成 shipped command。
- `run-code-timeout-recovery-breakthrough` 继续覆盖 `pw code` 长流程 timeout 恢复，不把 `pw code` 扩成 workflow runner。

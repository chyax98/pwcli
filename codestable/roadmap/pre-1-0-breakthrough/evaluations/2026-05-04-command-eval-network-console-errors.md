---
doc_type: evaluation
slug: command-eval-network-console-errors
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, network, console, errors, sse]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-network-console-errors
---

# Command Evaluation: Network / Console / Errors / SSE

## 范围

本轮覆盖 live session 观测命令：

- `console`
- `network`
- `errors recent`
- `errors clear`
- `sse`

验证维度：

- console level / text / limit。
- network method / URL / status / text / kind / request-id / current / include-body。
- request/response snippet 与 full body 的边界。
- requestfailed 记录。
- pageerror recent/current/clear。
- SSE url / limit 过滤。
- navigation 后 `--current` 只返回当前 navigation 的信号，过滤旧页面噪声。

不扩大范围：

- `diagnostics digest/export/bundle/runs/show/grep/timeline` 已在 `command-eval-diagnostics-runs` 完成。
- trace/HAR/video artifact 归 `command-eval-trace-har-video-artifacts`。
- route/mock 对网络请求的主动控制归 `command-eval-route-mock-bootstrap`。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `console` | proven | `--level error|warning`、`--text`、`--current` 均通过 |
| `network` | proven | method/url/status/text/kind/request-id/current/include-body 均通过 |
| `errors recent` | proven | pageerror text filter 和 `--current` 均通过 |
| `errors clear` | proven | clear 后旧 pageerror 不再出现在 recent baseline |
| `sse` | proven | EventSource 事件记录可按 url 和 limit 查询 |

## focused check

本轮使用本地 HTTP + SSE 夹具：

```bash
pw session create ncqeorje --headless --open http://127.0.0.1:59040/ --output json
pw diagnostics digest --session ncqeorje --limit 5 --output json
pw code --session ncqeorje '<trigger console/pageerror/fetch/sse>' --output json
pw console --session ncqeorje --level error --text console-dogfood-error --limit 5 --output json
pw console --session ncqeorje --level warning --text console-dogfood-warning --limit 5 --output json
pw network --session ncqeorje --method POST --url /api/echo --limit 5 --output json
pw network --session ncqeorje --method POST --url /api/echo --include-body --limit 5 --output json
pw network --session ncqeorje --status 500 --text server-failure-marker --limit 5 --output json
pw network --session ncqeorje --kind requestfailed --url /api/drop --limit 5 --output json
pw network --session ncqeorje --request-id req-3 --include-body --output json
pw sse --session ncqeorje --url sse-marker --limit 10 --output json
pw errors recent --session ncqeorje --current --text pageerror-dogfood-current --limit 5 --output json
pw open http://127.0.0.1:59040/after-nav --session ncqeorje --output json
pw console --session ncqeorje --current --text console-dogfood-error --limit 5 --output json
pw network --session ncqeorje --current --url /api/ --limit 10 --output json
pw errors recent --session ncqeorje --current --text pageerror-dogfood-current --limit 5 --output json
pw errors clear --session ncqeorje --output json
pw session close ncqeorje --output json
```

结果：

```text
network-console focused check passed
evidence directory: /tmp/pwcli-network-console-eval-ncqeorje
requestId: req-3
```

关键 envelope：

```json
{
  "network": {
    "request": {
      "kind": "request",
      "requestBodySnippet": "request-body-marker",
      "requestBody": "hidden by default"
    },
    "response": {
      "kind": "response",
      "status": 201,
      "responseBodySnippet": "contains response-body-marker",
      "responseBody": "hidden by default"
    },
    "includeBody": {
      "requestBody": "request-body-marker",
      "responseBody": "contains response-body-marker"
    },
    "requestfailed": "covered via /api/drop"
  },
  "currentAfterNavigation": {
    "console": 0,
    "networkApi": 0,
    "errors": 0
  }
}
```

## 关键发现

- `network` 的 request 和 response 是两条记录。默认输出隐藏 full body，但 request 记录带 `requestBodySnippet`，response 记录带 `responseBodySnippet`。
- `--include-body` 只在相应 request/response 记录上补 `requestBody` / `responseBody`，不会把两条记录合并成一条。
- `--current` 的语义是当前 navigationId 过滤；导航后旧 console/network/pageerror 记录仍存在，但不会污染 current 查询。
- `sse` 记录来自 diagnostics export 的 `sse` section，适合 EventSource 观察，不替代通用 network 查询。
- `errors clear` 是 baseline clear，不删除历史底层记录。

## 后续

- `network` 与 route/mock 的串联验证放入 `command-eval-route-mock-bootstrap`。
- `diagnostics timeline` 对 console/network/errors 的高信号归因已在 diagnostics 评测覆盖，后续 workflow 继续用真实 bug 场景验证。

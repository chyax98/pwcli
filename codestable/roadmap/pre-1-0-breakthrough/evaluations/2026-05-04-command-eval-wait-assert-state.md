---
doc_type: evaluation
slug: command-eval-wait-assert-state
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, wait, assert, state]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-wait-assert-state
---

# Command Evaluation: Wait / Assert / State

## 范围

本轮覆盖：

- `wait`
- `verify`
- `get`
- `is`
- `locate`

验证维度：

- wait selector / text / hidden / detached / response status / network-idle
- verify text / text-absent / url contains / url matches / visible / hidden / enabled / disabled / checked / unchecked / count equals / count range / failure envelope
- get text / value / count
- is visible / enabled / checked / missing=false / unchecked=false
- locate `--nth`

不扩大范围：

- response wait 需要未来网络事件；本轮用 15s browser timer 触发，不把“先触发再 wait”写成 SOP。
- wait failure timeout 的完整 recovery 归 `run-code-timeout-recovery-breakthrough`。
- stale ref 和 navigation changed 归 page/workspace 与 recovery 专项。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `wait` | proven | selector/text/state/response/network-idle 全部通过 |
| `verify` | proven | 正向断言、negative assertion、count、failure envelope 全部通过 |
| `get` | proven | text/value/count 全部通过 |
| `is` | proven | true 和 false 状态都通过 |
| `locate` | proven | `--nth 2` 保留总 count，返回第二个候选 |

## focused check

wait 侧 session：

```bash
node scripts/e2e/dogfood-server.js 43299
node dist/cli.js session create wa101 --no-headed --open http://127.0.0.1:43299/login --output json
node dist/cli.js wait --session wa101 --selector '#title' --output json
node dist/cli.js wait --session wa101 --text 'Ready text' --output json
node dist/cli.js wait --session wa101 --selector '#hidden' --state hidden --output json
node dist/cli.js wait --session wa101 --selector '#gone' --state detached --output json
node dist/cli.js wait --session wa101 --response '/api/offline/ping' --status 200 --output json
node dist/cli.js wait --session wa101 network-idle --output json
node dist/cli.js session close wa101 --output json
```

assert/state 侧 session：

```bash
node scripts/e2e/dogfood-server.js 43300
node dist/cli.js session create va102 --no-headed --open http://127.0.0.1:43300/login --output json
node dist/cli.js verify --session va102 --assertion text --text 'Ready text' --output json
node dist/cli.js verify --session va102 --assertion text-absent --text 'Missing text' --output json
node dist/cli.js verify --session va102 --assertion url --contains '/login' --output json
node dist/cli.js verify --session va102 --assertion url --matches '127\.0\.0\.1:.*/login' --output json
node dist/cli.js verify --session va102 --assertion visible --selector '#title' --output json
node dist/cli.js verify --session va102 --assertion hidden --selector '#hidden' --output json
node dist/cli.js verify --session va102 --assertion enabled --selector '#enabled' --output json
node dist/cli.js verify --session va102 --assertion disabled --selector '#disabled' --output json
node dist/cli.js verify --session va102 --assertion checked --selector '#checked' --output json
node dist/cli.js verify --session va102 --assertion unchecked --selector '#unchecked' --output json
node dist/cli.js verify --session va102 --assertion count --selector '.row' --equals 2 --output json
node dist/cli.js verify --session va102 --assertion count --selector '.row' --min 1 --max 3 --output json
node dist/cli.js verify --session va102 --assertion text --text 'Definitely missing' --output json
node dist/cli.js get --session va102 --selector '#title' --fact text --output json
node dist/cli.js get --session va102 --selector '#enabled' --fact value --output json
node dist/cli.js get --session va102 --selector '.row' --fact count --output json
node dist/cli.js is --session va102 --selector '#missing' --state visible --output json
node dist/cli.js is --session va102 --selector '#unchecked' --state checked --output json
node dist/cli.js locate --session va102 --selector '.row' --nth 2 --output json
node dist/cli.js session close va102 --output json
```

结果：

```text
wait-assert-state focused check passed
```

摘要：

```json
{
  "waitSession": "wa101",
  "assertSession": "va102",
  "wait": ["selector", "text", "hidden", "detached", "response 200", "network-idle"],
  "verify": ["text", "text-absent", "url contains", "url matches", "visible", "hidden", "enabled", "disabled", "checked", "unchecked", "count equals", "count range", "failure envelope"],
  "get": { "text": "Ready text", "value": "abc", "count": 2 },
  "isFalse": { "missingVisible": false, "uncheckedChecked": false },
  "locateNth": { "index": 2, "text": "Row B" }
}
```

## 修复记录

本轮评测发现 `wait --state` 出现在 CLI help 和文档中，但没有进入 engine：

- `src/cli/commands/wait.ts` 未传 `state`。
- `src/engine/act/page.ts` 对 selector wait 固定使用默认 visible。
- `src/cli/batch/executor.ts` 的 batch wait 子集也不识别 `--state`。

已修复：

- `wait --selector <selector> --state visible|hidden|stable|attached|detached` 进入唯一 `managedWait` 实现。
- batch wait 同步支持 `--state`。
- 新增回归：`wait --state hidden honors selector state`。

## 关键发现

- `verify` 失败会退出非零，JSON envelope 为 `VERIFY_FAILED`，包含 `retryable: true` 和 suggestions；不能把失败断言当作普通 `ok: true` 结果处理。
- `wait --response` 只能捕获未来 response。评测中如果先触发 fetch 再执行 wait，会超时；Agent SOP 里应强调先安排未来触发或在动作后用 network/diagnostics 查已发生事件。
- `wait --text` 当前返回 `condition: "text"`，而 selector/state/response 返回结构化 condition；后续 evidence contract 如需统一，再单独设计，不在本轮顺手改。

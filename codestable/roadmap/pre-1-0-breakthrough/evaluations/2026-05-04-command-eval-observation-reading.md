---
doc_type: evaluation
slug: command-eval-observation-reading
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, observation, reading]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-observation-reading
---

# Command Evaluation: Observation / Reading

## 范围

本轮覆盖 Agent 首读和页面事实读取主链：

- `status`
- `observe`
- `page current`
- `page list`
- `page frames`
- `read-text`
- `text`
- `snapshot -i`
- `locate --return-ref`
- `get --fact text`
- `is --state visible`
- `verify --assertion text`
- `verify --assertion url`
- `accessibility --interactive-only`

不扩大范围：

- `page dialogs` / `page assess` 留到 `command-eval-page-tab-workspace`。
- `is` / `verify` 的完整 assertion matrix 留到 `command-eval-wait-assert-state`。
- stale ref 写操作恢复留到 `command-eval-page-tab-workspace` 和 recovery breakthrough。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `status` | proven | 返回当前 URL/title、workspace、diagnostics 摘要 |
| `observe` | proven | 名称兼容到 `status`，JSON `command` 为 `status` |
| `page current/list/frames` | proven for reading subset | 返回 pageId、navigationId、page/frame count |
| `read-text` | proven | 低噪声返回 body visible text，登录页 160 chars |
| `text` | proven | 名称兼容到 `read-text`，输出 command 为 `read-text` |
| `snapshot -i` | proven | 返回 `mode: interactive` 和 fresh refs |
| `locate --return-ref` | proven | 修复并验证 checked checkbox 场景可返回 fresh ref |
| `get --fact text` | proven | `h1` 文本读取准确 |
| `is --state visible` | proven for basic state | `#login-submit` 可见返回 `value: true` |
| `verify text/url` | proven for basic assertion | 文本和 URL 断言返回 `passed: true` |
| `accessibility --interactive-only` | proven | 返回 `aria-yaml`，包含交互节点 |

## focused check

本地 fixture：

```bash
node scripts/e2e/dogfood-server.js 43292
```

主链：

```bash
node dist/cli.js session create obs95 --no-headed --open http://127.0.0.1:43292/login --output json
node dist/cli.js status --session obs95 --output json
node dist/cli.js observe --session obs95 --output json
node dist/cli.js page current --session obs95 --output json
node dist/cli.js page list --session obs95 --output json
node dist/cli.js page frames --session obs95 --output json
node dist/cli.js read-text --session obs95 --max-chars 1200 --output json
node dist/cli.js text --session obs95 --max-chars 1200 --output json
node dist/cli.js snapshot --session obs95 -i --output json
node dist/cli.js locate --session obs95 --text 'Remember me' --return-ref --output json
node dist/cli.js get --session obs95 --selector 'h1' --fact text --output json
node dist/cli.js is --session obs95 --selector '#login-submit' --state visible --output json
node dist/cli.js verify --session obs95 --assertion text --text 'Remember me' --output json
node dist/cli.js verify --session obs95 --assertion url --contains '/login' --output json
node dist/cli.js accessibility --session obs95 --interactive-only --output json
node dist/cli.js session close obs95 --output json
```

结果：

```text
observation-reading focused check passed
```

摘要：

```json
{
  "url": "http://127.0.0.1:43292/login",
  "title": "pwcli dogfood login",
  "pageCount": 1,
  "frameCount": 1,
  "readTextChars": 160,
  "snapshotMode": "interactive",
  "locateCandidates": 1,
  "locateRef": "e14",
  "accessibilityFormat": "aria-yaml"
}
```

## 修复记录

本轮评测发现 `locate --return-ref` 在 checkbox checked 场景下没有返回 ref。根因有两层：

1. `findRefInSnapshot` 假设 snapshot 行格式为 `role "text" [ref=eN]`，但 checked checkbox 是 `checkbox "Remember me" [checked] [ref=e14]`。
2. `locate` 命令把 `--return-ref` 解析成空字符串，且 `ref` alias 与 locator `--ref` 语义冲突。

已修复：

- snapshot ref 解析改为分别读取 role、quoted text 和 ref，不再假设字段顺序。
- `locate` 删除 `ref` alias，只保留清晰的 `--return-ref`。
- 新增回归：`locate --return-ref returns refs for checked controls`。

## 后续

- `page dialogs` / `page assess` 在 workspace identity 评测中继续覆盖。
- `is` / `verify` 的 hidden/enabled/checked/count/negative/timeout 组合在 wait/assert 评测中继续覆盖。
- action 命令使用 `locate --return-ref` 产出的 fresh ref 串联验证，放入 `command-eval-interaction-input`。

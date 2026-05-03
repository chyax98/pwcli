---
doc_type: evaluation
slug: command-eval-interaction-input
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, interaction, input]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-interaction-input
---

# Command Evaluation: Interaction / Input

## 范围

本轮覆盖页面动作主链：

- `fill`
- `type`
- `click`
- `press`
- `check`
- `uncheck`
- `select`
- `hover`
- `scroll`
- `mouse move`
- `mouse click`
- `mouse wheel`
- `resize`
- `upload`
- `drag`
- `download`

不扩大范围：

- `mouse dblclick` / `mouse drag` 的坐标专项留到后续 workflow 或 mouse 专项补充。
- stale ref、modal blocked、navigation changed 失败恢复留到 page/workspace 和 recovery breakthrough。
- 本轮 select / hover / mouse 使用受控 DOM 注入补足 dogfood 页面没有原生控件的部分；这只是评测夹具，不进入产品 contract。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `fill` | proven | 写入 email，清空 password，`get value` 验证 |
| `type` | proven | typed-secret 输入 password，`get value` 验证 |
| `click` | proven | 点击 password 聚焦，点击 login 触发登录导航 |
| `press` | proven | `Tab` 后 active element 变为 `remember-me` |
| `uncheck` | proven | checkbox 变为 unchecked，`is checked` 为 false |
| `check` | proven | checkbox 变为 checked，`is checked` 为 true |
| `select` | proven | 受控 select 选择 high，`get value` 验证 |
| `hover` | proven | hover 触发页面状态变为 `hover: active` |
| `scroll` | proven | `scroll down 500` 返回 `scrolled: true` |
| `mouse` | proven | move/click/wheel 均返回 acted；click 触发页面状态 |
| `resize` | proven | viewport 调整到 390x844，并用 `innerWidth/innerHeight` 验证 |
| `upload` | proven | 上传 `upload.txt`，页面显示文件名 |
| `drag` | proven | 拖动卡片到 done lane，页面状态更新 |
| `download` | proven | 下载 `dogfood-report.txt`，本地文件存在且内容匹配 |

## focused check

本地 fixture：

```bash
node scripts/e2e/dogfood-server.js 43293
```

主链摘要：

```bash
node dist/cli.js session create int97 --no-headed --open http://127.0.0.1:43293/login --output json
node dist/cli.js fill --session int97 --selector '#email' agent@example.com --output json
node dist/cli.js fill --session int97 --selector '#password' --output json
node dist/cli.js type --session int97 --selector '#password' typed-secret --output json
node dist/cli.js click --session int97 --selector '#password' --output json
node dist/cli.js press --session int97 Tab --output json
node dist/cli.js uncheck --session int97 --selector '#remember-me' --output json
node dist/cli.js check --session int97 --selector '#remember-me' --output json
node dist/cli.js click --session int97 --selector '#login-submit' --output json
node dist/cli.js wait --session int97 --selector '#project-alpha' --output json
node dist/cli.js open --session int97 http://127.0.0.1:43293/app/projects/alpha/incidents/checkout-timeout/reproduce --output json
node dist/cli.js select --session int97 --selector '#priority-select' high --output json
node dist/cli.js hover --session int97 --selector '#hover-target' --output json
node dist/cli.js scroll --session int97 down 500 --output json
node dist/cli.js mouse move --session int97 40 40 --output json
node dist/cli.js mouse click --session int97 40 40 --output json
node dist/cli.js mouse wheel --session int97 0 250 --output json
node dist/cli.js upload --session int97 --selector '#upload-input' /tmp/pwcli-interaction-eval/upload.txt --output json
node dist/cli.js drag --session int97 --from-selector '#drag-card-a' --to-selector '#drag-lane-done' --output json
node dist/cli.js download --session int97 --selector '#download-report' --dir /tmp/pwcli-interaction-eval/downloads --output json
node dist/cli.js session close int97 --output json
```

`resize` 补充：

```bash
node dist/cli.js session create rsz98 --no-headed --open about:blank --output json
node dist/cli.js resize --session rsz98 --width 390 --height 844 --output json
node dist/cli.js code --session rsz98 'async page => await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))' --output json
node dist/cli.js session close rsz98 --output json
```

结果：

```text
interaction-input focused check passed
resize focused check passed
```

摘要：

```json
{
  "session": "int97",
  "url": "http://127.0.0.1:43293/app/projects/alpha/incidents/checkout-timeout/reproduce",
  "activeAfterTab": "remember-me",
  "selectedValue": "high",
  "uploadText": "upload-result: upload.txt",
  "dragText": "drag-status: moved triage customer report",
  "downloadFile": "/tmp/pwcli-interaction-eval/downloads/dogfood-report.txt",
  "resize": {
    "width": 390,
    "height": 844
  }
}
```

## 关键发现

- action 命令都返回了 `diagnosticsDelta`，后续 diagnostics 评测需要继续验证 delta 的可解释性和 run evidence。
- `hover` 的成功字段是通用 `acted: true`，不是 `hovered: true`；评测脚本已按 shipped contract 校正。
- `pw code` 的输入 contract 是 `async page => ...`，不是浏览器全局表达式。本轮只把它作为受控夹具和验证工具使用。
- `select`、`hover`、坐标 `mouse click` 在 dogfood 页面缺少天然验证控件，使用受控 DOM 注入验证 command 行为；后续 workflow 如需要，应补真实页面场景而不是把注入脚本当用户 SOP。

## 后续

- `mouse dblclick` / `mouse drag` 需要在后续 workflow 或 mouse 专项里补证据。
- stale ref、modal blocked、navigation changed 的 action 失败恢复在 `command-eval-page-tab-workspace` 和 recovery breakthrough 中继续覆盖。
- `wait` / `verify` 的动作后等待和断言矩阵进入下一轮 `command-eval-wait-assert-state`。

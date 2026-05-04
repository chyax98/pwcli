---
doc_type: evaluation
slug: command-eval-environment-controls
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, environment, offline, geolocation, permissions, clock]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-environment-controls
---

# Command Evaluation: Environment Controls

## 范围

本轮覆盖已有 BrowserContext 的本地环境控制：

- `environment offline on|off`
- `environment geolocation set`
- `environment permissions grant|clear`
- `environment clock install|set|resume`

验证维度：

- offline on 后真实 fetch 失败，并在 console/network diagnostics 中留下 `ERR_INTERNET_DISCONNECTED`。
- offline off 后同一 fetch 恢复成功。
- permissions grant + geolocation set 后页面侧 `navigator.geolocation.getCurrentPosition()` 返回设定坐标。
- permissions clear 返回空 granted state。
- clock set 前未 install 返回明确失败。
- clock install → set 后页面侧 `new Date().toISOString()` 返回固定时间。
- clock resume 命令成功返回。

不扩大范围：

- environment 不负责 session 创建、profile、headed shape。
- environment 不 mock API 响应；mock 响应走 `route`。
- clock 只验证 Playwright substrate 暴露的本地时间控制，不做完整时间平台。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `environment offline on` | proven | fetch `/api/ping` 失败，network 记录 `requestfailed net::ERR_INTERNET_DISCONNECTED` |
| `environment offline off` | proven | 同一 fetch 恢复为 200 + `pong` |
| `environment permissions grant` | proven | grant `geolocation` 后页面 geolocation 可读取 |
| `environment geolocation set` | proven | 页面侧返回 lat `37.7749`、lng `-122.4194`、accuracy `12` |
| `environment permissions clear` | proven | 返回 `granted: []`、`cleared: true` |
| `environment clock install` | proven | 返回 `installed=true`，source 为 `context.clock` |
| `environment clock set` | proven | install 后 set 固定时间，页面侧 `Date` 返回 `2024-12-10T10:00:00.000Z` |
| `environment clock resume` | proven | 返回 `lastAction=resume` |

## focused check

本轮使用本地 HTTP fixture：

```bash
pw session create env27715 --no-headed --open http://127.0.0.1:61242 --output json
pw environment offline on --session env27715 --output json
pw click --session env27715 --selector '#ping' --output json
pw wait --session env27715 --text offline: --output json
pw environment offline off --session env27715 --output json
pw click --session env27715 --selector '#ping' --output json
pw wait --session env27715 --text pong --output json
pw environment permissions grant geolocation --session env27715 --output json
pw environment geolocation set --session env27715 --lat 37.7749 --lng -122.4194 --accuracy 12 --output json
pw code --session env27715 '<page.evaluate navigator.geolocation probe>' --output json
pw environment permissions clear --session env27715 --output json
pw environment clock set --session env27715 2024-12-10T10:00:00.000Z --output json
pw environment clock install --session env27715 --output json
pw environment clock set --session env27715 2024-12-10T10:00:00.000Z --output json
pw code --session env27715 '<page.evaluate new Date().toISOString()>' --output json
pw environment clock resume --session env27715 --output json
pw status --session env27715 --output json
pw diagnostics digest --session env27715 --output json
pw session close env27715 --output json
```

结果：

```text
environment focused check passed
evidence directory: /tmp/pwcli-env-eval-RfrxjI
session: env27715
geo: {"lat":37.7749,"lng":-122.4194,"accuracy":12}
clock: 2024-12-10T10:00:00.000Z
preinstallCode: ENVIRONMENT_CLOCK_SET_FAILED
```

## 关键发现

- `pw code` 的 source 运行在 Playwright run-code 环境，页面 API 必须通过 `page.evaluate()` 读取；直接读 `navigator` 会返回 `ReferenceError: navigator is not defined`。这是评测脚本错误，不是 environment product bug。
- `environment clock set` 在未 install 时当前 CLI envelope code 为 `ENVIRONMENT_CLOCK_SET_FAILED`，message 内包含 `CLOCK_REQUIRES_INSTALL:Clock install must run before clock set on a managed session.`。Skill 需要按真实 envelope 描述，不把内层 code 写成顶层 code。
- `status` 当前不展示 `environment` 独立分组；本轮只把 offline 通过 console/network diagnostics 间接证明，把 environment state 输出以各命令 envelope 为准。

## 后续

- `workflow-eval-automated-testing` 需要把 route + environment + verify 串起来，而不是只看单 command。
- `run-code-timeout-recovery-breakthrough` 继续覆盖 run-code lane 的 `ENVIRONMENT_LIMITATION` 恢复。

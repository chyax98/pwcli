---
doc_type: validation-evidence
roadmap: project-completion
item: agent-scenario-deep-validation
status: partial
date: 2026-05-04
scenario: browser-automation-and-diagnostics
tags:
  - agent-dogfood
  - validation
  - diagnostics
---

# Agent Dogfood：浏览器自动化与诊断最小场景

## 结论

本轮按 `skills/pwcli/` 主链真实使用 `pw`，完成了：

- 新建 named session 并打开页面。
- 读取页面事实：`status`、`read-text`、`snapshot -i`。
- 通过 snapshot ref 和 selector 完成登录表单、跨页面导航、等待和文本验证。
- 触发一个受控 500 复现路径，并用 diagnostics 找到 console/network 证据。
- 导出 network evidence，并生成 diagnostics bundle manifest。

结论：浏览器自动化 + Deep Bug 复现/诊断的最小闭环可用；但 dogfood 同时暴露 `environment geolocation set` 的 skill/help/参数 contract 漂移，已记录为 issue。

## 环境

- Node：`v24.12.0`
- pnpm：`10.33.0`
- server：`scripts/e2e/dogfood-server.js 43280`
- session：`agdog1`
- URL：`http://127.0.0.1:43280/login`

## 执行链路

```bash
pw session create agdog1 --no-headed --open http://127.0.0.1:43280/login
pw status -s agdog1
pw read-text -s agdog1 --max-chars 1200
pw snapshot -i -s agdog1
pw fill -s agdog1 --label Email agent@example.com
pw fill -s agdog1 --label Password pwcli-secret
pw click e17 -s agdog1
pw wait -s agdog1 --selector '#project-alpha'
pw verify text -s agdog1 --text Projects
pw click -s agdog1 --selector '#project-alpha'
pw click -s agdog1 --selector '#alpha-incidents'
pw click -s agdog1 --selector '#incident-checkout-timeout'
pw click -s agdog1 --selector '#open-reproduce'
pw verify text -s agdog1 --text 'checkout-timeout reproduce'
pw errors clear -s agdog1
pw click -s agdog1 --selector '#load-summary'
pw wait -s agdog1 --text 'summary-result: checkout-timeout / high'
pw click -s agdog1 --selector '#trigger-bug'
pw wait -s agdog1 --text 'bug-result: CHECKOUT_TIMEOUT'
pw diagnostics digest -s agdog1
pw console -s agdog1 --level error --limit 10
pw network -s agdog1 --status 500 --limit 10
pw errors recent -s agdog1 --limit 10
pw diagnostics export -s agdog1 --section network --text checkout-timeout --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out /tmp/pwcli-agent-dogfood-network.json
pw diagnostics bundle -s agdog1 --out /tmp/pwcli-agent-dogfood-bundle --limit 20
pw diagnostics runs --session agdog1 --limit 12
```

## 关键证据

- 登录动作成功：`click e17` 后页面到 `/app/projects?from=login`，console 记录 `login-success {email: agent@example.com, remember: true}`。
- 导航链路成功：`#project-alpha` → `#alpha-incidents` → `#incident-checkout-timeout` → `#open-reproduce`，最终 `verify text` 通过 `checkout-timeout reproduce`。
- 复现失败被定位：`diagnostics digest` 汇总 `consoleErrors=2`、`httpErrors=1`。
- network 证据：`POST /api/incidents/alpha/checkout-timeout/start -> 500`，response body 包含 `CHECKOUT_TIMEOUT`。
- run evidence：最近 run 包含 `2026-05-03T17-42-44-700Z-agdog1`（点击触发 bug）和 `2026-05-03T17-42-53-873Z-agdog1`（等待 bug-result）。
- bundle evidence：`/tmp/pwcli-agent-dogfood-bundle/manifest.json` 生成成功。

## 观察到的问题

### `environment geolocation set` contract 漂移

按 skill 执行：

```bash
pw environment geolocation set -s agdog1 --lat 37.7749 --lng -122.4194
```

实际失败：

```text
ERROR ENVIRONMENT_GEOLOCATION_SET_FAILED
Error: browserContext.setGeolocation: geolocation.longitude: expected float, got undefined
```

进一步验证：

- `pw environment geolocation set --help` 只展示 `--accuracy`，没有 `--lat/--lng`，也没有提示 positional latitude/longitude。
- `pw environment geolocation set -s agdog1 37.7749 -122.4194` 仍失败，因为负数 longitude 被解析成 option。
- `pw environment geolocation set -s agdog1 37.7749 -- -122.4194` 可成功。

已记录 issue：`codestable/issues/2026-05-04-environment-geolocation-contract-drift/environment-geolocation-contract-drift-report.md`。

2026-05-04 更新：该 P1 已通过 `fix(environment): 支持 geolocation flag 参数` 和后续 contract 收敛修复。新增 `pnpm check:env-geolocation`，覆盖 help 中 `--lat/--lng`、实际 `--lat/--lng` 设置负数 longitude，以及旧 positional 形态被明确拒绝。

## 本轮状态

- `browser-automation`：partial pass。
- `deep-bug-diagnosis`：partial pass。
- `form-fill-validation`：partial pass（登录表单已覆盖基础 fill/click/wait/verify）。
- `controlled-testing/environment`：partial pass；geolocation contract drift 已修复并有聚焦 contract test。2026-05-04 追加 Agent dogfood 覆盖 geolocation/offline/clock。

## 追加验证：Environment controlled-testing

2026-05-04 追加真实页面验证：

```bash
pw session create envdog --no-headed --open http://127.0.0.1:43281/login
pw click -s envdog --selector '#login-submit'
pw wait -s envdog --selector '#project-alpha'
pw open -s envdog http://127.0.0.1:43281/app/projects/alpha/incidents/checkout-timeout/reproduce
pw wait -s envdog --text 'Reproduce workspace'
pw environment permissions grant geolocation -s envdog
pw environment geolocation set -s envdog --lat 37.7749 --lng -122.4194
pw click -s envdog --selector '#geo-probe'
pw wait -s envdog --text 'geo-result: 37.7749,-122.4194'
pw environment offline on -s envdog
pw click -s envdog --selector '#offline-probe'
pw wait -s envdog --text 'offline-result:'
pw environment offline off -s envdog
pw click -s envdog --selector '#offline-probe'
pw wait -s envdog --text 'offline-result: 200:pong:offline-1'
pw environment clock install -s envdog
pw environment clock set -s envdog 2024-12-10T10:00:00.000Z
pw click -s envdog --selector '#clock-probe'
pw wait -s envdog --text 'clock-result: 2024-12-10T10:00:00.000Z'
pw diagnostics digest -s envdog
pw diagnostics runs --session envdog --limit 12
```

关键证据：

- `geolocation set` 返回 `latitude: 37.7749`、`longitude: -122.4194`，页面 `geo-probe` 显示 `geo-result: 37.7749,-122.4194`。
- `offline on` 后 `offline-probe` 触发 `net::ERR_INTERNET_DISCONNECTED`，符合受控 offline 预期。
- `offline off` 后同一 probe 返回 `offline-result: 200:pong:offline-1`。
- `clock set` 后页面 `clock-probe` 显示 `clock-result: 2024-12-10T10:00:00.000Z`。
- run evidence 包含 `2026-05-03T17-58-50-946Z-envdog` 到 `2026-05-03T18-00-08-986Z-envdog`。

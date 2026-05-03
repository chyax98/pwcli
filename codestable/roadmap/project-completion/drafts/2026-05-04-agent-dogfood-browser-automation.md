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
- `simple-crawler`：partial pass；Agent 用 `read-text` + `pw code --file` 临时读取链接并逐跳跟踪，遇到 locator 歧义后按恢复建议继续。
- `automated-testing`：partial pass；2026-05-04 追加 route mock、bootstrap apply、batch verify 链路。dogfood 暴露 batch verify 假绿 P1，已修复并用 `check:batch-verify` 固化。

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

## 追加验证：Simple crawler

2026-05-04 追加真实页面简单爬取验证。Agent 不维护长期 crawler 脚本；本轮仅用临时 `pw code --file` 读取当前页链接，再用一等命令逐跳跟踪。

核心链路：

```bash
pw session create crawl1 --no-headed --open http://127.0.0.1:43282/login
pw click -s crawl1 --selector '#login-submit'
pw wait -s crawl1 --selector '#project-alpha'
pw read-text -s crawl1 --max-chars 800
pw code -s crawl1 --file <transient-link-scan.js>
pw click -s crawl1 --selector '#project-alpha'
pw wait -s crawl1 --text 'Project Alpha'
pw code -s crawl1 --file <transient-link-scan.js>
pw click -s crawl1 --selector '#alpha-incidents'
pw verify visible -s crawl1 --role heading --name Incidents
pw code -s crawl1 --file <transient-link-scan.js>
pw click -s crawl1 --selector '#incident-checkout-timeout'
pw wait -s crawl1 --text 'Incident Summary'
pw verify text -s crawl1 --text 'Open reproduce workspace'
pw diagnostics runs --session crawl1 --limit 12
```

关键证据：

- `/app/projects?from=login` 提取到链接：`App`、`Projects`、`alpha / checkout platform`、`beta / unused fixture row`。
- `/app/projects/alpha` 提取到链接：`App`、`Projects`、`Alpha`、`Open incidents`。
- `/app/projects/alpha/incidents` 提取到链接：`App`、`Projects`、`Alpha`、`Incidents`、`Inspect`。
- 逐跳跟踪到 `/app/projects/alpha/incidents/checkout-timeout`，最终 `verify text` 通过 `Open reproduce workspace`。
- 中途 `pw wait -s crawl1 --text 'Incidents'` 因 link 和 heading 同名触发 `ACTION_TARGET_AMBIGUOUS`；CLI 给出 `add --nth / narrower selector / role-name` 建议，Agent 改用 `pw verify visible -s crawl1 --role heading --name Incidents` 后恢复。
- run evidence 包含失败恢复 run：`2026-05-03T18-03-12-227Z-crawl1`，以及完成链路 run：`2026-05-03T18-03-36-815Z-crawl1`、`2026-05-03T18-03-45-984Z-crawl1`。

## 追加验证：Automated testing

2026-05-04 追加真实自动化测试场景。Agent 按 `skills/pwcli/` 使用 route mock、bootstrap apply、`pw code --file`、batch verify 组合完成受控页面验证。

核心链路：

```bash
pw session create autot2 --no-headed --open http://127.0.0.1:43284/login
pw route add -s autot2 --url '**/api/mock-target' --status 209 --body agent-route-body --headers '{"x-pwcli-route":"route-file"}'
pw click -s autot2 --selector '#login-submit'
pw wait -s autot2 --selector '#project-alpha'
pw open -s autot2 http://127.0.0.1:43284/app/projects/alpha/incidents/checkout-timeout/reproduce
pw click -s autot2 --selector '#route-probe'
pw wait -s autot2 --text 'mock-result: 209:agent-route-body'
pw wait -s autot2 --text 'route-state: route-file'
pw bootstrap apply -s autot2 --file scripts/manual/bootstrap-fixture.js --headers '{"x-pwcli-header":"agent-test-2"}'
pw open -s autot2 http://127.0.0.1:43284/app/projects/alpha/incidents/checkout-timeout/reproduce
pw code -s autot2 --file scripts/e2e/dogfood-bootstrap.js
printf '%s\n' '[["read-text","--max-chars","800"],["verify","text","--text","mock-result: 209:agent-route-body"],["verify","text","--text","route-state: route-file"]]' | pw batch --output json --session autot2 --stdin-json --include-results
pw diagnostics runs --session autot2 --limit 12
```

关键证据：

- route mock 生效：页面显示 `mock-result: 209:agent-route-body` 和 `route-state: route-file`，响应 header 包含 `x-pwcli-route: route-file`。
- bootstrap apply 生效：重新导航后 init script 注入到新 document；`pw code -s autot2 --file scripts/e2e/dogfood-bootstrap.js` 返回 `installed: true`，fetch/xhr 请求带 `headerEcho: agent-test-2`。
- batch 成功链路：batch JSON 返回 `ok: true`，`summary.successCount=3`，两个 verify step 的 `passed=true`。
- run evidence 包含 `2026-05-03T18-13-42-093Z-autot2`、`2026-05-03T18-13-56-897Z-autot2`、`2026-05-03T18-14-06-072Z-autot2`。

本轮 dogfood 暴露并修复 P1：

- 问题：batch 内部 `verify` 返回 `passed=false` 时曾被包装成成功 step，导致自动化测试可能假绿。
- 记录：`codestable/issues/2026-05-04-batch-verify-failure-propagation/batch-verify-failure-propagation-report.md`。
- 修复：`src/cli/batch/executor.ts` 现在把 `passed=false` 转成 `VERIFY_FAILED`，并保留 verify suggestions。
- 固化验证：新增 `pnpm check:batch-verify`，断言 batch verify failure 必须非零退出并返回 `BATCH_STEP_FAILED`。

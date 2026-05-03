---
doc_type: validation-evidence
roadmap: project-completion
item: agent-scenario-deep-validation
status: passed
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

- `browser-automation`：pass；session / status / read-text / snapshot / action / wait / verify 主链覆盖。
- `deep-bug-diagnosis`：pass；console / network / errors / diagnostics digest / export / bundle / runs 覆盖。
- `form-fill-validation`：pass；登录表单覆盖 fill/check/uncheck/get/click/wait，fixture 覆盖 select，reproduce 页面覆盖 upload/drag/download。
- `controlled-testing/environment`：pass；route mock、bootstrap apply、geolocation/offline/clock 覆盖；geolocation P1 已修复并用 `check:env-geolocation` 固化。
- `simple-crawler`：pass；Agent 用 `read-text` + `pw code --file` 临时读取链接并逐跳跟踪，遇到 locator 歧义后按恢复建议继续。
- `automated-testing`：pass；route mock、bootstrap apply、batch verify 链路覆盖；batch verify P1 已修复并用 `check:batch-verify` 固化。
- `reproducible-handoff`：pass；bundle/runs、screenshot/pdf/accessibility/video/trace artifact 覆盖；trace inspect P1 已修复并用 `check:trace-inspect` 固化。
- `state-auth`：pass；fixture-auth、state diff/load、cookies/localStorage、IndexedDB export 覆盖；真实 `auth dc` 仍是外部业务账号边界，不伪造成 proven。
- `workspace-control`：pass；session/page projection、snapshot epoch、text alias、hover/scroll/resize/mouse 覆盖。
- `tooling-boundary`：pass with documented boundary；skill install/profile/dashboard/SSE 覆盖，HAR start/stop 仍作为 `supported=false` limitation 记录，不升级为稳定热录制 contract。

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

## 追加验证：Form / file interaction

2026-05-04 追加表单填写与文件交互 dogfood。主链使用 `scripts/e2e/dogfood-server.js 43285`，补充 select 控件使用 `scripts/manual/deterministic-fixture-server.js 43286`。

核心链路：

```bash
pw session create formdog --no-headed --open http://127.0.0.1:43285/login
pw read-text -s formdog --max-chars 800
pw snapshot -i -s formdog
pw uncheck -s formdog --selector '#remember-me'
pw verify unchecked -s formdog --selector '#remember-me'
pw fill -s formdog --selector '#email' agent.form@example.com
pw fill -s formdog --selector '#password' pwcli-secret
pw get -s formdog --selector '#email' --fact value
pw check -s formdog --selector '#remember-me'
pw verify checked -s formdog --selector '#remember-me'
pw click -s formdog --selector '#login-submit'
pw wait -s formdog --selector '#project-alpha'
pw open -s formdog http://127.0.0.1:43285/app/projects/alpha/incidents/checkout-timeout/reproduce
pw wait -s formdog --text 'Reproduce workspace'
pw upload -s formdog --selector '#upload-input' scripts/e2e/dogfood-route-body.txt
pw wait -s formdog --text 'upload-result: dogfood-route-body.txt'
pw drag -s formdog --from-selector '#drag-card-a' --to-selector '#drag-lane-done'
pw wait -s formdog --text 'drag-status: moved triage customer report'
pw download -s formdog --selector '#download-report' --dir /tmp/pwcli-formdog-downloads
pw open -s formdog http://127.0.0.1:43286/blank
pw select -s formdog --selector '#smoke-select' b
pw get -s formdog --selector '#smoke-select' --fact value
pw diagnostics runs --session formdog --limit 16
```

关键证据：

- checkbox 链路：`uncheck` 后 `verify unchecked passed=true`；`check` 后 `verify checked passed=true`。
- fill/get 链路：`get --fact value` 返回 `agent.form@example.com`；登录后 console 记录 `login-success {email: agent.form@example.com, remember: true}`。
- upload 链路：`upload uploaded=true`，页面显示 `upload-result: dogfood-route-body.txt`。
- drag 链路：`drag ok`，页面显示 `drag-status: moved triage customer report`。
- download 链路：`download downloaded=true`，`/tmp/pwcli-formdog-downloads/dogfood-report.txt` 内容包含 `dogfood-report:dogfood-1`。
- select 链路：`select selected=true`，`get --fact value` 返回 `b`。
- run evidence 包含 `2026-05-03T18-20-31-080Z-formdog`、`2026-05-03T18-21-21-402Z-formdog`、`2026-05-03T18-22-02-783Z-formdog`、`2026-05-03T18-22-19-213Z-formdog`、`2026-05-03T18-22-28-509Z-formdog`、`2026-05-03T18-23-35-653Z-formdog`、`2026-05-03T18-23-43-927Z-formdog`。

观察：

- deterministic fixture 触发了 `/favicon.ico -> 404` 噪声；这是 fixture 页面缺少 favicon 的可解释噪声，不影响 `select/check` 命令结论。

## 追加验证：Artifacts / reproducible handoff

2026-05-04 追加可交接证据 artifact dogfood。主链使用 `scripts/e2e/dogfood-server.js 43287` 和 session `artdog`；trace 显式 start/stop 补充使用 session `tracedog`。

核心链路：

```bash
pw session create artdog --no-headed --open http://127.0.0.1:43287/login
pw screenshot -s artdog --path /tmp/pwcli-artdog/login.png --full-page
pw pdf -s artdog --path /tmp/pwcli-artdog/login.pdf
pw accessibility -s artdog --interactive-only
pw video start -s artdog
pw fill -s artdog --selector '#email' artifact@example.com
pw video stop -s artdog
pw trace stop -s artdog
pw trace inspect .pwcli/playwright/traces/trace-1777832767561.trace --section actions --limit 20
pw diagnostics bundle -s artdog --out /tmp/pwcli-artdog/bundle --limit 20
pw diagnostics runs --session artdog --limit 8
pw session create tracedog --no-headed --no-trace --open 'data:text/html,<main><button>trace button</button></main>'
pw trace start -s tracedog
pw click -s tracedog --text 'trace button'
pw trace stop -s tracedog
pw trace inspect .pwcli/playwright/traces/trace-1777832953035.trace --section actions --limit 8
pnpm check:trace-inspect
```

关键证据：

- screenshot artifact：`/tmp/pwcli-artdog/login.png`，PNG 1280x720，27632 bytes。
- PDF artifact：`/tmp/pwcli-artdog/login.pdf`，PDF 1 page，87023 bytes。
- accessibility：`pw accessibility --interactive-only` 输出 Email、Password、Remember me、Sign in 等 interactive nodes。
- video artifact：`video stop` 输出 `.pwcli/playwright/video-2026-05-03T18-26-19-258Z.webm`，WebM，53897 bytes。
- trace artifact：`trace stop` 输出 `.pwcli/playwright/traces/trace-1777832767561.trace`，74617 bytes；修复后 `trace inspect --section actions` 输出 Playwright actions 表。
- explicit trace chain：`tracedog` 使用 `--no-trace` 创建 session 后显式 `trace start`，`trace stop` 输出 `.pwcli/playwright/traces/trace-1777832953035.trace`，`trace inspect` 成功。
- diagnostics bundle：`/tmp/pwcli-artdog/bundle/manifest.json` 生成成功，21778 bytes；timeline 包含 screenshot/pdf/fill run events。
- run evidence：`2026-05-03T18-26-15-874Z-artdog`、`2026-05-03T18-26-18-088Z-artdog`、`2026-05-03T18-26-26-444Z-artdog`、`2026-05-03T18-29-25-813Z-tracedog`。

本轮 dogfood 暴露并修复 P1：

- 问题：`trace stop` 生成 artifact 后，`trace inspect` 查找父目录 `node_modules/playwright-core`，返回 `TRACE_CLI_UNAVAILABLE`。
- 记录：`codestable/issues/2026-05-04-trace-inspect-cli-resolution/trace-inspect-cli-resolution-report.md`。
- 修复：`src/engine/diagnose/trace.ts` 改用 `createRequire(import.meta.url).resolve("playwright-core/package.json")` 定位当前安装包。
- 固化验证：新增 `pnpm check:trace-inspect`，覆盖 `trace start -> action -> trace stop -> trace inspect`。

## 追加验证：State / auth reuse

2026-05-04 追加状态和认证复用 dogfood。主链使用 `scripts/e2e/dogfood-server.js 43288`，sessions 为 `statedog` 和 `statedog2`。

核心链路：

```bash
pw session create statedog --no-headed --open http://127.0.0.1:43288/login
pw auth list
pw auth info fixture-auth
pw state diff -s statedog --before /tmp/pwcli-statedog-before.json
pw auth fixture-auth -s statedog --arg marker=state-dog --save-state /tmp/pwcli-statedog-auth.json
pw state diff -s statedog --before /tmp/pwcli-statedog-before.json --after /tmp/pwcli-statedog-after.json --include-values
pw session create statedog2 --no-headed --state /tmp/pwcli-statedog-auth.json --open http://127.0.0.1:43288/login
pw storage local get pwcli-auth-marker -s statedog2
pw cookies list -s statedog2 --domain 127.0.0.1
pw auth probe -s statedog2
pw code -s statedog '<transient indexeddb setup>'
pw storage indexeddb export -s statedog --database pwcli-dogfood --store items --include-records --limit 3
```

关键证据：

- `auth list` 返回 `dc` 和 `fixture-auth`；`auth info fixture-auth` 返回 provider args、examples 和 notes。
- `state diff` 首次创建 baseline：`baselineCreated=true`，`beforePath=/tmp/pwcli-statedog-before.json`。
- `auth fixture-auth` 写入 marker：`pageState.authMarker=state-dog`、`bodyMarker=state-dog`，并保存 state 到 `/tmp/pwcli-statedog-auth.json`。
- before/after diff：`summary.changed=true`，`changedBuckets=["cookies","localStorage"]`；新增 cookie `pwcli_auth_marker=state-dog` 和 localStorage `pwcli-auth-marker=state-dog`。
- `statedog2` 通过 `--state /tmp/pwcli-statedog-auth.json` 创建后，`storage local get pwcli-auth-marker` 返回 `state-dog`，`cookies list --domain 127.0.0.1` 返回同名 cookie。
- `auth probe` 在登录页返回 `status=anonymous`，同时 `signals.storage` 命中 cookie/localStorage；这符合当前 heuristic：登录页 UI 仍优先判为需要 reauth，不把 storage signal 包装成强认证。
- IndexedDB export：临时创建 `pwcli-dogfood/items` 后，`storage indexeddb export --include-records` 返回 `databaseCount=1`，sample record `{ id: "state-dog", value: "indexeddb-ready" }`。

观察：

- state/auth/storage 命令本身不都产生 `.pwcli/runs` action event；本轮证据以命令结构化输出和 state/diff 文件为主。

## 追加验证：Workspace / control commands

2026-05-04 追加 workspace 观察和低层控制 dogfood。sessions 为 `controldog`、`mousedog2`。

核心链路：

```bash
pw session create controldog --no-headed --open '<tall data url with buttons>'
pw session list --with-page
pw session status controldog
pw page list -s controldog
pw page dialogs -s controldog
pw page assess -s controldog
pw snapshot -i -s controldog
pw snapshot status -s controldog
pw text -s controldog --max-chars 300
pw hover -s controldog --selector '#hover-target'
pw scroll -s controldog down 900
pw wait -s controldog --text 'bottom marker'
pw resize -s controldog --preset iphone --view mobile-dogfood
pw mouse move -s controldog 80 40
pw mouse click -s controldog 110 15
pw code -s controldog '<read mouse/viewport/scrollY>'
pw session create mousedog2 --no-headed --open '<encoded button data url>'
pw mouse click -s mousedog2 60 40
pw code -s mousedog2 '<read body dataset>'
```

关键证据：

- `session list --with-page` 返回 `controldog alive=true` 和当前 page projection；`session status` 返回 active socket、Playwright version、workspaceDir 和 pageId/navigationId。
- `page dialogs` 返回 `dialogCount=0`，并明确 limitation：它是 observed dialog events projection，不是 authoritative live dialog set。
- `page assess` 返回 inference summary、nextSteps 和 limitations。
- `snapshot status` 返回 `status=fresh`、`snapshotId=snap-1`、`refCount=4`。
- `text` 短别名输出 `Hover target Mouse target bottom marker`。
- `hover` 返回 `acted=true` 且有 run evidence：`2026-05-03T18-38-10-342Z-controldog`。
- `scroll down 900` 后 `wait --text 'bottom marker'` 通过；页面复查 `scrollY=900`。
- `resize --preset iphone --view mobile-dogfood` 返回 viewport `390x844`，后续 `pw code` 复查 `innerWidth=390`、`innerHeight=844`。
- `mouse move` 和第一次 coordinate click 都返回 action evidence；第一次 click 未命中业务目标，复查 `data-mouse=null`。
- Agent 随后用 `mousedog2` 构造可控坐标目标，`mouse click 60 40` 后页面状态复查为 `clicked`。

观察：

- 坐标级 mouse command 的 `acted=true` 只代表动作发出，不代表业务命中；必须继续用 `code/get/read-text/verify` 复查页面状态。

## 追加验证：Tooling boundary commands

2026-05-04 追加工具边界 dogfood，覆盖 skill 分发、profile discovery、dashboard dry-run、SSE 查询和 HAR 当前限制。

核心链路：

```bash
pw skill path
pw skill install /tmp/pwcli-skill-install
pnpm build
pnpm check:skill-install
pw profile list-chrome --output json
pw dashboard open --dry-run --output json
pw session create ssedog --no-headed --open http://127.0.0.1:43289/
pw wait -s ssedog --text 'sse-result: sse-dogfood'
pw sse -s ssedog --url /events --limit 10
pw session create hardog --no-headed --open 'data:text/html,<main>har fixture</main>'
pw har start -s hardog --path /tmp/pwcli-hardog.har
pw har stop -s hardog
```

关键证据：

- `profile list-chrome --output json` 返回 2 个 system Chrome profile：`Default`、`Profile 1`。
- `dashboard open --dry-run --output json` 返回 `available=true`，并解析到当前 `playwright-core@1.59.1` 的 `dashboardApp.js` 和 `cli.js`。
- SSE fixture 页面通过 EventSource 收到 `sse-result: sse-dogfood`；`pw sse --url /events` 返回 connect/open/message 记录，message data 为 `sse-dogfood`。
- HAR start/stop 当前返回 `supported=false` 和明确 limitation：existing BrowserContext 不暴露 HAR start/stop。该能力不升级为 proven。

本轮 dogfood 暴露并修复 P1：

- 问题：`pw skill path` 指向 `/Users/xd/work/tools/skills/pwcli` 且 `info.exists=false`，`pw skill install` 返回 `SKILL_INSTALL_FAILED`。
- 记录：`codestable/issues/2026-05-04-skill-packaged-path-resolution/skill-packaged-path-resolution-report.md`。
- 修复：`src/store/skill.ts` 从 `dist/store/skill.js` 解析到包内 `../../skills/pwcli`。
- 固化验证：新增 `pnpm check:skill-install`，覆盖 `skill path` 和安装到临时 skills 目录。

观察：

- SSE message 当前出现重复记录；查询和证据链可用，重复去重不是本轮 P0/P1 blocker。
- `dashboard open --dry-run` 只证明 bundled entrypoint 可用；真实人类观察窗口仍属于人工接管面，不是 Agent 主执行链。

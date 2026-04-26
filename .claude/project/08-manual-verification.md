# Manual Verification

更新时间：2026-04-26
状态：active

这份清单记录最近真实跑过的验证，不写“理论上应该能跑”。

## 先决条件

这次新增的 deterministic fixture / bootstrap / wait 验证直接基于现成 `dist/cli.js` 和本地 fixture server：

```bash
node scripts/manual/deterministic-fixture-server.js >/tmp/pwcli-deterministic-server.log 2>&1 &
server_pid=$!
printf '{"x-pwcli-header":"boot-1"}' > /tmp/pwcli-bootstrap-headers.json
```

收尾：

```bash
kill "$server_pid"
rm -f /tmp/pwcli-bootstrap-headers.json
```

## smoke / dogfood gate

当前最小 smoke gate 统一走：

```bash
pnpm run smoke
```

`pnpm run test:dogfood` 当前直接复用同一条脚本，不再维护第二套口径：

```bash
pnpm run test:dogfood
```

脚本位置：

```bash
scripts/smoke/pwcli-smoke.sh
```

这条 gate 只覆盖当前稳定主链：

- `session create -> open -> session close`
- `snapshot`
- `page current`
- `observe status`
- `batch "observe status" "page dialogs"`
- `bootstrap apply --init-script --headers-file`
- post-navigation bootstrap verify
- `route add`
- `code --file diagnostics-fixture.js`
- `click`
- `console --text`
- `network --resource-type xhr`
- `errors recent`
- `doctor --session --endpoint`

这条 gate 当前不覆盖：

- modal recoverability
- raw CDP without bridge
- observe stream
- HAR 热录制
- workspace 写操作
- auth plugin 真实登录流

## modal blocked workspace probe

最小复现：

```bash
node scripts/manual/modal-fixture.js
node dist/cli.js session create modala --open http://127.0.0.1:4124
node dist/cli.js click --selector '#open-alert' --session modala
node dist/cli.js page current --session modala
node dist/cli.js observe status --session modala
node dist/cli.js doctor --session modala
```

期望：

- `click --selector '#open-alert'` 返回 `MODAL_STATE_BLOCKED`
- `page current` 返回 `MODAL_STATE_BLOCKED`
- `observe status` 返回 `MODAL_STATE_BLOCKED`
- `doctor` 返回 `kind: "modal-state"` 的 warning

## 已真实执行并通过

### strict session-first 基线

```bash
node dist/cli.js open https://example.com
node dist/cli.js snapshot
node dist/cli.js session create bug-a --open https://example.com
node dist/cli.js snapshot --session bug-a
node dist/cli.js session close bug-a
```

结论：

- 裸 `open` 报 `SESSION_REQUIRED`
- 裸 `snapshot` 报 `SESSION_REQUIRED`
- `session create` 可成功创建 named session
- `snapshot --session bug-a` 可成功命中这条 session

### session 管理

```bash
node dist/cli.js session create bug-a --open https://example.com
node dist/cli.js session list
node dist/cli.js session status bug-a
node dist/cli.js session recreate bug-a --headed
node dist/cli.js session recreate bug-a --headless
node dist/cli.js session close bug-a
node dist/cli.js session list
```

结论：

- `session list` 当前会返回 `name/alive/socketPath/version/workspaceDir/page`
- `session status <name>` 可读
- `session recreate --headed/--headless` 已验证可执行
- `session close <name>` 可关闭指定 session
- 长 session 名当前已验证不会再直接触发 Unix socket path `listen EINVAL`

### open / batch

```bash
node dist/cli.js open --session bug-open https://example.com
node dist/cli.js snapshot --session bug-open
node dist/cli.js session close bug-open

node dist/cli.js session create bug-batch --open https://example.com
node dist/cli.js batch --session bug-batch "snapshot" "read-text"
node dist/cli.js session close bug-batch
```

结论：

- `open --session <name>` 可创建或命中指定 session
- `batch --session <name>` 可在同一 named session 内顺序执行步骤
- 新增的 debug/read surfaces 也已支持 batch：

```bash
node dist/cli.js batch --session phase4-a "observe status" "errors recent" "route remove"
```

### resize

```bash
node dist/cli.js session create view-a --open https://example.com
node dist/cli.js resize --session view-a --view 390x844
node dist/cli.js resize --session view-a --preset desktop
node dist/cli.js session close view-a
```

结论：

- `resize --view` 已验证可用
- `resize --preset` 已验证可用

### DC 2.0 真实页面入口

```bash
node dist/cli.js session create dc-main --open http://127.0.0.1:4110/forge
node dist/cli.js page current --session dc-main
node dist/cli.js snapshot --session dc-main
node dist/cli.js session close dc-main

node dist/cli.js session create dc-main --open http://127.0.0.1:4110/forge --profile ~/.forge-browser/profiles/acceptance-login
node dist/cli.js snapshot --session dc-main
node dist/cli.js session close dc-main
```

结论：

- `http://127.0.0.1:4110/forge` 当前已验证能稳定打开，标题是 `TapTap 开发者服务`
- 挂 `~/.forge-browser/profiles/acceptance-login` 也能直接进入同一真实页面
- 当前机器上，这条路比 `tap.dev` 域名更稳，适合作为 Agent 探索 DC 2.0 的主入口

### plugin / auth / skill

```bash
node dist/cli.js plugin list
node dist/cli.js plugin path example-auth
node dist/cli.js plugin path dc-login
node dist/cli.js session create auth-a --open about:blank
node dist/cli.js auth --session auth-a --plugin example-auth --arg url=https://example.com
node dist/cli.js auth --session auth-a example-auth --open https://example.com --save-state ./.tmp-auth-state-2.json
node dist/cli.js session close auth-a
node dist/cli.js skill path
node dist/cli.js skill install "$(mktemp -d)"
```

结论：

- `plugin list` 当前会返回 `count`
- `dc-login` 已出现在插件列表里
- `auth` 当前要求显式 `--session`
- `auth --open` 已验证会在插件执行后把页面落到目标 URL
- `auth --save-state` 已验证会真实生成 state 文件
- `skill install` 已验证可以把 packaged skill 复制到目标目录

### page / observe projection

```bash
node dist/cli.js session create phase2-projection-clean --open about:blank
node dist/cli.js code --session phase2-projection-clean "async page => { await page.setContent('<title>Phase2 Projection</title><iframe name=\"child-frame\" srcdoc=\"<p>Inner frame</p>\"></iframe><button id=\"noop\">Ready</button>'); return { ok: true, title: await page.title(), frameCount: page.frames().length }; }"
node dist/cli.js page current --session phase2-projection-clean
node dist/cli.js page list --session phase2-projection-clean
node dist/cli.js page frames --session phase2-projection-clean
node dist/cli.js page dialogs --session phase2-projection-clean
node dist/cli.js observe status --session phase2-projection-clean
```

结论：

- `page current/list/frames/dialogs` 与 `observe status` 现在共享同一套 `pageId/navigationId` projection
- `page dialogs` 当前会显式输出 limitation
- 如果 session 卡在 modal state，当前 `browser_run_code` 读路径会失败，这条边界已确认

### profile

```bash
node dist/cli.js profile inspect ./plugins
node dist/cli.js profile open "$(mktemp -d)" about:blank --session profile-a
node dist/cli.js session close profile-a
```

结论：

- `profile inspect` 当前返回 rich path inspection，不只是 `exists`
- `profile open` 当前要求显式 `--session`

### state / open 复用

```bash
node dist/cli.js session create state-a --open https://example.com
node dist/cli.js state save ./.tmp-auth-state.json --session state-a
node dist/cli.js session close state-a
node dist/cli.js open --session state-a --state ./.tmp-auth-state.json https://example.com
node dist/cli.js page current --session state-a
node dist/cli.js session close state-a
```

结论：

- `open --state <file> <url> --session <name>` 已验证会先加载 storage state，再落到目标 URL

### 动作面

以下手工页用 `pw code` 注入：

```bash
node dist/cli.js session create action-a --open about:blank
node dist/cli.js code --session action-a "async page => { await page.setContent('<label for=\"name\">Name</label><input id=\"name\" placeholder=\"Your name\"><button>Save</button><div id=\"status\">idle</div><script>const input=document.getElementById(\"name\");const status=document.getElementById(\"status\");document.querySelector(\"button\").addEventListener(\"click\",()=>{status.textContent=input.value||\"saved\"});input.addEventListener(\"keydown\",e=>{if(e.key===\"Enter\"){status.textContent=input.value||\"saved-enter\";}});</script>'); return 'ready'; }"
node dist/cli.js fill --session action-a --selector '#name' Alice
node dist/cli.js click --session action-a --role button --name Save
node dist/cli.js read-text --session action-a --selector '#status'
node dist/cli.js type --session action-a Bob
node dist/cli.js press --session action-a Enter
node dist/cli.js scroll --session action-a down 200
node dist/cli.js session close action-a
```

结论：

- `fill/click/read-text/type/press/scroll` 都已切到显式 session 路由

### console / network

```bash
node dist/cli.js session create diag-det2 --open http://127.0.0.1:4179/blank
node dist/cli.js code --session diag-det2 --file ./scripts/manual/diagnostics-fixture.js
node dist/cli.js route add '**/__pwcli__/diagnostics/route-hit**' --session diag-det2 --body routed-from-pwcli --status 211 --content-type text/plain
node dist/cli.js click --session diag-det2 --selector '#fire'
node dist/cli.js console --session diag-det2
PWCLI_RAW_OUTPUT=1 node dist/cli.js network --session diag-det2
node dist/cli.js errors recent --session diag-det2
node dist/cli.js read-text --session diag-det2 --selector '#last-route-result'
node dist/cli.js session close diag-det2
```

结论：

- `diagnostics-fixture.js` 现在稳定打出 5 类信号：`console`、普通 `request/response`、`page error`、route fulfill 命中、延迟 `wait` 命中
- `console.summary` 已真实返回：
  - `fixture-log-run-1`
  - `fixture-warn-run-1`
  - `fixture-error-run-1`
  - `fixture-fetch-run-1 200 fetch:1`
  - `fixture-xhr-run-1 201 xhr:1`
  - `fixture-route-hit-run-1 211 routed-from-pwcli`
- `network.summary.sample[]` 已真实返回：
  - `GET /__pwcli__/diagnostics/fetch?run=1 -> 200`
  - `GET /__pwcli__/diagnostics/xhr?run=1 -> 201`
  - `GET /__pwcli__/diagnostics/route-hit?run=1 -> 211`
- `errors recent` 已真实抓到 `fixture-page-error-run-1`
- `read-text #last-route-result` 已真实返回 `211:routed-from-pwcli`，这条值明确证明 route hit 走的是 Playwright fulfill，不是 server fallback
- `console --text fixture-route-hit-run-1` 已真实过滤出单条命中日志
- `network --resource-type xhr` 已真实过滤出 xhr request/response
- `network --request-id req-2` 已真实返回 detail

### attach

```bash
node scripts/manual/attach-target.js
node dist/cli.js session attach aw1 --ws-endpoint ws://localhost:61633/...
node dist/cli.js session attach ab1 --browser-url http://127.0.0.1:61632
node dist/cli.js session attach ac1 --cdp 61632
node dist/cli.js connect --session ax1 --browser-url http://localhost:61632
```

结论：

- `--ws-endpoint` 已验证通过
- `--browser-url` 已验证通过
- `--cdp` 已验证通过
- `connect` 已验证只是 `session attach` 的兼容壳

### bootstrap

```bash
node dist/cli.js session create boot-det2 --open http://127.0.0.1:4179/blank
node dist/cli.js bootstrap apply --session boot-det2 --init-script ./scripts/manual/bootstrap-fixture.js --headers-file /tmp/pwcli-bootstrap-headers.json
node dist/cli.js open --session boot-det2 http://127.0.0.1:4179/blank
node dist/cli.js code --session boot-det2 --file ./scripts/manual/bootstrap-verify.js
node dist/cli.js session close boot-det2
```

结论：

- `bootstrap apply --init-script` 已验证会在下一次导航前生效；对当前页不追溯
- `bootstrap-fixture.js` 已真实写入 document marks：`install -> readystatechange-interactive -> domcontentloaded -> readystatechange-complete -> load`
- `bootstrap-verify.js` 已真实验证：
  - `globalThis.__PWCLI_BOOTSTRAP_FIXTURE__` 已安装
  - `__pwcliBootstrapFetch()` 和 `__pwcliBootstrapXhr()` 都能命中 `server-echo`
  - `--headers-file` 注入的 `x-pwcli-header: boot-1` 会被 fixture server 回显进 `headerEcho`
  - `__pwcliBootstrapSnapshot()` 会保留 `documentMarks` 和请求记录

### cookies / storage

```bash
node scripts/manual/deterministic-fixture-server.js 4191
node dist/cli.js open --session ident-b http://127.0.0.1:4191/blank
node dist/cli.js code --session ident-b "async page => await page.evaluate(() => { localStorage.setItem('alpha','1'); sessionStorage.setItem('beta','2'); return { origin: location.origin, href: location.href, local: localStorage.getItem('alpha'), session: sessionStorage.getItem('beta') }; })"
node dist/cli.js storage local --session ident-b
node dist/cli.js storage session --session ident-b
node dist/cli.js cookies set --session ident-b --name gamma --value 3 --domain 127.0.0.1
node dist/cli.js cookies list --session ident-b --domain 127.0.0.1
```

结论：

- `storage local` 已真实返回当前页 origin 的 localStorage entries
- `storage session` 已真实返回当前页 origin 的 sessionStorage entries
- `cookies set/list` 已真实可用
- 对 `data:` / `chrome-error://` 页面，storage 当前会返回 `accessible: false`

### upload / drag / download

```bash
node dist/cli.js session create file-a --open about:blank
node dist/cli.js code --session file-a --file ./scripts/manual/upload-drag-download.js
node dist/cli.js upload --session file-a --selector '#f' ./package.json
node dist/cli.js drag --session file-a --from-selector '#src' --to-selector '#dst'
node dist/cli.js download --session file-a --selector '#dl' --dir ./.tmp-downloads
node dist/cli.js session close file-a
```

结论：

- `upload/drag/download` 都已切到显式 session 路由

## 已真实观察到的异常或限制

### session status

`session status <name>` 仍然只是 best-effort liveness 视图，不是强一致 truth。

### `wait --request/--response/--method/--status`

```bash
node dist/cli.js session create diag-det2 --open http://127.0.0.1:4179/blank
node dist/cli.js code --session diag-det2 --file ./scripts/manual/diagnostics-fixture.js

node dist/cli.js code --session diag-det2 "async page => await page.evaluate(() => window.__pwcliDiagnosticsFixture.armRequestWait(10000, 'manual-request'))"
node dist/cli.js wait --session diag-det2 --request 'http://127.0.0.1:4179/__pwcli__/wait/request?token=manual-request' --method GET

node dist/cli.js code --session diag-det2 "async page => await page.evaluate(() => window.__pwcliDiagnosticsFixture.armResponseWait(10000, 'manual-response'))"
node dist/cli.js wait --session diag-det2 --response 'http://127.0.0.1:4179/__pwcli__/wait/response?token=manual-response' --method GET --status 203

node dist/cli.js session close diag-det2
```

结论：

- `wait --request` 已真实返回 `matched: true`，命中 `http://127.0.0.1:4179/__pwcli__/wait/request?token=manual-request`
- `wait --response --status` 已真实返回 `matched: true`，命中 `http://127.0.0.1:4179/__pwcli__/wait/response?token=manual-response`，状态码 `203`
- 当前最稳的手法是：
  - 先打开同源 fixture 页 `http://127.0.0.1:4179/blank`
  - 用 `pw code` 预埋一个 10 秒延迟请求
  - `wait` 里传绝对 URL

## 本轮没有做功能性验证

- 更复杂的多 tab / frame / dialog 工作流
- `download` 在 `file://` 打开的本地下载页上仍不写成稳定 contract
- `dc-login` 在当前环境里的完整动态登录链路；当前只验证了插件接入和参数解析，未把它写成稳定主路
- 对任意只暴露 raw CDP、没有 attach bridge 的外部浏览器，`session attach --browser-url/--cdp` 还没有写成稳定 contract

这些都不能写成“已人工验证通过”。

## Ship Gate

发下一次大改前，最小 gate：

```bash
pnpm build
pnpm typecheck
node dist/cli.js session create gate-a --open about:blank
node dist/cli.js snapshot --session gate-a
node dist/cli.js page dialogs --session phase2-projection-clean
node dist/cli.js batch --session phase4-a "observe status" "errors recent" "route remove"
node dist/cli.js storage local --session ident-b
node dist/cli.js cookies list --session ident-b --domain 127.0.0.1
node dist/cli.js console --session diag-q2 --text fixture-route-hit-run-1
node dist/cli.js network --session diag-q2 --request-id req-2
node dist/cli.js session close gate-a
```

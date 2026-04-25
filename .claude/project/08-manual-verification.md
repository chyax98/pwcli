# Manual Verification

更新时间：2026-04-25
状态：active

这份清单只记录本轮真实跑过的验证，不写“理论上应该能跑”。

## 先决条件

本轮先执行：

```bash
pnpm build
pnpm typecheck
```

两者均通过。

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
node dist/cli.js session create diag-a --open about:blank
node dist/cli.js code --session diag-a --file ./scripts/manual/console-network.js
node dist/cli.js click --session diag-a --selector '#fire'
node dist/cli.js console --session diag-a
PWCLI_RAW_OUTPUT=1 node dist/cli.js network --session diag-a
node dist/cli.js session close diag-a
```

结论：

- `console.summary` 当前已验证会返回 `total/errors/warnings/sample[]`
- `network.summary` 当前已验证会返回 `total/sample[]`

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

参数面已经暴露，但功能尚未实现。

## 本轮没有做功能性验证

- 更复杂的多 tab / frame / dialog 工作流
- `download` 在 `file://` 打开的本地下载页上仍不写成稳定 contract
- `dc-login` 在当前环境里的完整动态登录链路；当前只验证了插件接入和参数解析，未把它写成稳定主路

这些都不能写成“已人工验证通过”。

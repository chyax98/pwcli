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

### 命令面

```bash
node dist/cli.js --help
node dist/cli.js help click
node dist/cli.js help connect
node dist/cli.js help wait
node dist/cli.js help state
```

结论：

- 当前命令集与源码一致
- `click` 已有 `--selector`
- `connect` 已有 `--ws-endpoint` / `--browser-url` / `--cdp`

### default managed browser 主链

```bash
node dist/cli.js open https://example.com
node dist/cli.js page current
node dist/cli.js page list
node dist/cli.js page frames
node dist/cli.js snapshot
node dist/cli.js read-text --max-chars 80
node dist/cli.js screenshot --path ./.tmp-shot.png
node dist/cli.js wait networkIdle
node dist/cli.js code "async page => await page.title()"
node dist/cli.js batch "snapshot" "read-text" "page current"
node dist/cli.js trace start
node dist/cli.js trace stop
node dist/cli.js state save ./.tmp-state.json
node dist/cli.js state load ./.tmp-state.json
```

结论：

- `open -> snapshot/read-text/page/...` 是当前最稳定主链
- `snapshot` 返回 Playwright AI snapshot
- `batch` 当前只适合跑已接入的少量子命令
- `trace` 和 `state` 已可用，但没有项目级 artifact 目录 contract

### DC 2.0 真实页面入口

```bash
node dist/cli.js session close
node dist/cli.js open http://127.0.0.1:4110/forge
node dist/cli.js page current
node dist/cli.js snapshot

node dist/cli.js session close
node dist/cli.js open --profile ~/.forge-browser/profiles/acceptance-login http://127.0.0.1:4110/forge
node dist/cli.js snapshot
```

结论：

- `http://127.0.0.1:4110/forge` 当前已验证能稳定打开，标题是 `TapTap 开发者服务`
- 挂 `~/.forge-browser/profiles/acceptance-login` 也能直接进入同一真实页面
- 当前机器上，这条路比 `tap.dev` 域名更稳，适合作为后续 Agent 探索 DC 2.0 的主入口

### plugin / auth / skill

```bash
node dist/cli.js plugin list
node dist/cli.js plugin path example-auth
node dist/cli.js plugin path dc-login
node dist/cli.js auth --plugin example-auth --arg url=https://example.com
node dist/cli.js auth example-auth --open https://example.com --save-state ./.tmp-auth-state-2.json
node dist/cli.js skill path
node dist/cli.js skill install "$(mktemp -d)"
```

结论：

- `plugin list` 当前会返回 `count`
- `dc-login` 已出现在插件列表里
- `auth` 当前返回 `args`、`pageState`、`result`、`resultText`
- `auth --open` 已验证会在插件执行后把页面落到目标 URL
- `auth --save-state` 已验证会真实生成 state 文件
- `skill install` 已验证可以把 packaged skill 复制到目标目录

### profile

```bash
node dist/cli.js profile inspect ./plugins
node dist/cli.js profile open "$(mktemp -d)" about:blank
```

结论：

- `profile inspect` 当前返回 rich path inspection，不只是 `exists`
- `profile open` 会回传 profile 可用性信息并走 persistent open

### state / open 复用

```bash
node dist/cli.js open https://example.com
node dist/cli.js state save ./.tmp-auth-state.json
node dist/cli.js session close
node dist/cli.js open --state ./.tmp-auth-state.json https://example.com
node dist/cli.js page current
```

结论：

- `open --state <file> <url>` 已验证会先加载 storage state，再落到目标 URL
- 这条链就是当前“复用已登录页再直接探索”的主入口之一

### 动作面

以下手工页用 `pw code` 注入：

```bash
node dist/cli.js open about:blank
node dist/cli.js code "async page => { await page.setContent('<label for=\"name\">Name</label><input id=\"name\" placeholder=\"Your name\"><button>Save</button><div id=\"status\">idle</div><script>const input=document.getElementById(\"name\");const status=document.getElementById(\"status\");document.querySelector(\"button\").addEventListener(\"click\",()=>{status.textContent=input.value||\"saved\"});input.addEventListener(\"keydown\",e=>{if(e.key===\"Enter\"){status.textContent=input.value||\"saved-enter\";}});</script>'); return 'ready'; }"
node dist/cli.js fill --selector '#name' Alice
node dist/cli.js click --role button --name Save
node dist/cli.js read-text --selector '#status'
node dist/cli.js code "async page => { await page.locator('#name').fill(''); await page.locator('#name').focus(); return 'focused'; }"
node dist/cli.js type Bob
node dist/cli.js press Enter
node dist/cli.js scroll down 200
```

结论：

- `fill --selector` 可用
- semantic `click` 可用
- `type` / `press` / `scroll` 可执行
- 这轮 smoke 里 `press Enter` 没有把 `#status` 改成预期值，当前只能证明命令执行，不证明这个交互闭环稳定

### console / network

```bash
node dist/cli.js session close
node dist/cli.js code --file ./scripts/manual/console-network.js
node dist/cli.js click --selector '#fire'
node dist/cli.js code "async page => { return await page.evaluate(() => document.querySelector('#status')?.textContent); }"
node dist/cli.js console
PWCLI_RAW_OUTPUT=1 node dist/cli.js network
```

结论：

- `console.summary` 当前已验证会返回 `total/errors/warnings/sample[]`
- `network.summary` 当前已验证会返回 `total/sample[]`
- 这两者仍然只是摘要层，不是完整事件流系统

### upload / drag / download

```bash
node dist/cli.js session close
node dist/cli.js code --file ./scripts/manual/upload-drag-download.js
node dist/cli.js upload --selector '#f' ./package.json
node dist/cli.js code "async page => { return await page.evaluate(() => ({ name: document.querySelector('#name')?.textContent, files: document.querySelector('#f')?.files?.length || 0 })); }"
node dist/cli.js drag --from-selector '#src' --to-selector '#dst'
node dist/cli.js code "async page => { return await page.evaluate(() => ({ text: document.querySelector('#dst')?.textContent, dropped: document.querySelector('#dst')?.dataset.dropped })); }"
node dist/cli.js download --selector '#dl' --dir ./.tmp-downloads
ls -la ./.tmp-downloads
```

结论：

- `upload` 已验证页面后验：`package.json` / `files: 1`
- `drag` 已验证页面后验：`text: "dragged"` / `dropped: "1"`
- `download` 已验证会把 `sample.txt` 落到 `./.tmp-downloads/`

### connect

```bash
node scripts/manual/connect-target.js
node dist/cli.js connect --ws-endpoint <printed-ws-endpoint>
node dist/cli.js page current
```

结论：

- `connect` 已验证可以附着到手工启动的 Playwright ws target
- `page current` 可读出 attach 后的当前页

## 已真实观察到的异常或限制

### session status

```bash
node dist/cli.js session status
```

现象：

- 它经常返回 `{ active: false }`
- 即使上一条 `open` 刚成功，这个值也可能还是 `false`

结论：

- 当前 `session status` 只能当 best-effort 视图

### `code` 作为首条命令的稳定性

现象：

- `pw code ...` 本身能跑
- 但把它当整条工作流的起点时，后续命令更容易撞到 session/page 已关闭

结论：

- 当前人肉 smoke 仍建议先 `open`

## 本轮没有做功能性验证

- `wait --request/--response/--method/--status`
- 更复杂的多 tab / frame / dialog 工作流
- `download` 在 `file://` 打开的本地下载页上仍不写成稳定 contract
- `dc-login` 在当前环境里的完整动态登录链路；当前只验证了插件接入和参数解析，未把它写成稳定主路

这些都不能写成“已人工验证通过”。

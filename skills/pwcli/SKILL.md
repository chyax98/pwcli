---
name: pwcli
description: "Use pwcli for browser automation, page exploration, diagnostics, screenshots, network/console inspection, mocks, state reuse, and auth providers."
---

# pwcli

`pwcli` 是 Agent-first Playwright CLI。把它当作浏览器执行器：先开 named session，再观察页面、执行动作、等待变化、验证结果、收集证据。

本文件覆盖约 80% 高频任务。需要完整参数、错误码或专项工作流时，按文末路由进入 `references/` / `workflows/` / `domains/`。

## 0. 硬规则

- 新任务、新系统、新 URL、新登录态：默认新建 named session。
- 用户说“继续 / 接着 / 刚才那个页面”：复用原 session。
- `session create|attach|recreate` 是唯一 lifecycle 主路。
- `open` 只在已有 session 里导航，不创建 session、不改变 headed/profile/state。
- `auth` 只执行内置 auth provider，不创建 session、不决定 browser shape。
- `batch` 只编排已有 single session 的稳定 `string[][]` 子集；不承载 lifecycle/auth/environment/dialog recovery/diagnostics query。
- 所有浏览器命令显式带 session；实战优先 `-s <name>`，解释 contract 或脚本断言时用 `--session <name>`。
- session 名最长 16 字符，只用字母、数字、`-`、`_`。
- 同一 session 的依赖步骤按顺序执行，不要外层并发发同一 session 的动作或 lifecycle。
- 默认 stdout 给 Agent 阅读；脚本解析和字段断言才用 `--output json`。

## 1. 快速路由

| 你要做什么 | 先读 / 先用 |
|---|---|
| 常规页面任务 | 本文件 |
| 精确命令参数 | `references/command-reference.md` |
| diagnostics / console / network / trace | `references/command-reference-diagnostics.md` |
| auth / state / batch / environment / bootstrap / code | `references/command-reference-advanced.md` |
| 错误码、阻断态、恢复路径 | `references/failure-recovery.md` |
| 标准任务链路 | `references/workflows.md` |
| Forge/DC 登录专项 | `references/forge-dc-auth.md` |
| 领域边界和误用 | `domains/README.md` |

## 2. 标准闭环

### 探索页面

```bash
pw session create explore-a --headed --open '<url>'
pw status -s explore-a
pw read-text -s explore-a --max-chars 2000
pw snapshot -i -s explore-a
```

成功判据：知道当前 URL/标题、主要可见文本、关键可交互节点或下一步定位方式。

### 动作闭环

```bash
pw click -s explore-a --text '<button-or-link-text>'
pw wait network-idle -s explore-a
pw verify text -s explore-a --text '<expected-text>'
pw diagnostics digest -s explore-a
```

动作后如果依赖导航、请求或 DOM 更新，必须补 `wait` 和 read-only 验证，不要只看 click 成功。

### Bug 复现

```bash
pw session create bug-a --headed --open '<url>'
pw errors clear -s bug-a
pw read-text -s bug-a --max-chars 2000
pw click -s bug-a --text '<action>'
pw wait network-idle -s bug-a
pw diagnostics digest -s bug-a
pw console -s bug-a --level error --limit 20
pw network -s bug-a --status 500 --limit 20
pw errors recent -s bug-a --limit 20
```

报告 bug 必须给：页面 URL、复现动作、console/network/errors 证据、严重级别、是否阻塞主流程。

## 3. Session 和导航

新建 session：

```bash
pw session create task-a --headed --open '<url>'
pw session create task-a --no-headed --open '<url>'
```

复用本机 Chrome profile：

```bash
pw profile list-chrome
pw session create task-a --from-system-chrome --chrome-profile Default --headed --open '<url>'
pw auth probe -s task-a
```

已有 session 换 URL：

```bash
pw open -s task-a '<next-url>'
```

恢复或改变 browser shape：

```bash
pw session recreate task-a --headed --open '<url>'
```

只在继续旧任务时查状态：

```bash
pw session list --with-page
pw session status task-a
```

清理：

```bash
pw session close task-a
pw session close --all
```

## 4. 页面观察和定位

默认低噪声顺序：

```bash
pw status -s task-a
pw page current -s task-a
pw read-text -s task-a --max-chars 2000
pw locate -s task-a --text '<visible-text>'
pw snapshot -i -s task-a
```

状态读取 / 断言：

```bash
pw get text -s task-a --selector '<selector>'
pw get count -s task-a --selector '.row'
pw is visible -s task-a --role button --name '<name>'
pw verify text -s task-a --text '<expected-text>'
pw verify visible -s task-a --selector '<selector>'
```

规则：

- `status` 看页面、dialog、console、network、errors、routes、bootstrap、modal 摘要；`observe` 仍作为兼容别名。
- `read-text` 适合快速理解页面。
- `locate|get|is|verify` 是 read-only state check，不返回 ref、不规划动作。
- 需要 ref 或页面结构时用 `snapshot -i`；全量 `snapshot` 放最后。
- 语义定位（`--text`、`--label`、`--placeholder`、`--role --name`）是 substring 匹配；多匹配用 `--nth`。

截图 / PDF 证据：

```bash
pw screenshot -s task-a --path ./evidence.png --full-page
pw screenshot -s task-a --selector '.panel' --path ./panel.png
pw pdf -s task-a --path ./page.pdf
```

多页面：

```bash
pw page list -s task-a
pw tab select <pageId> -s task-a
pw tab close <pageId> -s task-a
pw page frames -s task-a
pw page dialogs -s task-a
```

`tab select|close` 只接受 `pageId`，不要用 index/title/URL substring 做写操作目标。
`page dialogs` 只是在未阻塞状态下读取 observed dialog events，不是 pending browser dialog live list。

## 5. 页面动作

优先 selector 或语义定位；已有 fresh snapshot ref 时可用 ref。

```bash
pw click -s task-a --selector 'button[type=submit]'
pw click -s task-a --role button --name '提交'
pw click -s task-a --text '继续'
pw click e42 -s task-a

pw fill -s task-a --label 'Email' 'user@example.com'
pw fill -s task-a --placeholder 'Search' 'keyword'
pw type -s task-a --role textbox --name 'Comment' 'hello'
pw press Enter -s task-a

pw check -s task-a --selector '#agree'
pw uncheck -s task-a --selector '#agree'
pw select -s task-a --selector '#country' jp
pw hover -s task-a --selector '.menu-trigger'
pw scroll down 800 -s task-a
pw drag -s task-a --from-selector '.source' --to-selector '.target'
```

动作后等待：

```bash
pw wait network-idle -s task-a
pw wait -s task-a --text '<expected-text>'
pw wait -s task-a --selector '.loaded'
pw wait -s task-a --response '/api/items' --status 200
```

文件：

```bash
pw upload -s task-a --selector 'input[type=file]' ./fixture.png
pw wait -s task-a --text '上传成功'
pw download -s task-a --selector 'a.download' --dir ./downloads
```

响应式：

```bash
pw resize -s task-a --preset iphone
pw read-text -s task-a --max-chars 1200
pw screenshot -s task-a --path ./mobile.png --full-page
```

## 6. Diagnostics 和证据

第一入口：

```bash
pw diagnostics digest -s bug-a
pw console -s bug-a --level error --limit 20
pw network -s bug-a --status 400 --limit 20
pw network -s bug-a --status 500 --limit 20
pw errors recent -s bug-a --limit 20
```

按接口查：

```bash
pw network -s bug-a --url '/api/items' --limit 20
pw network -s bug-a --request-id <id>
pw network -s bug-a --kind requestfailed --limit 20
```

导出 / bundle：

```bash
pw diagnostics export -s bug-a --section network --text '<request-id-or-text>' --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out ./diag.json
pw diagnostics bundle -s bug-a --out ./bundle-bug-a --limit 20
```

如果 session 已被 browser dialog 阻塞，`diagnostics bundle` 也会返回 `MODAL_STATE_BLOCKED`，不能绕过 dialog 生成完整 bundle。先按第 7 节恢复，恢复后再 bundle。

Run evidence：

```bash
pw diagnostics runs --session bug-a --limit 20
pw diagnostics digest --run <runId>
pw diagnostics show --run <runId> --command click --limit 10
pw diagnostics grep --run <runId> --text '<error-or-request-id>' --limit 10
pw diagnostics timeline --session bug-a --limit 50
```

Trace：

```bash
pw trace start -s bug-a
pw trace stop -s bug-a
pw trace inspect <traceArtifactPath> --section actions
pw trace inspect <traceArtifactPath> --section requests --failed
pw trace inspect <traceArtifactPath> --section console --level error
```

HAR start/stop 当前不是稳定证据录制路径；稳定诊断优先 `network`、`diagnostics export`、`diagnostics bundle`、trace inspect。

## 7. Dialog、modal 和卡死恢复

未阻塞时先看状态：

```bash
pw status -s bug-a
pw page dialogs -s bug-a
```

如果 action 返回 `modalPending=true` 或错误码 `MODAL_STATE_BLOCKED`，不要继续堆叠 `page dialogs` / `status` 读取，直接处理 browser dialog：

```bash
pw dialog accept -s bug-a
pw dialog dismiss -s bug-a
```

如果要形成可交接证据，先用 `pw doctor -s bug-a` 确认 `modal-state`，再 `dialog accept|dismiss`，恢复后执行 `diagnostics bundle`。

仍不可恢复：

```bash
pw doctor -s bug-a
pw session recreate bug-a --headed --open '<url>'
```

遇到错误码先查 `references/failure-recovery.md`，不要把 limitation code 包装成已支持。

## 8. Auth 和状态复用

Auth provider 是内置 registry 能力，不是 plugin。

```bash
pw session create auth-a --headed --open '<url>'
pw auth list
pw auth info <provider>
pw auth <provider> -s auth-a
pw auth probe -s auth-a
pw read-text -s auth-a --max-chars 1200
```

Provider 参数只用 `--arg key=value`：

```bash
pw auth <provider> -s auth-a --arg targetUrl='<url>'
pw auth <provider> -s auth-a --save-state ./auth.json
```

Forge/DC 路由规则（Agent 只读主文档时也必须能判定）：

- 看到 Forge / DC / DC2 / 开发者后台 / developer console，优先用内置 `dc` provider。
- 用户给了具体 Forge/DC URL：创建 session 后直接 `pw auth dc -s <name> --arg targetUrl='<url>'`，不要要求先 `open`。
- 已有 session 当前页就是 Forge/DC：直接 `pw auth dc -s <name>`。
- 没有 URL、当前页也不是 Forge/DC：不要猜环境域名，让 provider 使用默认目标。
- 不手填登录页，不把 `dc2` 当 `instance`，参数以 `pw auth info dc` 和 `references/forge-dc-auth.md` 为准。

```bash
pw session create dc-main --headed
pw auth dc -s dc-main --arg targetUrl='<forge-url>'
pw read-text -s dc-main --max-chars 1200
pw status -s dc-main
```

专项失败、缺手机号/验证码、目标错误、登录后仍在登录页：跳 `references/forge-dc-auth.md`。

状态复用：

```bash
pw state save ./auth.json -s auth-a
pw session create auth-b --state ./auth.json --headed --open '<url>'
pw cookies list -s auth-b --domain example.com
pw storage local -s auth-b
```

Storage mutation 只改当前页 origin：

```bash
pw storage local set -s auth-b featureFlag enabled
pw storage local delete -s auth-b featureFlag
```

## 9. Controlled testing

Route mock：

```bash
pw route add '**/api/**' -s test-a --method GET --status 200 --content-type application/json --body '{"ok":true}'
pw route list -s test-a
pw route remove '**/api/**' -s test-a
```

多条 route 在主链里优先逐条 `route add`，或用 `batch` 串行编排多个 `route add`；当前没有顶层 `pw route load` 命令。

Environment：

```bash
pw environment offline on -s test-a
pw environment offline off -s test-a
pw environment geolocation set -s test-a --lat 37.7749 --lng -122.4194
pw environment permissions grant geolocation -s test-a
pw environment clock install -s test-a
pw environment clock set -s test-a 2024-12-10T10:00:00.000Z
pw environment clock resume -s test-a
```

Bootstrap：

```bash
pw bootstrap apply -s test-a --init-script ./bootstrap.js
pw bootstrap apply -s test-a --headers-file ./headers.json
```

典型链路：

```bash
pw session create test-a --no-headed --open '<url>'
pw route add '**/api/**' -s test-a --method GET --status 200 --content-type application/json --body '{"ok":true}'
pw bootstrap apply -s test-a --init-script ./bootstrap.js
pw click -s test-a --selector '<selector>'
pw wait -s test-a --text '<expected>'
pw verify text -s test-a --text '<expected>'
```

## 10. Batch 和 `pw code`

`batch` 输入只接受 `string[][]`：

```bash
printf '%s\n' '[["read-text","--max-chars","1000"],["click","--selector","button[type=submit]"],["wait","network-idle"]]' | pw batch --session task-a --stdin-json
pw batch --output json --session task-a --file ./steps.json
```

规则：

- `pw batch --stdin-json` 表示 stdin steps 是 JSON，不表示输出 JSON。
- 脚本解析必须用 `pw batch --output json ...`。
- batch 适合单 session 串行动作，不适合 lifecycle/auth/environment/dialog recovery/diagnostics query。
- 超出稳定子集时，直接跑单命令或用 `pw code`。

`pw code` 是快速探索和 escape hatch，不是最后手段：

```bash
pw code -s task-a "async page => JSON.stringify({ title: await page.title(), url: page.url() })"
pw code -s task-a --file ./script.js
```

适合：一次读取多个 DOM 状态、localStorage、computed state、组合 Playwright 逻辑。保持小步可恢复；长导航或长网络等待优先拆成一等命令 + `pw wait`。

## 11. 禁止事项

- 不把 `open` 当 lifecycle。
- 不让 `auth` 创建 session。
- 不把 `pw batch --stdin-json` 当输出 JSON。
- 不把 `locate|get|is|verify` 当 action planner。
- 不忽略 limitation code。
- 不把 HAR 热录制、raw CDP、observe stream 等边界能力包装成稳定支持。
- 不为了省命令跳过动作后的 `wait` 和复查。

## 12. 参考

- `references/command-reference.md` — session、页面读取、动作、等待
- `references/command-reference-diagnostics.md` — console / network / errors / diagnostics / route / trace
- `references/command-reference-advanced.md` — state / auth / batch / environment / bootstrap / `pw code`
- `references/forge-dc-auth.md` — Forge/DC provider 参数和失败分支
- `references/failure-recovery.md` — 错误码、阻断态、恢复升级路径
- `references/gotchas.md` — 常见误用
- `references/workflows.md` — 工作流路由入口
- `workflows/browser-task.md` — 页面探索与动作闭环
- `workflows/diagnostics.md` — 复现与诊断闭环
- `workflows/controlled-testing.md` — mock + environment + bootstrap 确定性链路
- `domains/README.md` — command domain 详细边界

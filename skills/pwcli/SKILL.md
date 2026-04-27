---
name: pwcli
description: Use when an agent needs to drive a browser with `pw` for page exploration, QA, bug reproduction, auth reuse, Forge/DC login, network/console diagnostics, route mock, or controlled browser state. Triggers on "用 pw", "打开页面看看", "点一下", "继续探索", "诊断页面", "看 network", "dc2", "Forge 登录", "developer-*.tap.dev/forge", "自动化测试".
---

# pwcli

`pwcli` 是 Agent-first Playwright CLI。用它完成页面探索、动作执行、bug 定位、全链路诊断、受控自动化测试。不要临时绕过到裸 Playwright，除非你明确选择 `pw code` 作为快速执行通道。

## 总原则

- 新任务、新系统、新 URL、新登录态：默认新建 named session。
- 用户说“继续 / 接着 / 刚才那个页面”：复用原 session。
- `session create|attach|recreate` 是 lifecycle 主路。
- `open` 只在已有 session 里导航，不负责创建、profile、state、headed。
- `auth` 只执行内置 provider，不负责创建 session。
- 所有浏览器命令显式带 `--session <name>`。
- session 名最长 16 字符，只用字母、数字、`-`、`_`。
- 默认 stdout 给 Agent 阅读；脚本解析和字段断言才用 `--output json`。

## 1. 能力地图

| 目标 | 首选命令 | 什么时候用 |
|---|---|---|
| 新开浏览器任务 | `session create` | 新任务、新 URL、新登录态 |
| 继续当前页面 | `session list/status` | 用户明确说继续旧任务 |
| 已有 session 导航 | `open` | 只换 URL，不换 browser shape |
| 页面理解 | `observe status`、`page current`、`read-text` | 默认观察路径 |
| 结构定位 | `snapshot` | 需要 aria ref 或页面结构 |
| 页面动作 | `click/fill/type/press/scroll/drag` | 稳定动作，带 action 记录 |
| 文件交互 | `upload/download` | 上传文件、验证下载 |
| 等待状态 | `wait` | 动作后依赖页面变化 |
| 快速脚本 | `code` | 多状态读取、组合动作、能力未覆盖 |
| 登录 | `auth <provider>` | 内置 provider，如 `dc` |
| 状态复用 | `state/cookies/storage` | 保存登录态、检查存储 |
| 诊断 | `diagnostics/console/network/errors/doctor` | bug 定位和证据导出 |
| Mock | `route` | 网络请求 mock、patch、abort |
| 浏览器环境 | `environment` | 离线、地理位置、权限、时钟 |
| 注入启动项 | `bootstrap` | init script、headers |
| 串行编排 | `batch` | 单 session 稳定子集 |

## 2. Session

创建新页面调查：

```bash
pw session create bug-a --headed --open 'https://example.com'
```

无头自动化：

```bash
pw session create bug-a --headless --open 'https://example.com'
```

已有 session 内换 URL：

```bash
pw open --session bug-a 'https://example.com/next'
```

恢复或改变 browser shape：

```bash
pw session recreate bug-a --headed --open 'https://example.com'
```

只在继续旧任务时查现状：

```bash
pw session list
pw session list --with-page
pw session status bug-a
```

清理：

```bash
pw session close bug-a
pw session close --all
```

## 3. 页面观察

默认先用低噪声命令，不先打大 snapshot：

```bash
pw observe status --session bug-a
pw page current --session bug-a
pw read-text --session bug-a --max-chars 2000
```

用途：

- `observe status`：页面、dialog、console、network、errors、routes、bootstrap 的 compact 摘要。
- `page current`：当前 page projection。
- `read-text`：可见文本，适合快速理解页面。
- `snapshot`：需要 aria ref 或页面结构时再用。

需要 ref 点击或结构定位：

```bash
pw snapshot --session bug-a
```

截图证据：

```bash
pw screenshot --session bug-a --path ./evidence.png --full-page
pw screenshot --session bug-a --selector '.panel' --path ./panel.png
```

查看多页面和 frame：

```bash
pw page list --session bug-a
pw page frames --session bug-a
pw page dialogs --session bug-a
```

## 4. 页面动作

优先 selector 或语义定位；已有 snapshot ref 时用 ref。

```bash
pw click --session bug-a --selector 'button[type=submit]'
pw fill --session bug-a --selector 'input[name=phone]' '19545672859'
pw click --session bug-a --role button --name '提交'
pw click --session bug-a --text '继续'
pw click --session bug-a e42
pw press --session bug-a Enter
pw type --session bug-a --selector 'textarea' 'hello'
pw scroll --session bug-a down 800
pw drag --session bug-a --from-selector '.source' --to-selector '.target'
```

动作后如果依赖导航、请求、DOM 更新，必须等待：

```bash
pw wait --session bug-a network-idle
pw wait --session bug-a --text '保存成功'
pw wait --session bug-a --selector '.loaded'
pw wait --session bug-a --response '/api/app/v2/detail' --status 200
```

动作闭环：

```bash
pw click --session bug-a --text '提交'
pw wait --session bug-a network-idle
pw read-text --session bug-a --max-chars 2000
pw diagnostics digest --session bug-a
```

文件上传下载：

```bash
pw upload --session bug-a --selector 'input[type=file]' ./fixture.png
pw download --session bug-a --selector 'a.download' --dir ./downloads
pw download --session bug-a e42 --path ./downloads/report.csv
```

响应式检查：

```bash
pw resize --session bug-a --preset iphone
pw resize --session bug-a --view 390x844
pw read-text --session bug-a --max-chars 1200
pw screenshot --session bug-a --path ./mobile.png --full-page
```

## 5. `pw code` 策略

`pw code` 不是最后手段。它是快速探索、复杂判断、组合动作的执行通道。它底层直接在 managed session 里跑 Playwright 代码，适合减少多次 CLI 往返。

优先用 `pw code`：

- 一次读取多个 DOM 状态、全局变量、localStorage、computed state。
- 快速验证 selector、页面假设、业务状态。
- 执行多步 Playwright 逻辑，拆成多个命令反而慢。
- 跑本地脚本：`pw code --file <path>`。
- 一等命令没有覆盖当前 Playwright 能力。

优先用一等命令：

- 需要稳定 action 记录和 diagnostics delta。
- 需要标准化 text/json 输出给其他 Agent 或脚本。
- 高频动作：`click`、`fill`、`wait`、`read-text`、`network`、`console`、`errors`、`route`、`environment`。

示例：

```bash
pw code --session bug-a "async page => {
  return JSON.stringify({
    title: await page.title(),
    url: page.url(),
    buttons: await page.locator('button').allTextContents()
  });
}"
```

限制：

- 遇到 browser modal 可能返回 `MODAL_STATE_BLOCKED`，先用 `dialog accept|dismiss` 或 `doctor`。
- 返回值要自己设计，审计性不如一等命令。

## 6. Bug 诊断

页面异常、白屏、按钮无效、跳转错误、接口失败，按这个顺序查：

```bash
pw diagnostics digest --session bug-a
pw console --session bug-a --level error --limit 20
pw network --session bug-a --status 400 --limit 20
pw network --session bug-a --status 500 --limit 20
pw errors recent --session bug-a --limit 20
```

先清错误基线再复现：

```bash
pw errors clear --session bug-a
pw click --session bug-a --text '提交'
pw wait --session bug-a network-idle
pw diagnostics digest --session bug-a
```

查具体接口：

```bash
pw network --session bug-a --url '/api/app/v2/detail' --limit 20
pw network --session bug-a --request-id <id>
pw network --session bug-a --kind requestfailed --limit 20
pw network --session bug-a --method POST --text 'developer_id' --limit 20
```

导出证据：

```bash
pw diagnostics export --session bug-a --section network --text 'developer_id' --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out ./diag.json
```

回放 run：

```bash
pw diagnostics runs --session bug-a --limit 20
pw diagnostics show --run <runId> --command click --limit 10
pw diagnostics grep --run <runId> --text 'CHECKOUT_TIMEOUT' --limit 10
```

报告 bug 必须给：页面 URL、复现动作、console/network/errors 证据、严重级别、是否阻塞主流程。

Trace / HAR：

```bash
pw trace start --session bug-a
pw trace stop --session bug-a
pw har start ./bug.har --session bug-a
pw har stop --session bug-a
```

HAR 热录制当前只暴露 substrate 边界，稳定诊断仍优先 `network` 和 `diagnostics export`。

## 7. Dialog 和卡死恢复

先看 compact 状态：

```bash
pw observe status --session bug-a
pw doctor --session bug-a
```

browser dialog 阻塞：

```bash
pw dialog accept --session bug-a
pw dialog dismiss --session bug-a
```

恢复失败再重建：

```bash
pw session recreate bug-a --headed --open '<url>'
```

`page dialogs` 是事件投影，不是 authoritative live dialog set。

## 8. Auth

Forge/DC 登录是内置 provider 场景。主路径：

```bash
pw session create dc2 --headed
pw auth dc --session dc2
pw read-text --session dc2 --max-chars 1200
```

URL 规则：

- 用户给 URL：先 `pw session create dc2 --headed --open '<url>'`，再 `pw auth dc --session dc2 --arg targetUrl='<url>'`。
- 用户明确说 RND：`pw session create dc2 --headed --open 'https://developer.xdrnd.cn/forge'`，再 `pw auth dc --session dc2`。
- 用户没给 URL 且没说 RND：不要问，直接执行主路径。
- 主路径失败且错误要求 `targetUrl`：让用户给 Forge 链接，再执行 `pw auth dc --session dc2 --arg targetUrl='<url>'`。

硬规则：

- `dc2.0` 是系统名，不是 `instance=2`。
- 禁止猜 `developer-p2-*`。
- 禁止手填手机号、短信码、登录表单。
- 用户给 URL 就作为 `targetUrl` 传给 `pw auth dc`。
- 用户没给 URL 且没说 RND 时，直接执行默认登录命令，不先问 URL。

手机号优先级：

- 用户本轮给的手机号。
- 默认测试账号：`19545672859`。

更细失败分支见 `references/forge-dc-auth.md`。

## 9. 状态复用

保存登录态：

```bash
pw state save ./auth.json --session bug-a
```

用 state 创建新 session：

```bash
pw session create bug-b --state ./auth.json --headed --open 'https://example.com'
```

已有 session 加载 state：

```bash
pw state load ./auth.json --session bug-a
```

Cookie / storage 读取：

```bash
pw cookies list --session bug-a --domain example.com
pw storage local --session bug-a
pw storage session --session bug-a
```

设置 cookie：

```bash
pw cookies set --session bug-a --name token --value '<value>' --domain example.com --path /
```

Profile 检查：

```bash
pw profile inspect ./profile
pw session create bug-a --profile ./profile --persistent --headed --open 'https://example.com'
```

## 10. Controlled Testing

Mock 单个接口：

```bash
pw route add '**/api/**' --session bug-a --method GET --status 200 --content-type application/json --body '{"ok":true}'
pw route list --session bug-a
```

按请求体匹配：

```bash
pw route add '**/api/**' --session bug-a --method POST --match-body 'fail500' --status 200 --content-type application/json --body '{"ok":true}'
```

Patch upstream JSON：

```bash
pw route add '**/api/**' --session bug-a --patch-json-file ./patch.json --patch-status 298
```

批量加载 route：

```bash
pw route load ./routes.json --session bug-a
```

环境控制：

```bash
pw environment offline on --session bug-a
pw environment offline off --session bug-a
pw environment geolocation set --session bug-a --lat 37.7749 --lng -122.4194
pw environment permissions grant geolocation --session bug-a
pw environment permissions clear --session bug-a
pw environment clock install --session bug-a
pw environment clock set --session bug-a 2024-12-10T10:00:00.000Z
pw environment clock resume --session bug-a
```

Bootstrap：

```bash
pw bootstrap apply --session bug-a --init-script ./bootstrap.js
pw bootstrap apply --session bug-a --headers-file ./headers.json
```

清理 route：

```bash
pw route remove '**/api/**' --session bug-a
pw route remove --session bug-a
```

## 11. Batch 和输出

脚本解析 stdout 必须加 `--output json`：

```bash
pw --output json read-text --session bug-a
```

`batch` 输入只接受 `string[][]`：

```bash
printf '%s\n' '[["read-text","--max-chars","1000"],["click","--text","提交"],["wait","network-idle"]]' | pw batch --session bug-a --stdin-json
pw batch --session bug-a --file ./steps.json
```

注意：

- `pw batch --stdin-json` 表示 stdin steps 是 JSON，不表示输出 JSON。
- 要 JSON 输出：`pw --output json batch --session bug-a --stdin-json`。
- `batch` 适合单 session 串行动作，不适合 lifecycle/auth/environment/dialog recovery。
- 超出稳定子集时，直接跑单命令或用 `pw code`。

## 12. 标准任务模板

探索页面：

```bash
pw session create explore-a --headed --open '<url>'
pw observe status --session explore-a
pw read-text --session explore-a --max-chars 2000
pw snapshot --session explore-a
```

复现 bug：

```bash
pw session create bug-a --headed --open '<url>'
pw errors clear --session bug-a
pw read-text --session bug-a --max-chars 2000
pw click --session bug-a --text '<action>'
pw wait --session bug-a network-idle
pw diagnostics digest --session bug-a
pw console --session bug-a --level error --limit 20
pw network --session bug-a --status 500 --limit 20
```

验证接口请求：

```bash
pw session create api-a --headed --open '<url>'
pw click --session api-a --text '<action>'
pw wait --session api-a --response '<api path>' --status 200
pw network --session api-a --url '<api path>' --limit 10
```

确定性自动化：

```bash
pw session create test-a --headless --open '<url>'
pw route load ./routes.json --session test-a
pw bootstrap apply --session test-a --init-script ./bootstrap.js
pw click --session test-a --selector '<selector>'
pw wait --session test-a --text '<expected>'
pw --output json read-text --session test-a --max-chars 1000
```

## 13. 降噪

- 页面内容：`read-text --max-chars <n>`。
- 观察状态：先 `observe status`，不够再 `--verbose`。
- console/network/errors：用 `--limit`、`--text`、`--since`。
- diagnostics export/show/grep：用 `--fields`，支持 `alias=path`。
- 大页面不要先 `snapshot`。
- 必须找 ref 时用 `pw snapshot --compact --session <name>`，不够再全量 `snapshot`。

## 14. 禁止事项

- 不要把 `open` 当成 session lifecycle。
- 不要让 `auth` 创建 session。
- 不要把 `dc2.0` 推断成 `instance=2`。
- 不要猜不存在的 `developer-p2-*`。
- 不要在 Forge/DC 场景手填登录表单。
- 不要把 `pw batch --stdin-json` 当成输出 JSON。
- 不要忽略 limitation code。
- 不要把 HAR 热录制、raw CDP substrate 等边界能力包装成稳定支持。
- 不要为了省命令跳过动作后的 `wait` 和复查。

## 15. 高代价坑

- 新任务默认新 session，不要把旧 session 当入口。见 `references/gotchas.md#new-session`。
- Forge/DC 登录走 `pw auth dc`，不要手填登录页。见 `references/gotchas.md#forge-dc-auth`。
- `dc2.0` 是系统名，不是 `instance=2`。见 `references/gotchas.md#dc2-system-name`。
- `pw code` 是快速路径，不是最后手段。见 `references/gotchas.md#code-fast-path`。
- 脚本解析用 `--output json`，不要误解 `batch --stdin-json`。见 `references/gotchas.md#output-json`。
- 大页面先 `read-text`，需要 ref 再 `snapshot`。见 `references/gotchas.md#snapshot-late`。

## 16. 参考

- 完整命令：`references/command-reference.md`
- Forge/DC 登录细节：`references/forge-dc-auth.md`
- 失败恢复：`references/failure-recovery.md`
- 已知坑点：`references/gotchas.md`
- 维护规则：`rules/core-usage.md`

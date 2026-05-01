---
name: pwcli
description: "Use pwcli for browser automation, page exploration, diagnostics, screenshots, network/console inspection, mocks, state reuse, and auth providers."
---

# pwcli

`pwcli` 是 Agent-first Playwright CLI，定位是**工具型执行器**：优先给出可执行命令链路，不展开原理教学。用它完成页面探索、动作执行、bug 定位、全链路诊断、受控自动化测试。不要临时绕过到裸 Playwright，除非你明确选择 `pw code` 作为快速执行通道。

主 skill 目标是覆盖约 70%~80% 的高频任务；超出主链时，按本文件末尾的相对路径路由到 `references/` 与 `workflows/`。


## 快速路由（先看这里）

- 你只需要完成常规浏览器任务（探索、点击、等待、取证）：继续读本文件即可。
- 你需要精确参数口径：跳转 `references/command-reference.md`。
- 你在做 bug 诊断与证据导出：跳转 `references/command-reference-diagnostics.md` 与 `workflows/diagnostics.md`。
- 你在做 auth/state/batch/environment：跳转 `references/command-reference-advanced.md`。
- 你遇到错误码或阻断态：跳转 `references/failure-recovery.md`。
- 你需要任务链路模板：跳转 `references/workflows.md`（再按索引进入 `workflows/*.md`）。
- 你需要某个 command domain 的详细说明：跳转 `domains/README.md`。

## 总原则

- 新任务、新系统、新 URL、新登录态：默认新建 named session。
- 用户说“继续 / 接着 / 刚才那个页面”：复用原 session。
- `session create|attach|recreate` 是 lifecycle 主路。
- `open` 只在已有 session 里导航，不负责创建、profile、state、headed。
- `auth` 只执行内置 auth provider，不负责创建 session；没有外部 plugin 机制。
- 所有浏览器命令显式带 session，实战优先 `-s <name>`，解释 contract 时用 `--session <name>`。
- session 名最长 16 字符，只用字母、数字、`-`、`_`。
- 同一个 session 的 lifecycle startup/reset/close 和命令 dispatch 按 per-session lock 串行进入 Playwright；依赖步骤仍按顺序写，不要在外层并发发同一 session 的动作或同名 lifecycle 命令。
- 默认 stdout 给 Agent 阅读；脚本解析和字段断言才用 `--output json`。

## 命令风格

- `-s <name>` 等价于 `--session <name>`。
- 高频探索、动作、诊断链路优先用 `-s`，减少 token 和输入噪声。
- 第一次解释命令语义、写 reference、写脚本断言时保留 `--session`。
- 复杂定位参数保留长参数，例如 `--selector`、`--role`、`--text`、`--response`。

推荐组合要按真实页面状态裁剪，不要机械全跑。

```bash
# 快速理解页面
pw observe status -s bug-a
pw read-text -s bug-a
pw locate -s bug-a --text '保存成功'
pw get count -s bug-a --selector '.row'
pw is visible -s bug-a --selector '#submit'
pw verify text -s bug-a --text '保存成功'
pw snapshot -i -s bug-a

# 动作闭环
pw click e42 -s bug-a
pw wait network-idle -s bug-a
pw diagnostics digest -s bug-a

# 多页面
pw page list -s bug-a
pw tab select <pageId> -s bug-a
pw tab close <pageId> -s bug-a

# 失败复现
pw errors clear -s bug-a
pw click e42 -s bug-a
pw wait network-idle -s bug-a
pw diagnostics digest -s bug-a
```

## 1. 能力地图

| 目标 | 首选命令 | 什么时候用 |
|---|---|---|
| 新开浏览器任务 | `session create` | 新任务、新 URL、新登录态 |
| 继续当前页面 | `session list/status` | 用户明确说继续旧任务 |
| 已有 session 导航 | `open` | 只换 URL，不换 browser shape |
| 页面理解 | `observe status`、`page current`、`read-text` | 默认观察路径 |
| 状态读取 / 断言 | `locate`、`get`、`is`、`verify` | 低噪声检查元素是否存在、读取事实、布尔状态或可执行断言 |
| 多页面切换 | `page list`、`tab select|close` | popup、新开页、OAuth/预览窗口 |
| 结构定位 | `snapshot -i` / `snapshot` | 需要 aria ref 或页面结构 |
| 页面动作 | `click/fill/type/press/hover/scroll/drag` | 稳定动作，带 action 记录 |
| 文件交互 | `upload/download` | 上传文件、验证下载 |
| 等待状态 | `wait` | 动作后依赖页面变化 |
| 快速脚本 | `code` | 多状态读取、组合动作、能力未覆盖 |
| 登录 | `auth <provider>` | 内置 provider |
| 状态复用 | `state/cookies/storage` | 保存登录态、检查存储 |
| 诊断 | `diagnostics/console/network/errors/doctor` | bug 定位和证据导出 |
| Mock | `route` | 网络请求 mock、patch、abort |
| 浏览器环境 | `environment` | 离线、地理位置、权限、时钟 |
| 注入启动项 | `bootstrap` | init script、headers |
| 串行编排 | `batch` | 单 session 稳定子集 |
| 人类观察多 session | `dashboard open` | 需要观察/接管多个 Playwright managed sessions，不是 Agent 主执行链 |

## 2. Session

创建新页面调查：

```bash
pw session create bug-a --headed --open 'https://example.com'
```

无头自动化：

```bash
pw session create bug-a --headless --open 'https://example.com'
```

复用用户本机 Chrome 登录态：

```bash
pw profile list-chrome
pw session create bug-a --from-system-chrome --chrome-profile Default --headed --open 'https://example.com'
```

`--from-system-chrome` 是 session lifecycle 能力，不是 `auth`。它用本机 Chrome user data dir 和 profile-directory 启动 managed session；如果 Chrome 正在使用同一个 profile，可能需要先关闭 Chrome 或换一个 profile。

已有 session 内换 URL：

```bash
pw open -s bug-a 'https://example.com/next'
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
pw observe status -s bug-a
pw page current -s bug-a
pw read-text -s bug-a
pw locate -s bug-a --text '提交'
pw get text -s bug-a --selector '#result'
pw is enabled -s bug-a --role button --name '提交'
pw verify visible -s bug-a --role button --name '提交'
pw verify text -s bug-a --text '保存成功'
```

用途：

- `observe status`：页面、dialog、console、network、errors、routes、bootstrap、modals 的 compact 摘要。`summary.modalCount > 0` 表示有 HTML modal 阻断交互。
- `page current`：当前 page projection。
- `read-text`：可见文本，适合快速理解页面。
- `read-text`：可见文本（含 shadow DOM 内容），overlay metadata 默认采集；用 `--no-include-overlay` 跳过 overlay 检测。
- `locate/get/is`：窄状态检查；`locate` 返回总匹配数和候选 metadata，`get/is` 返回事实或布尔值，不生成动作计划。
- `verify`：动作和 wait 之后的 read-only 断言；通过/失败都给 Agent 可消费结果，失败返回 `VERIFY_FAILED`。
- `snapshot -i`：只看可交互节点，找 ref 首选。
- `snapshot`：完整结构树，需要理解页面层级时再用。

`locate/get/is/verify` 适合脚本断言和低噪声状态读取。`locate` 的 `count` 是总匹配数，候选最多展示前 10 个；根据 `href`、`role/name`、`region`、`ancestor`、`selectorHint` 决定下一步 selector 或语义 locator。需要 fresh ref 或页面结构时继续用 `snapshot -i`；不要把这些命令当 action planner。

语义定位（`--text`、`--label`、`--placeholder`、`--role --name`）使用 substring 匹配。`--text 'Submit'` 匹配 "Submit order"，`--label 'Email'` 匹配 "Email address:"。多匹配时用 `--nth` 消歧。

需要 ref 点击或结构定位：

```bash
pw snapshot -i -s bug-a
```

大页面不要直接全量 snapshot。先缩小范围：

```bash
pw read-text -s bug-a --selector '<main-or-panel>'
pw locate -s bug-a --selector '<candidate-selector>'
pw snapshot -i -s bug-a
pw snapshot -c -s bug-a
```

只有 compact / interactive / scoped 结果不够、且确实需要完整层级时，才跑全量 `pw snapshot -s bug-a`。如果当前命令面暴露 depth 参数，优先用 depth 限制层级，不把全量 snapshot 当默认观察路径。

截图证据：

```bash
pw screenshot -s bug-a --path ./evidence.png --full-page
pw screenshot -s bug-a --selector '.panel' --path ./panel.png
```

查看多页面和 frame：

```bash
pw page list -s bug-a
pw tab select <pageId> -s bug-a
pw tab close <pageId> -s bug-a
pw page frames -s bug-a
pw page dialogs -s bug-a
```

`tab select|close` 只接受 `pageId`。先用 `page list` 找 `pageId`，不要用 index、title 或 URL substring 作为写操作目标。

## 4. 页面动作

优先 selector 或语义定位；已有 snapshot ref 时用 ref。

```bash
pw click -s bug-a --selector 'button[type=submit]'
pw fill -s bug-a --selector 'input[name=email]' 'user@example.com'
pw click -s bug-a --role button --name '提交'
pw click -s bug-a --text '继续'
pw fill -s bug-a --label 'Email' 'user@example.com'
pw fill -s bug-a --placeholder 'Search' 'keyword'
pw fill -s bug-a --test-id email-input 'user@example.com'
pw type -s bug-a --role textbox --name 'Comment' 'hello'
pw click e42 -s bug-a
pw press Enter -s bug-a
pw type -s bug-a --selector 'textarea' 'hello'
pw check -s bug-a --selector '#agree'
pw select -s bug-a --selector '#country' jp
pw hover -s bug-a --selector '.menu-trigger'
pw hover e42 -s bug-a
pw scroll down 800 -s bug-a
pw drag -s bug-a --from-selector '.source' --to-selector '.target'
```

动作后如果依赖导航、请求、DOM 更新，必须等待：

```bash
pw wait network-idle -s bug-a
pw wait -s bug-a --text '保存成功'
pw wait -s bug-a --selector '.loaded'
pw wait -s bug-a --response '/api/items' --status 200
```

动作闭环：

```bash
pw click -s bug-a --text '提交'
pw wait network-idle -s bug-a
pw verify text -s bug-a --text '保存成功'
pw diagnostics digest -s bug-a
```

文件上传下载：

```bash
pw upload -s bug-a --selector 'input[type=file]' ./fixture.png
pw wait -s bug-a --selector '.upload-ready'
pw verify text -s bug-a --text '上传成功'
pw download -s bug-a --selector 'a.download' --dir ./downloads
pw download e42 -s bug-a --path ./downloads/report.csv
```

`upload` 返回前会 best-effort 等待 input files/change settle。输出出现 `Next steps` 时，说明页面接收态无法完全判定，按提示补 `wait` / `verify` 后再继续。

响应式检查：

```bash
pw resize -s bug-a --preset iphone
pw resize -s bug-a --view 390x844
pw read-text -s bug-a --max-chars 1200
pw screenshot -s bug-a --path ./mobile.png --full-page
```

## 5. `pw code` 策略

`pw code` 不是最后手段。它是快速探索、复杂判断、组合动作的执行通道。它底层直接在 managed session 里跑 Playwright 代码，适合减少多次 CLI 往返。

优先用 `pw code`：

- 一次读取多个 DOM 状态、全局变量、localStorage、computed state。
- 快速验证 selector、页面假设、业务状态。
- 执行多步 Playwright 逻辑，拆成多个命令反而慢。
- 跑本地脚本：`pw code --file <path>`。
- 临时 flaky 动作：`pw code --retry 1 ...`。
- 一等命令没有覆盖当前 Playwright 能力。

优先用一等命令：

- 需要稳定 action 记录和 diagnostics delta。
- 需要标准化 text/json 输出给其他 Agent 或脚本。
- 高频动作：`click`、`fill`、`wait`、`read-text`、`network`、`console`、`errors`、`route`、`environment`。

示例：

```bash
pw code -s bug-a "async page => {
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
pw diagnostics digest -s bug-a
pw console -s bug-a --level error --limit 20
pw network -s bug-a --status 400 --limit 20
pw network -s bug-a --status 500 --limit 20
pw errors recent -s bug-a --limit 20
```

先清错误基线再复现：

```bash
pw errors clear -s bug-a
pw click -s bug-a --text '提交'
pw wait network-idle -s bug-a
pw diagnostics digest -s bug-a
```

如果 action / wait 失败，先查最近 run；失败事件会进入 diagnostics：

```bash
pw diagnostics runs --session bug-a --limit 5
pw diagnostics digest --run <runId>
```

如果 click 返回 `modalPending=true` / `blockedState=MODAL_STATE_BLOCKED`，表示动作已触发 alert/confirm/prompt，先 `pw dialog accept|dismiss -s bug-a`，不要把它当成普通点击失败重试。

查具体接口：

```bash
pw network -s bug-a --url '/api/items' --limit 20
pw network -s bug-a --request-id <id>
pw network -s bug-a --kind requestfailed --limit 20
pw network -s bug-a --method POST --text 'request_id' --limit 20
```

导出证据：

```bash
pw diagnostics export -s bug-a --section network --text 'request_id' --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out ./diag.json
pw diagnostics bundle -s bug-a --out ./bundle-bug-a --limit 20
# Agent 先消费 bundle.auditConclusion 并执行闭环：归因 -> 定位 -> 修复 -> 复验
```

回放 run：

```bash
pw diagnostics runs --session bug-a --limit 20
pw diagnostics show --run <runId> --command click --limit 10
pw diagnostics grep --run <runId> --text 'CHECKOUT_TIMEOUT' --limit 10
```

统一时间线（按时间排序看所有事件）：

```bash
pw diagnostics timeline --session bug-a --limit 50
pw diagnostics timeline --session bug-a --since 2026-05-01T10:00:00Z
```

报告 bug 必须给：页面 URL、复现动作、console/network/errors 证据、严重级别、是否阻塞主流程。

Trace / HAR：

```bash
pw trace start -s bug-a
pw trace stop -s bug-a
pw trace inspect <traceArtifactPath> --section actions
pw trace inspect <traceArtifactPath> --section requests --failed
pw trace inspect <traceArtifactPath> --section console --level error
pw har start ./bug.har -s bug-a
pw har stop -s bug-a
```

`trace stop` 会输出 `traceArtifactPath` 和 inspect next step。`trace inspect` 是离线 trace artifact 查询，适合回看 actions / requests / console / errors；它不替代 live `network` / `console` / `diagnostics export`。

HAR 热录制当前只暴露 substrate 边界，稳定诊断仍优先 `network` 和 `diagnostics export`。

## 7. Dialog 和卡死恢复

```bash
pw observe status -s bug-a             # 先看状态
pw dialog accept -s bug-a              # 解除 modal
pw dialog dismiss -s bug-a
pw session recreate bug-a --headed --open '<url>'  # 上面无效再重建
```

完整升级路径见 `references/failure-recovery.md`。

## 8. Auth

Auth provider 是内置 registry 能力，不是外部 plugin。`pw auth` 只在已有 session 里执行 provider，不创建 session、不改变 headed/profile/persistent/state shape。

发现 provider：

```bash
pw auth list
pw auth info <provider>
```

通用登录主路径：

```bash
pw session create auth-a --headed --open '<url>'
pw auth list
pw auth info <provider>
pw auth <provider> -s auth-a
pw read-text -s auth-a --max-chars 1200
```

带 provider 参数：

```bash
pw auth <provider> -s auth-a --arg key=value
pw auth <provider> -s auth-a --save-state ./auth.json
```

硬规则：

- provider 只使用 `pw auth <provider> -s <name>` / `--session <name>` 执行。
- provider 参数只用 `--arg key=value`。
- 外部临时登录脚本走 `pw code --file <path>`，不要挂到 `pw auth`。
- provider 需要哪些参数，以 `pw auth info <provider>` 为准。
- provider 失败时，按错误信息补参数后重试。

专项 provider 细节不写进主 skill；遇到 provider-specific 失败或参数不确定时，查对应 reference。

Forge / DC / DC2 / 开发者后台：

```text
if 用户给了具体 Forge/DC URL:
  pw session create dc-main
  pw auth dc -s dc-main --arg targetUrl='<url>'
elif 已有 session 当前页就是 Forge/DC:
  pw auth dc -s <session>
else:
  pw session create dc-main
  pw auth dc -s dc-main

pw read-text -s dc-main --max-chars 1200
pw observe status -s dc-main
```

规则：

- 看到 Forge / DC / DC2 / 开发者后台 / developer console，优先走 `pw auth dc`。
- 不要求先 `open` Forge 页面；`auth dc` 会解析目标并导航登录。
- 用户给了 URL 时，把 URL 作为 `--arg targetUrl=<url>` 传给 provider。
- 用户没给 URL 时，让 provider 使用默认本地 Forge。
- 不要手填登录表单，不要把 `dc2` 当 `instance`。
- Forge/DC 登录失败再查 `references/forge-dc-auth.md`。

## 9. 状态复用

保存登录态：

```bash
pw state save ./auth.json -s bug-a
```

用 state 创建新 session：

```bash
pw session create bug-b --state ./auth.json --headed --open 'https://example.com'
```

已有 session 加载 state：

```bash
pw state load ./auth.json -s bug-a
```

Cookie / storage 读取：

```bash
pw cookies list -s bug-a --domain example.com
pw storage local -s bug-a
pw storage session -s bug-a
pw storage local set -s bug-a featureFlag enabled
pw storage local delete -s bug-a featureFlag
```

设置 cookie：

```bash
pw cookies set -s bug-a --name token --value '<value>' --domain example.com --path /
```

Storage mutation 只改当前页 origin，适合临时 feature flag / 复现状态；登录态复用继续用 `state save|load` 或 auth provider。

Profile 检查：

```bash
pw profile inspect ./profile
pw profile list-chrome
pw session create bug-a --profile ./profile --persistent --headed --open 'https://example.com'
pw session create bug-a --from-system-chrome --chrome-profile Default --headed --open 'https://example.com'
pw auth probe -s bug-a
pw page assess -s bug-a
```

`--from-system-chrome` 只说明 session 启动来源。要证明登录态是否真的可用，继续跑 `pw auth probe`，必要时再用 `pw page assess` 看页面是不是已经落到正确的受保护区域。

## 10. Controlled Testing

Mock 单个接口：

```bash
pw route add '**/api/**' -s bug-a --method GET --status 200 --content-type application/json --body '{"ok":true}'
pw route list -s bug-a
```

按请求体匹配：

```bash
pw route add '**/api/**' -s bug-a --method POST --match-body 'fail500' --status 200 --content-type application/json --body '{"ok":true}'
```

Patch upstream JSON：

```bash
pw route add '**/api/**' -s bug-a --patch-json-file ./patch.json --patch-status 298
```

批量加载 route：

```bash
pw route load ./routes.json -s bug-a
```

环境控制：

```bash
pw environment offline on -s bug-a
pw environment offline off -s bug-a
pw environment geolocation set -s bug-a --lat 37.7749 --lng -122.4194
pw environment permissions grant geolocation -s bug-a
pw environment permissions clear -s bug-a
pw environment clock install -s bug-a
pw environment clock set -s bug-a 2024-12-10T10:00:00.000Z
pw environment clock resume -s bug-a
```

Bootstrap：

```bash
pw bootstrap apply -s bug-a --init-script ./bootstrap.js
pw bootstrap apply -s bug-a --headers-file ./headers.json
```

清理 route：

```bash
pw route remove '**/api/**' -s bug-a
pw route remove -s bug-a
```

## 11. Batch 和输出

脚本解析 stdout 必须加 `--output json`：

```bash
pw --output json read-text --session bug-a
```

`batch` 输入只接受 `string[][]`：

```bash
printf '%s\n' '[["read-text","--max-chars","1000"],["click","--selector","button[type=submit]"],["wait","network-idle"]]' | pw batch --session bug-a --stdin-json
pw batch --session bug-a --file ./steps.json
```

注意：

- `pw batch --stdin-json` 表示 stdin steps 是 JSON，不表示输出 JSON。
- 要 JSON 输出：`pw --output json batch --session bug-a --stdin-json`。
- `batch` 适合单 session 串行动作，不适合 lifecycle/auth/environment/dialog recovery。
- batch `click` 支持 ref、`--selector`、`--text`、`--role --name`；`--text` 和 `--role` 可带 `--nth`。
- batch `locate/get/is/verify` 支持 `--selector`、`--text`、`--role --name`、`--label`、`--placeholder`、`--test-id`、`--nth`。
- 默认遇到首个失败会返回非零退出码和 `ok:false` / `BATCH_STEP_FAILED`；需要收集失败步骤时显式加 `--continue-on-error`。
- 默认 text 输出是轻量摘要：step 数、成功/失败数、首个失败、warnings；不倾倒嵌套 `results`。
- 脚本解析、字段断言、完整 envelope 消费必须加 `--output json`。
- JSON envelope 保持 `data.summary` 和 `data.results`；只需要 JSON 汇总时加 `--summary-only`。
- 默认 text 需要紧凑 step 明细时加 `--include-results`。
- 超出稳定子集时，直接跑单命令或用 `pw code`。

## 12. 标准任务模板

探索页面：

```bash
pw session create explore-a --headed --open '<url>'
pw observe status -s explore-a
pw read-text -s explore-a
pw snapshot -i -s explore-a
```

人类观察 / 接管：

```bash
pw dashboard open
pw session list --with-page
```

Dashboard 只用于 human observation。不要把 `pw dashboard open` 放进常规 Agent 自动化循环；只有人需要检查多个 session、实时预览或接管状态时再打开。

复现 bug：

```bash
pw session create bug-a --headed --open '<url>'
pw errors clear -s bug-a
pw read-text -s bug-a
pw click -s bug-a --text '<action>'
pw wait network-idle -s bug-a
pw diagnostics digest -s bug-a
pw console -s bug-a --level error --limit 20
pw network -s bug-a --status 500 --limit 20
```

验证接口请求：

```bash
pw session create api-a --headed --open '<url>'
pw click -s api-a --text '<action>'
pw wait -s api-a --response '<api path>' --status 200
pw network -s api-a --url '<api path>' --limit 10
```

确定性自动化：

```bash
pw session create test-a --headless --open '<url>'
pw route load ./routes.json -s test-a
pw bootstrap apply -s test-a --init-script ./bootstrap.js
pw click -s test-a --selector '<selector>'
pw wait -s test-a --text '<expected>'
pw --output json read-text -s test-a --max-chars 1000
```

## 13. 禁止事项

- 不要把 `open` 当成 session lifecycle。
- 不要让 `auth` 创建 session。
- 不要把 `pw batch --stdin-json` 当成输出 JSON。
- 不要忽略 limitation code。
- 不要把 HAR 热录制、raw CDP substrate 等边界能力包装成稳定支持。
- 不要为了省命令跳过动作后的 `wait` 和复查。

## 14. 参考

需要精确命令参数时按场景查对应文件：

- `references/command-reference.md` — session 生命周期、页面读取、动作与等待
- `references/command-reference-diagnostics.md` — 查 bug 时：console / network / errors / diagnostics / route mock / trace
- `references/command-reference-advanced.md` — 构建自动化时：state / auth / batch / environment / `pw code`
- `references/forge-dc-auth.md` — Forge/DC provider 的参数、失败分支、环境路由
- `references/failure-recovery.md` — 遇到错误码时
- `references/gotchas.md` — 遇到非预期行为时
- `references/workflows.md` — 工作流路由入口（浏览器探索 / 诊断 / 受控测试）
- `workflows/browser-task.md` — 页面探索与动作闭环
- `workflows/diagnostics.md` — 复现与诊断闭环
- `workflows/controlled-testing.md` — mock + environment + bootstrap 的确定性链路

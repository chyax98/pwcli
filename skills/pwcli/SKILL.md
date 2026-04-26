---
name: pwcli
description: 当 Codex 需要用 `pw` 驱动浏览器完成 bug 复现、问题诊断、DOM 检查、认证态复用、确定性自动化、请求 mock、diagnostics 导出或环境控制时使用。适用于严格 named session、结构化 JSON 输出、route mock、run 级 diagnostics 和 offline/geolocation/permissions/clock 等受控浏览器状态场景。
---

# pwcli

只使用 `pw`。不要绕过 CLI，也不要靠记忆重建浏览器工作流。

## 核心规则

1. 一切从 named session 开始。
2. 一个任务尽量只占用一个 session。
3. 有依赖关系的浏览器步骤必须串行。
4. 先读再动。
5. 优先使用结构化命令，不优先写临时代码。
6. 只有命令面真的不够时才用 `pw code`。
7. CLI 输出就是事实，不要自己脑补能力。
8. 看到 limitation code，就不要继续把它说成“已支持”。

## Session 纪律

- 浏览器命令一律显式传 `--session <name>`。
- session 名尽量短，最多 `16` 个字符，只用字母、数字、`-`、`_`。
- 冷启动时，先看 `pw session list`，不要先新建 session。
- lifecycle 主路只有：
  - `pw session create <name> --open <url>`
  - `pw session attach <name> ...`
  - `pw session recreate <name> ...`
- `open` 只负责已有 session 内的导航。
- `auth` 只负责内置 auth provider 执行，不负责 lifecycle。
- 不要凭空假设 current/default session。
- 不要再使用已经删除的 `connect` 心智。
- 如果长时间调试留下很多 session，显式清理：

```bash
pw session close --all
```

## 冷启动第一步

当你刚接手一个浏览器任务，还不知道当前状态时，先做这个：

```bash
pw session list
```

只有你真的需要 session 对应页面摘要时，再显式用：

```bash
pw session list --with-page
```

然后按这个顺序判断：

1. 已经存在合适的 session，就优先复用。
2. 没有合适 session，再创建新的。
3. 如果任务依赖登录态，优先复用已有登录态 session，不要重复创建。

不要一上来就：

- 猜 `auth` 相关命令
- 猜不存在的发现型命令
- 新建一个和现有 session 重复的会话

## 入口选择

### 新开一个调查 session

```bash
pw session create bug-a --open 'https://example.com'
```

### 复用一个现成浏览器

```bash
pw session attach bug-a --ws-endpoint ws://127.0.0.1:9222/devtools/browser/...
```

### 复用已有认证态

```bash
pw session create auth-a --open 'https://example.com' --state ./auth.json
```

### 执行内置登录 provider

```bash
pw auth dc-login --session auth-a --arg targetUrl='https://example.com'
```

先把 session shape 建好，再跑 `auth`。`auth` 不拥有 lifecycle。

### 先看有哪些 auth provider，再决定怎么登录

```bash
pw auth list
pw auth info dc-login
```

当前限制要记住：

- `auth` 只暴露内置 provider，不再走工作目录 plugin 扫描
- 外部 JS 脚本请直接使用 `pw code --file`
- `pw auth dc-login --help` 现在会返回 provider-specific 参数说明；冷启动时仍然优先先看 `auth list` / `auth info`
- `auth list` 里可能出现内部测试 provider，看 summary 区分用途
- `session list` 默认是轻量发现命令；只有显式 `--with-page` 时才补页面摘要

## 标准工作流

### 1. 先观察

默认按这个顺序：

```bash
pw observe status --session bug-a
pw page current --session bug-a
pw read-text --session bug-a --max-chars 1200
pw snapshot --session bug-a
```

怎么理解这四个命令：

- `observe status`：默认第一手入口，载荷最紧凑，适合冷启动
- `page current/list/frames/dialogs`：看 workspace 投影
- `read-text`：看可见文本，比 `snapshot` 更窄
- `snapshot`：只在你需要 refs 或更大范围结构时才用
- `observe status --verbose`：只有 compact 信息不够时再升级

载荷判断：

- `observe status`：轻
- `page current`：轻
- `read-text`：中等，但仍比 `snapshot` 窄
- `snapshot`：默认观察工具里最重，尤其大页面更重

结论：

- 大页面冷启动时，不要先打 `snapshot`
- 只有你真的要找 ref 或看大结构时，再打 `snapshot`

### 2. 再动作

优先使用明确命令：

- `click`
- `fill`
- `type`
- `press`
- `scroll`
- `upload`
- `download`
- `drag`
- `wait`

定位优先顺序：

1. 已经有 `snapshot` 时，优先用里面的 aria ref
2. 否则优先 `--selector`
3. 再考虑命令已经支持的语义 locator

如果你还没做 `snapshot`，不要为了拿 ref 强行先打一份很重的 snapshot。先试 `--selector` 或语义 locator。

### 3. 问题诊断

```bash
pw diagnostics digest --session bug-a
pw observe status --session bug-a
pw console --session bug-a ...
pw network --session bug-a ...
pw errors recent --session bug-a ...
pw doctor --session bug-a
pw diagnostics show --run <runId> --command click --limit 5 --fields at=ts,cmd=command,net=diagnosticsDelta.networkDelta
pw diagnostics export --session bug-a --section network --text CHECKOUT_TIMEOUT --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out ./diag.json
pw diagnostics runs --session bug-a --since 2026-04-26T00:00:00.000Z
pw diagnostics grep --run <runId> --text <substring>
```

要点：

- `diagnostics digest` 是最快的高信号摘要
- `observe status` 是 live session 的紧凑健康快照
- `doctor` 是恢复性探测
- action 结果里的 `diagnosticsDelta` 是第一层信号
- `console/network/errors` 是 live query 工具
- `diagnostics show/grep` 是 run 回放工具
- `--verbose` 只在 `observe status` / `doctor` 的默认输出不够时再用
- `--since` 适合时间窗口 triage
- `--fields` 适合给下游 Agent 压缩输出；需要短 key 时用 `alias=path`
- `--text` 适合做一份紧凑证据导出
- `network` 里的 `requestBodySnippet` / `responseBodySnippet` 适合快速确认请求或响应形状

如果 session 被 dialog 卡住，先尝试：

```bash
pw dialog accept --session bug-a
```

或者：

```bash
pw dialog dismiss --session bug-a
```

再考虑 `doctor -> session recreate`。

### 4. 确定性复现

```bash
pw route add ...
pw route list ...
pw route load ./mock-routes.json ...
pw route add '**/api/**' --method POST --match-body fail500 --body '{"ok":true}' --status 200 --content-type application/json --session bug-a
pw route add '**/api/**' --inject-headers-file ./inject-headers.json --session bug-a
pw route add '**/api/**' --patch-json-file ./summary-patch.json --patch-status 298 --session bug-a
pw environment offline on ...
pw environment geolocation set ...
pw environment permissions grant ...
```

### 4.1 Forge / DC 登录主路

Forge / DC 相关任务，按这个顺序来：

```bash
pw session list
pw auth list
pw auth info dc-login
```

如果目标 session 已经存在，先复用它：

```bash
pw observe status --session dc-forge
pw page current --session dc-forge
pw read-text --session dc-forge --max-chars 1200
```

只有在没有合适 session 时，才新建：

```bash
pw session create dc-forge --headed --open 'https://developer-.../forge'
```

然后再通过内置 auth provider 登录：

```bash
pw auth dc-login --session dc-forge --arg targetUrl='https://developer-.../forge'
```

`dc-login` 当前参数 contract：

- `phone`：必需
- `smsCode`：默认 `000000`
- `targetUrl`：如果你已经知道最终目标页，优先传它
- `baseURL`：当 `targetUrl` 不方便时使用
- `instance`：本地有多个 Forge dev instance 时使用
- `dc-login` 当前只依赖运行时参数和少量自动推导，不再依赖 `accounts.json`

如果登录很贵，而且后面还会继续排查，直接保存 state：

```bash
pw auth dc-login --session dc-forge --arg targetUrl='https://developer-.../forge' --save-state ./auth.json
```

在向人类追问登录参数之前，先检查这四件事：

1. 有没有现成 session 可复用
2. 默认 `smsCode` 是否已经够用
3. Forge dev 的 `baseURL` / `instance` 能不能自动推出来
4. 是否真的还需要向人追问 `phone`

### 5. 只有在命令面不够时才升级

只有这些情况才用 `pw code`：

- 需要条件 mock 逻辑
- 需要多步页面逻辑，而现有命令面没有
- 需要一次性 DOM/JS 假设验证
- 需要在提出新命令前快速验证一个猜想

已经有一等命令覆盖的能力，不要再用 `pw code` 重写一遍。

## 串行纪律

- 同一个 session 内，依赖前一步页面状态的命令必须按顺序执行。
- 不要并行：
  - `session create` -> `fill` / `click`
  - `click` 导航 -> `read-text` / `page current`
  - `route add/load` -> 目标动作
  - `environment` 变更 -> 页面验证

如果下一步依赖前一步改动后的页面状态，就等前一步完成，再继续。

## Batch 规则

只使用结构化 batch：

```bash
printf '%s\n' '[["snapshot"],["click","e6"],["wait","networkIdle"]]' | pw batch --session bug-a --json
pw batch --session bug-a --file ./steps.json
```

规则：

- 只用 `string[][]`
- 每个内层数组都是一个稳定子集里的 CLI argv 形状
- 复用同一个 session
- 依赖步骤必须在一个 batch 里显式按顺序写出来
- `open` / `click` / `press` 后，如果下一步依赖导航或网络完成，显式插入 `wait`
- lifecycle / auth / environment / dialog recovery 不要塞进 batch
- `--continue-on-error` 只在“部分结果仍然有价值，且后续步骤不依赖前面 mutation”时使用

取舍：

- `batch` 故意比全 CLI 更窄
- 当前稳定子集只覆盖确定性的 inspect / action / wait / route / bootstrap
- 如果需要的命令不在稳定子集里，直接跑单命令，或者转 `pw code`

原因：

- 对 Agent 来说，稳定比“表面上什么都能跑”更重要
- batch 只会在真实高频工作流证明有必要时再扩
- batch 返回里的 warning 不是噪音，是 contract 指导

不要再写字符串 step DSL。

## Diagnostics / Mock 决策树

### 只想看一个请求或一类请求

优先用 `network`：

- `--request-id`
- `--url`
- `--kind`
- `--method`
- `--status`
- `--resource-type`
- `--text`
- `--limit`

### 需要给另一个 Agent 或 code review 一份稳定证据

```bash
pw diagnostics export --session bug-a --section network --text checkout --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out ./diag.json
```

### 只需要一个简单 mock

用 `route add`。

### 需要多条 mock 或文件化 payload

用 `route load <file>`，保持 JSON 形式。

### 需要浏览器环境变更

用 `environment`。

除非用户明确要求你探索缺失能力，否则不要把 HAR 或 stream-based diagnostics 说成答案。

## 恢复规则

遇到这些情况时，读 [references/failure-recovery.md](./references/failure-recovery.md)：

- 命令失败
- 出现 session routing error
- 遇到 modal blockage
- 需要判断是否该 recreate session

## 工作流剧本

遇到这些情况时，读 [references/workflows.md](./references/workflows.md)：

- 复现 bug
- 做确定性自动化
- 复用 auth/state/profile
- 用 diagnostics export 或 run replay

## 硬约束

- 不要提或使用已经删除的兼容命令。
- 不要假设隐式全局状态。
- 不要把 `page dialogs` 当成 authoritative live dialog set。
- 不要再猜 `pw plugin *` 这类旧心智。
- 不要让 `open`、`profile`、`auth` 承担 lifecycle mutation。
- 不要把当前 `session attach` 之外的 raw CDP substrate 当成已支持。
- 不要把未来规划写得像已经 shipped。

## 快速索引

- 命令细节：[references/command-reference.md](./references/command-reference.md)
- 真实工作流：[references/workflows.md](./references/workflows.md)
- 失败恢复：[references/failure-recovery.md](./references/failure-recovery.md)
- 本地硬规则：[rules/core-usage.md](./rules/core-usage.md)

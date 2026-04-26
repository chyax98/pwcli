# pwcli CDP Diagnostics Mock Survey

更新时间：2026-04-26  
状态：active

## 目标

调研 `pwcli` 下一阶段在 `CDP / diagnostics / mock / batch` 这四条线上的最优推进方式。

关注点只有三个：

1. 真实 Agent 场景是否存在
2. Playwright Core 或参考项目是否已有足够方案
3. 把能力引入主路径的复杂度是否值得

## 一、真实场景

### 场景 A：找 bug / 定位 bug

Agent 需要：

- 执行动作
- 立刻知道发生了什么
- 拿到最小可复盘证据
- 精确过滤相关请求、错误、console

最值钱的能力：

- action diagnostics delta
- network detail / query
- route mock
- trace

### 场景 B：做自动化操作

Agent 需要：

- 用稳定的 batch 表达一条任务链
- 在任务链里插入 mock / bootstrap / wait / screenshot
- 任务失败时能快速重新定位

最值钱的能力：

- structured batch
- route file / route list
- state / auth reuse
- deterministic smoke

## 二、当前 `pwcli` 现实

### 已有

- strict session-first
- session create / attach / recreate
- trace start / stop
- console / network / errors / observe / doctor
- route add / remove
- run events 最小落盘
- action diagnostics delta

### 明显缺口

- `connect` 冗余命令
- `auth` ownership 太宽
- `batch` 还是临时 contract
- mock 只到最小 fulfill/abort
- diagnostics 还不够“可查询”
- raw CDP 不是通用 substrate

## 三、参考对象结论

## 3.1 agent-browser

参考：

- [/Users/xd/work/tools/forge-browser/references/agent-browser/README.md](/Users/xd/work/tools/forge-browser/references/agent-browser/README.md)
- [/Users/xd/work/tools/forge-browser/references/agent-browser/cli/src/main.rs](/Users/xd/work/tools/forge-browser/references/agent-browser/cli/src/main.rs)

可借点：

1. `batch` 同时支持：
   - quoted string commands
   - JSON stdin `string[][]`
2. network 查询面较深：
   - requests 列表
   - request detail
   - method / status / type filter
3. mock 表达更完整：
   - route
   - unroute
   - resource-type 过滤
4. workspace 写操作模型更成熟：
   - stable `tabId`
   - `dialog accept/dismiss/status`

不该直接照抄的点：

1. 它的产品面更宽
2. 它有更多 daemon / dashboard / interactive control 心智
3. `pwcli` 当前不用一次性铺到它那么大

结论：

- `batch` 的 JSON argv-array 设计值得直接借
- network query 和 mock surface 的拆法值得借
- workspace 写操作可以后借，不是当前主线

## 3.2 forge-browser

参考：

- 当前仓库历史心智
- `references/` 下保留的旧工程线索

可借点：

1. 知道哪些东西容易长成过重 runtime
2. 知道 diagnostics / mock / auth 容易一起失控

结论：

- 只能借教训
- 不回到厚 runtime / 多协议 / 多真相

## 3.3 Playwright CLI

参考：

- [/Users/xd/work/tools/forge-browser/references/playwright-cli/README.md](/Users/xd/work/tools/forge-browser/references/playwright-cli/README.md)
- [/Users/xd/work/tools/forge-browser/references/playwright-cli/skills/playwright-cli/references/request-mocking.md](/Users/xd/work/tools/forge-browser/references/playwright-cli/skills/playwright-cli/references/request-mocking.md)
- [/Users/xd/work/tools/forge-browser/references/playwright-cli/skills/playwright-cli/references/tracing.md](/Users/xd/work/tools/forge-browser/references/playwright-cli/skills/playwright-cli/references/tracing.md)

可借点：

1. `route` 命令面比当前 `pwcli` 更完整
2. tracing 文档化更成熟
3. config 文件思路明确

结论：

- route 命令面值得继续扩
- session defaults / config 文件值得借
- 不借它完整产品外壳

## 3.4 Chrome DevTools / chrome-devtools-mcp

参考：

- [/Users/xd/work/tools/forge-browser/references/chrome-devtools-mcp/README.md](/Users/xd/work/tools/forge-browser/references/chrome-devtools-mcp/README.md)
- `/Users/xd/work/tools/forge-browser/references/chrome-devtools-mcp/src/*`

可借点：

1. request collector / request stable id
2. detailed network request inspection
3. CDP session 直连能力
4. performance trace 分析思路

结论：

- 值得作为 diagnostics survey 参考
- 当前不值得把它那套 MCP / DevTools 分析层搬进 `pwcli`

## 3.5 Playwright Core

参考：

- `node_modules/playwright-core/types/types.d.ts`
- `node_modules/playwright-core/lib/client/browserContext.js`
- `node_modules/playwright-core/lib/client/browserType.js`
- `node_modules/playwright-core/lib/client/tracing.js`

已确认 public API：

1. `connectOverCDP`
2. `BrowserContext.newCDPSession(page|frame)`
3. `context.tracing`
4. `recordHar`
5. `routeFromHAR`
6. `recordVideo`

结论：

- public API 足够深
- 问题不在“有没有 API”
- 问题在：当前 `pwcli` 借用的 CLI substrate 有没有把这些能力暴露进现有 session lifecycle

## 3.6 Puppeteer

参考：

- [/Users/xd/work/tools/forge-browser/references/puppeteer/docs/api/puppeteer.tracing.md](/Users/xd/work/tools/forge-browser/references/puppeteer/docs/api/puppeteer.tracing.md)
- `/Users/xd/work/tools/forge-browser/references/puppeteer/packages/puppeteer-core/src/*`

可借点：

1. 直接 page-level tracing 心智
2. 更直接的 CDP session 使用方式

结论：

- 可以作为“如果 Playwright CLI substrate 不够用，下一步能多深”的参考
- 当前不值得把 `pwcli` 改造成 Puppeteer 风格 runtime

## 3.7 MZBR

当前状态：

- 本地没有明确的 canonical source
- 外部没有拿到足够确定的参考仓库

结论：

- 这次 survey 不给它下判断
- 如果要纳入后续决策，必须先补充准确 repo 或项目名

## 四、关于 CDP / HAR / trace 的结论

### 4.1 trace

结论：

- 应该进入主路径
- 应该作为 session defaults 默认开启

原因：

- 真实场景强
- 当前实现成本低
- `managedTrace(start|stop)` 已经存在

### 4.2 HAR

结论：

- 不做热录制
- 不进当前主路径

原因：

- 当前借用的 `session.js + registry.js` substrate 没有把 `recordHar` 暴露进现有 lifecycle
- 在 live `BrowserContext` 上补热录制会抬高复杂度

正确方向：

- 如果未来真要 HAR，优先考虑 `session create/recreate` 时的 create-time recording
- 不是现在去硬补 `har start/stop`

### 4.3 raw CDP named-session substrate

结论：

- 当前延后

原因：

- 现在的真实 blocker 不在这里
- 这会把项目拉进更深的 substrate 改造

### 4.4 diagnostics 系统

结论：

- 应优先做 query/export
- 不优先做更多录制开关

正确方向：

1. network query 加深
2. diagnostics export
3. run-scoped query

## 五、关于 mock 的结论

### 当前只到第一层

现状：

- `route add/remove`
- `abort`
- `fulfill body/status/content-type`

这还不够支撑复杂 bug 复现。

### 下一步最值钱的 mock

建议顺序：

1. `route list`
2. `route load <file>`
3. `route add --method <method>`
4. `route add --body-file <path>`
5. `route add --headers-file <path>`
6. `offline`
7. `geolocation`
8. `permissions`
9. `clock`

原因：

- 都直接服务 bug 复现和 deterministic automation
- 都能围绕 Playwright public API 做

## 六、关于 batch 的结论

### 最佳主路

`batch` 应该直接采用：

- `--json` stdin
- `--file <path>`
- 负载格式：`string[][]`

例子：

```json
[
  ["open", "https://example.com"],
  ["route", "add", "**/api/**", "--abort"],
  ["click", "--selector", "#fire"],
  ["wait", "--response", "/fixture", "--status", "200"]
]
```

原因：

1. 不引入新 DSL
2. 和单命令 argv 语义完全对齐
3. 比字符串 step parser 稳
4. 适合文件输入和 agent 生成

## 七、最终建议

### 现在直接做

1. 删除 `connect`
2. 收缩 `auth` lifecycle ownership
3. `batch` 改成 JSON argv-array 主路
4. `trace` 进入 session defaults，默认开启
5. diagnostics 走 query/export 方向
6. mock 做第一层强化

### 现在不要做

1. raw CDP named-session substrate
2. observe stream
3. HAR 热录制
4. workspace 写操作

### 原因

因为这条路线同时满足：

1. 场景真实
2. 对 agent 最有价值
3. 实现和维护成本可控
4. 不会把 `pwcli` 再拉回厚 runtime

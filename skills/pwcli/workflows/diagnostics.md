# 诊断流程

## 输入

- 页面异常：白屏、空态异常、按钮无效、跳转错误。
- 控制台异常：warning/error。
- 接口异常：4xx/5xx、requestfailed、返回数据不对。

## 1. 快速总览

先确认内容事实：

```bash
pw read-text --session <name>
```

如果目标内容已读到，diagnostics 里的背景噪声不要升级成失败；只记录和目标路径有关的 console/network/page error。

```bash
pw diagnostics digest --session <name>
```

成功判断：

- 能看到当前页 URL。
- 能看到 console/http/page error 数量。
- 有 top signals 时，先处理 top signals。

## 2. 查 console

```bash
pw console --session <name> --level error --limit 20
```

需要过滤：

```bash
pw console --session <name> --level error --text '<substring>' --limit 10
```

记录：

- 错误文本
- 触发页面
- 是否 React warning、业务 API error、资源加载失败

## 3. 查 network

先查 4xx/5xx：

```bash
pw network --session <name> --status 400 --limit 20
pw network --session <name> --status 500 --limit 20
```

查具体接口：

```bash
pw network --session <name> --url '<api path>' --limit 20
```

查单请求详情：

```bash
pw network --session <name> --request-id <id>
```

记录：

- method
- url
- status
- response msg/snippet
- 是否重复 query 参数

## 4. 查 page errors

```bash
pw errors recent --session <name> --limit 20
```

## 5. 导出证据

```bash
pw diagnostics export --session <name> --section network --text '<substring>' --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out ./diag.json
```

需要交接给下一个 Agent 或写 bug 复现时，用 1.0 证据包：

```bash
pw diagnostics bundle --session <name> --out .pwcli/bundles/<task-slug> --task '<task name>' --limit 20
```

成功判断：

- `.pwcli/bundles/<task-slug>/manifest.json` 存在，`schemaVersion` 为 `1.0`
- `summary.status` 是 `pass | fail | blocked` 之一，不把 blocked 包装成 pass
- `commands` 和 `runIds` 能定位到本次动作链
- `artifacts` 记录截图、PDF、trace、video 或其他关键路径；存在的文件应带 `sizeBytes`
- `.pwcli/bundles/<task-slug>/handoff.md` 能让下一个 Agent 直接知道关键发现和 next steps

## 6. 回放动作 run

```bash
pw diagnostics runs --session <name> --limit 20
pw diagnostics show --run <runId> --command click --limit 10
pw diagnostics grep --run <runId> --text '<substring>' --limit 10
```

## 6.5 统一时间线

一条命令看按时间排序的所有事件（console、network、pageerror、action、failure）：

```bash
pw diagnostics timeline --session <name> --limit 50
```

成功判断：

- 能看到 failure entry 带 `failureCode` 和 `screenshotPath`
- 能看到 failure 前后的 network/console 事件，帮助定位因果链
- 用 `--since` 缩小范围

## 7. 离线 trace triage

已有 trace zip 时，用 Trace CLI 查重放证据包，不要把它当 `.pwcli/runs` 事件日志：

```bash
pw trace inspect .pwcli/playwright/traces/trace.zip --section actions
pw trace inspect .pwcli/playwright/traces/trace.zip --section requests --failed
pw trace inspect .pwcli/playwright/traces/trace.zip --section console --level error
pw trace inspect .pwcli/playwright/traces/trace.zip --section errors
```

使用边界：

- Trace CLI：Agent 离线查询 actions / requests / console / errors。
- Trace Viewer：人类可视化重放。
- HTML report / UI mode：Playwright Test 展示面，不是 pwcli diagnostics。
- `.pwcli/runs/<runId>/events.jsonl`：轻量动作事件，不替代 trace zip。

## 8. 卡住时恢复

```bash
pw doctor --session <name>
pw dialog accept --session <name>
pw dialog dismiss --session <name>
```

如果 action 返回 `modalPending=true` / `MODAL_STATE_BLOCKED`，不要继续堆叠 `page dialogs`、`status` 或 `diagnostics bundle`。交接证据的顺序是：保留 action envelope → `doctor` 确认 `modal-state` → `dialog accept|dismiss` → 恢复后 `diagnostics bundle`。

恢复失败再考虑：

```bash
pw session recreate <name> --open '<url>'
```

## 9. Search / challenge fallback

遇到搜索引擎 challenge、CAPTCHA、人机验证、Cloudflare challenge：

- 不自动解挑战，不写滑块/验证码绕过脚本。
- 优先改用 direct URL、站内 docs、site-specific 文档页或已有深链。
- 如果必须确认挑战后内容，交给 human takeover：`pw dashboard open` 或让用户在 headed session 中接管。
- 接管后再用 `pw read-text` / `pw locate` 验证内容，不把 challenge 解决过程写成自动化 workflow。

## 输出要求

报告问题时给：

- 页面 URL
- 复现动作
- console/network 证据
- 严重级别
- 是否阻塞首屏/主流程

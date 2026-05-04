---
doc_type: evaluation
slug: har-trace-1-0-decision
status: completed
created: 2026-05-04
related_roadmap: pre-1-0-breakthrough
roadmap_item: har-trace-1-0-decision
commands: [har, trace, network, diagnostics]
result: pass
---

# HAR / Trace 1.0 Decision

## 决定

HAR 热录制不进入 `pwcli` 1.0 supported contract。

原因：Playwright HAR capture 需要在 `BrowserContext` 创建时通过 `recordHar` 配置。`pwcli` 当前主路是 `session create|attach|recreate` 管理已经打开的本地 session；在已打开 context 上做 `har start|stop` 会变成补丁式伪支持，不符合“唯一清晰实现、不写逻辑向后兼容代码”的约束。

## 1.0 Contract

- `pw har start|stop`：保留命令名，但只作为防误用 guard，返回失败 envelope：
  - `code: UNSUPPORTED_HAR_CAPTURE`
  - `details.reason: PLAYWRIGHT_RECORD_HAR_REQUIRES_CONTEXT_CREATION`
- `pw har replay <file>`：稳定支持预录制 HAR 回放，用于 deterministic network stubbing。
- `pw har replay-stop`：停止 HAR replay。
- 网络证据主路：`pw network`、`pw diagnostics export`、`pw diagnostics bundle`。
- 可重放浏览器证据主路：`pw trace start|stop|inspect`。

## 验证

执行：

```bash
pnpm build
pnpm check:har-1-0
pnpm exec tsx scripts/test/integration/har.test.ts
```

覆盖：

- `har start` 不再返回 `ok=true supported=false`，而是明确失败 `UNSUPPORTED_HAR_CAPTURE`
- `har stop` 同样明确失败
- `har replay` 加载预录制 HAR 后，页面请求被 HAR 内容拦截并读到 `har-fixture`
- `har replay-stop` 返回 `replayActive=false`

## 结论

HAR 的 1.0 状态从 `documented limitation` 收敛为：

- 热录制：明确 dropped from supported contract，保留失败 guard
- 回放：proven

后续如果要做 HAR capture，只能作为单独 roadmap 重新设计 session 创建期 contract，例如 `session create --record-har <path>`；不能把它塞回 `har start|stop` 热录制。

---
doc_type: issue-fix-note
issue: 2026-05-04-trace-inspect-cli-resolution
status: fixed
path: fastforward
severity: P1
root_cause_type: path-resolution
tags:
  - trace
  - diagnostics
  - evidence
---

# trace inspect CLI 路径解析 Fix Note

## 1. 根因

`src/engine/diagnose/trace.ts` 用 `import.meta.url` 从 `dist/engine/diagnose/trace.js` 反推 package root，并写死拼接 `node_modules/playwright-core`。

编译后路径为：

```text
dist/engine/diagnose/trace.js
```

旧实现退到 `../../../..`，实际落到仓库父目录 `/Users/xd/work/tools`，不是项目根 `/Users/xd/work/tools/pwcli`。

## 2. 修复内容

- 改用 `createRequire(import.meta.url).resolve("playwright-core/package.json")` 获取当前安装包解析到的真实 `playwright-core` 根目录。
- `cli.js` 和 `lib/tools/trace/traceCli.js` 都从该真实根目录拼接。
- 不增加旧路径 fallback；路径解析只有一条 authoritative module resolution 路径。

## 3. 验证

RED：

```bash
pw trace inspect .pwcli/playwright/traces/trace-1777832767561.trace --section actions --limit 20
```

修复前失败为 `TRACE_CLI_UNAVAILABLE`。

GREEN：

```bash
pnpm build
pw trace inspect .pwcli/playwright/traces/trace-1777832767561.trace --section actions --limit 20
pnpm check:trace-inspect
```

结果：

- `trace inspect` 成功输出 `section=actions` 和 Playwright actions 表。
- `pnpm check:trace-inspect` 通过，覆盖显式 `trace start -> action -> trace stop -> trace inspect`。

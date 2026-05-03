---
doc_type: issue-fix-note
issue: 2026-05-04-environment-geolocation-contract-drift
status: fixed
path: standard
severity: P1
root_cause_type: data-format
tags:
  - environment
  - command-contract
  - skill-drift
---

# environment geolocation set 参数 Contract 漂移 Fix Note

## 1. 修复范围

按 analysis 推荐方案 A 修复：

- `src/cli/commands/environment.ts`
- `scripts/check-environment-geolocation-contract.js`
- `package.json`
- `codestable/architecture/commands/tools.md`

## 2. 修复内容

- `pw environment geolocation set` 新增 `--lat <lat>` 和 `--lng <lng>` 参数。
- 参数读取优先使用 `--lat/--lng`，没有传 flag 时保留 positional fallback。
- 缺少或非法 latitude/longitude 时，在 CLI 层返回明确错误，不再把 `undefined` 传给 Playwright。
- 新增 `pnpm check:env-geolocation` 聚焦契约验证：
  - help 必须展示 `--lat` 和 `--lng`。
  - 实际 session 中 `--lat/--lng` 能成功设置负数 longitude。
  - positional fallback 仍可工作。
- 更新 command architecture 的参数 contract 和证据状态。

## 3. 验证

RED：

```bash
pnpm build && pnpm check:env-geolocation
```

修复前失败在：

```text
Error: help did not include --lat
```

GREEN：

```bash
pnpm build && pnpm check:env-geolocation
```

结果：通过。

影响面回归：

```bash
pnpm check:skill
git diff --check
```

结果：通过。

## 4. 结论

P1 已修复。当前 skill 中的 `--lat/--lng` 示例与 CLI 实现对齐；负数 longitude 不再需要 Agent 记住 positional `--` 分隔陷阱。

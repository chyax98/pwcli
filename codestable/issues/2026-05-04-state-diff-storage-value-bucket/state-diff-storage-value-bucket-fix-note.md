---
doc_type: issue-fix-note
issue: 2026-05-04-state-diff-storage-value-bucket
status: fixed
path: fastforward
severity: P1
root_cause_type: command-contract
tags:
  - state
  - storage
  - command-contract
---

# state diff storage value bucket Fix Note

## 1. 根因

`src/engine/identity.ts` 的 `buildStateDiffResult()` 在计算 `summary.changedBuckets` 时，storage bucket 只检查：

- `added.length`
- `removed.length`
- `beforeAccessible !== afterAccessible`

`--include-values` 下 `diffStorageWithValues()` 会额外返回 `changed[]`，但摘要没有读取这个字段。

## 2. 修复内容

- 在 `buildStateDiffResult()` 中统一用 `storageBucketChanged()` 判定 storage bucket 是否变化。
- 判定条件增加 `(storage.changed?.length ?? 0) > 0`。
- 不改 state snapshot 格式，不新增兼容分支，不改变 `state save|load` 行为。
- 扩展 `scripts/test/state-diff.test.ts`：
  - 先用 `--include-values` 生成 value-aware baseline。
  - 只修改 cookie / localStorage / sessionStorage 的 value。
  - 断言 `summary.changedBuckets` 同时包含 `cookies`、`localStorage`、`sessionStorage`。
  - 断言 value-level `before` / `after` 明细正确。

## 3. 验证

```bash
pnpm build
pnpm exec tsx scripts/test/state-diff.test.ts
```

结果：全部通过。

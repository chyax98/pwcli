---
doc_type: issue-report
issue: 2026-05-04-state-diff-storage-value-bucket
status: confirmed
severity: P1
summary: "state diff --include-values 明细报告 localStorage value 变化，但 summary.changedBuckets 漏报 localStorage。"
tags:
  - state
  - storage
  - command-contract
  - evidence
---

# state diff storage value bucket Issue Report

## 1. 问题现象

`command-eval-auth-state-storage-profile` focused check 中，`pw state diff --include-values` 返回：

```json
{
  "summary": {
    "changed": true,
    "changedBuckets": ["cookies", "indexeddb"]
  },
  "localStorage": {
    "changed": [
      {
        "key": "local-key",
        "before": "local-value",
        "after": "local-value-2"
      }
    ]
  }
}
```

明细已经证明 `localStorage` value 变化，但摘要 `changedBuckets` 没有包含 `localStorage`。

## 2. 复现步骤

1. `pnpm build`
2. 创建 managed session 并打开 http fixture。
3. 设置 localStorage key。
4. 用 `pw state diff --include-values --before <path>` 创建 baseline。
5. 只修改同一个 localStorage key 的 value。
6. 再运行 `pw state diff --include-values --before <path> --after <path>`。

复现频率：稳定复现。

## 3. 期望 vs 实际

**期望行为**：只要 `localStorage.changed` 或 `sessionStorage.changed` 非空，`summary.changedBuckets` 就必须包含对应 bucket。

**实际行为**：`changedBuckets` 只检查 added / removed / accessible 变化，漏掉 value-only changed entries。

## 4. 严重程度

**P1** — `state diff` 是登录态和浏览器状态复用的证据入口。Agent 常先看摘要判断状态变化，如果摘要漏报 storage bucket，会错误低估状态差异，影响复现和交接。

---
doc_type: issue-fix-note
issue: 2026-05-04-batch-verify-failure-propagation
status: fixed
path: fastforward
severity: P1
root_cause_type: data-format
tags:
  - batch
  - verify
  - automated-testing
---

# batch verify failure 传播 Fix Note

## 1. 根因

`src/cli/batch/executor.ts` 的 `verify` 分支直接把 `managedVerify()` 返回值包装成 `ok: true`，没有像一等 `pw verify` 命令那样检查 `result.data.passed === false`。

## 2. 修复内容

- `executeBatchStep()` 在 `verify` 分支中检查 `data.data.passed`。
- `passed=false` 时抛出 `VERIFY_FAILED:verify <assertion> failed`，由 batch 汇总转成失败 step。
- batch catch 路径保留 verify 返回的 suggestions，方便 Agent 恢复。
- 新增 `pnpm check:batch-verify` 聚焦契约测试。
- 同步 skill 中 JSON 输出位置：使用 `pw <command> --output json`，不增加旧位置兼容解析。

## 3. 验证

RED：

```bash
pnpm build && pnpm check:batch-verify
```

修复前失败：

```text
batch verify failure unexpectedly exited 0
```

GREEN：

```bash
pnpm build && pnpm check:batch-verify
```

结果：通过。

补充验证：

```bash
pnpm check:skill
git diff --check
```

结果：通过。

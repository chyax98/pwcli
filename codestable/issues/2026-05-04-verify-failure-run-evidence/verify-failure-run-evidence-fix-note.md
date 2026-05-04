---
doc_type: issue-fix-note
issue: 2026-05-04-verify-failure-run-evidence
status: fixed
path: fastforward
severity: P1
root_cause_type: evidence-contract
tags:
  - verify
  - diagnostics
  - evidence
---

# verify failure run evidence Fix Note

## 1. 根因

`managedVerify()` 把断言失败表达为正常返回：

```ts
{ passed: false, retryable: true, suggestions: [...] }
```

顶层 `verify` CLI 再把它转成 `VERIFY_FAILED` envelope。但这个路径没有调用 run artifact 记录逻辑；`diagnostics bundle` 只读取 `.pwcli/runs/<runId>/events.jsonl` 和 live diagnostics，因此无法看到 `VERIFY_FAILED`。

## 2. 修复内容

- 在 `managedVerify()` 内部增加 `recordVerifyFailure()`。
- 当 `passed === false` 时，写入 run event：
  - `command: "verify"`
  - `status: "failed"`
  - `failed: true`
  - `failure.code: "VERIFY_FAILED"`
  - `failure.message: "verify <assertion> failed"`
  - `failure.details` 包含原 assertion result
- 修复点放在 engine 层，保证顶层 `pw verify` 和 batch 内部 `verify` 共享唯一实现。
- 新增 `scripts/test/verify-failure-run.test.ts`，覆盖 verify 失败后 diagnostics bundle 能识别 `VERIFY_FAILED`。

## 3. 验证

RED：

```bash
pw verify text --session wftest1 --text never-present --output json
pw diagnostics bundle --session wftest1 --out /tmp/bundle --output json
```

修复前：bundle `auditConclusion.status=no_strong_failure_signal`，`failureKind=null`。

GREEN：

```bash
pnpm build
pnpm exec tsx scripts/test/verify-failure-run.test.ts
```

并重新执行 `workflow-eval-automated-testing`：

```text
evidence: /tmp/pwcli-workflow-automated-testing-OxIQOb
session: wftest2
audit.status: failed_or_risky
audit.failedCommand: verify
audit.failureKind: VERIFY_FAILED
```

---
doc_type: issue-fix-note
issue: 2026-05-04-doctor-modal-recovery-contract
status: fixed
path: fastforward
severity: P1
root_cause_type: recovery-contract
tags:
  - doctor
  - recovery
  - modal
---

# doctor modal recovery contract Fix Note

## 1. 根因

`src/cli/commands/doctor.ts` 调用 `managedObserveStatus()` 后使用 `.catch()` 把异常转成普通 observe-status 数据：

```ts
{ data: { error: message } }
```

这导致 `MODAL_STATE_BLOCKED` 只剩普通错误字符串，没有被转成 `modal-state` diagnostic。后续 `doctorRecovery()` 只按 diagnostic kind 查找 modal，因此返回 `blocked=false`。

## 2. 修复内容

- `doctor` 捕获 session probe 异常时，识别 `MODAL_STATE_BLOCKED`。
- 将该异常转换为：

```text
kind: modal-state
status: fail
details.code: MODAL_STATE_BLOCKED
```

- 复用现有 `doctorRecovery()` 输出 `recovery.blocked=true`。
- 新增 `pnpm check:doctor-modal`，覆盖：
  - modal-triggering click 返回 `blockedState=MODAL_STATE_BLOCKED`
  - `page current` 返回 `MODAL_STATE_BLOCKED`
  - `doctor -s <session>` 返回 `modal-state` diagnostic 和 blocked recovery
- 修正辅助 E2E 的当前 contract 断言：
  - modal-triggering click 是动作成功，但结果携带 blocked state
  - `route load` 只通过 batch 内部子集验证，不再当作顶层 `pw route load`
  - diagnostics export 文本过滤只要求存在命中的 POST body，不要求全部记录都是 POST

## 3. 验证

RED：

```bash
node scripts/check-doctor-modal-contract.js
```

修复前：`doctor did not report modal-state recovery`。

GREEN：

```bash
pnpm build
pnpm check:doctor-modal
pnpm test:dogfood:e2e
```

结果：全部通过。

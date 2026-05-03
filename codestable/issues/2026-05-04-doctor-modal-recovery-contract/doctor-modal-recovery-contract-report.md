---
doc_type: issue-report
issue: 2026-05-04-doctor-modal-recovery-contract
status: confirmed
severity: P1
summary: "modal blocked 后 doctor --session 未输出 modal-state recovery。"
tags:
  - doctor
  - recovery
  - modal
  - command-contract
---

# doctor modal recovery contract Issue Report

## 1. 问题现象

辅助 dogfood E2E 在 modal blockage 场景失败：

```bash
pnpm test:dogfood:e2e
```

失败点：

```text
doctor sees modal state
```

最小复现中：

```bash
pw session create modoc --no-headed --open "data:text/html,<button id='b' onclick='alert(1)'>open</button>"
pw click -s modoc --selector '#b'
pw page current -s modoc --output json
pw doctor -s modoc --output json
```

`page current` 能返回：

```json
{
  "ok": false,
  "error": {
    "code": "MODAL_STATE_BLOCKED"
  }
}
```

但 `doctor -s modoc` 返回：

```json
{
  "ok": true,
  "data": {
    "recovery": {
      "blocked": false,
      "kind": null
    }
  }
}
```

## 2. 期望 vs 实际

**期望行为**：`doctor --session <name>` 能把 modal blocked state 诊断为 `modal-state`，并返回 `recovery.blocked=true`。

**实际行为**：`doctor` 把 observe 失败压成普通 observe-status compact diagnostic，丢失 `MODAL_STATE_BLOCKED` 语义。

## 3. 严重程度

**P1** — `MODAL_STATE_BLOCKED` 的错误建议明确让 Agent 运行 `pw doctor --session <name>` 复查。如果 doctor 不能确认 blocked state，失败恢复 SOP 会断链。

## 4. 复现频率

稳定复现。

---
doc_type: issue-report
issue: 2026-05-04-verify-failure-run-evidence
status: confirmed
severity: P1
summary: "VERIFY_FAILED 返回失败 envelope，但 diagnostics bundle 无法把最新失败识别为 verify failure。"
tags:
  - verify
  - diagnostics
  - evidence
  - workflow
---

# verify failure run evidence Issue Report

## 1. 问题现象

`workflow-eval-automated-testing` 中，故意执行失败断言：

```bash
pw verify text -s wftest1 --text "never-present" --output json
```

命令正确返回非零和 `VERIFY_FAILED`：

```json
{
  "ok": false,
  "command": "verify",
  "error": {
    "code": "VERIFY_FAILED",
    "message": "verify text failed"
  }
}
```

但随后执行：

```bash
pw diagnostics bundle -s wftest1 --out <dir> --output json
```

`manifest.json` 中的 `auditConclusion` 仍为：

```json
{
  "status": "no_strong_failure_signal",
  "failedCommand": "wait",
  "failureKind": null
}
```

## 2. 复现步骤

1. `pnpm build`
2. 创建包含文本 `present` 的 managed session。
3. 执行 `pw verify text --text missing --output json`。
4. 执行 `pw diagnostics bundle --out <dir> --output json`。
5. 查看 `<dir>/manifest.json` 的 `auditConclusion` 和 `latestRunEvents`。

复现频率：稳定复现。

## 3. 期望 vs 实际

**期望行为**：`VERIFY_FAILED` 应进入 run artifact，`diagnostics bundle` 能识别：

- `status: failed_or_risky`
- `failedCommand: verify`
- `failureKind: VERIFY_FAILED`
- `latestRunEvents.events[].failure.code: VERIFY_FAILED`

**实际行为**：`verify` 失败只存在于 CLI envelope；run artifact 没有记录，bundle 只能看到更早的 action/wait run。

## 4. 严重程度

**P1** — `VERIFY_FAILED` 的建议明确让 Agent 收集 diagnostics bundle。如果 bundle 看不到 verify failure，自动化测试 workflow 的失败报告和交接会断链。

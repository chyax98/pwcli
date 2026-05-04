---
doc_type: evaluation
slug: modal-doctor-recovery-breakthrough
status: completed
created: 2026-05-04
tags: [pre-1-0, recovery, doctor, modal, dialog, html-modal]
related_roadmap: pre-1-0-breakthrough
roadmap_item: modal-doctor-recovery-breakthrough
---

# Modal / Doctor Recovery Breakthrough

## 范围

本轮补齐 browser dialog 和页面级 HTML modal 的 doctor/recovery 证据：

- browser alert：action envelope、`MODAL_STATE_BLOCKED`、`doctor modal-state`。
- browser confirm：`dialog dismiss` 后页面事实更新。
- browser prompt：`dialog accept <prompt>` 后页面事实更新。
- HTML modal / overlay：`status` 可见 `modals.count`，`doctor` compact 输出新增 `html-modal` 诊断和 recovery suggestion。
- HTML modal 关闭后 doctor 不再报告 `html-modal`。

## 变更

- `doctor --session` 在 session probe 成功且页面中存在 visible HTML modal/overlay 时，新增 `diagnostics[].kind === "html-modal"`。
- `doctor.recovery` 对 `html-modal` 返回 `blocked=true`、`kind=html-modal`，建议 Agent 使用 close/cancel/confirm 按钮恢复。
- `check:doctor-modal` 扩展为覆盖 alert、confirm dismiss、prompt accept 和 HTML modal doctor recovery。

## 评估结论

| 场景 | 状态 | 证据 |
|---|---|---|
| alert blocked state | pass | `click #b` 返回 `MODAL_STATE_BLOCKED`，`page current` 返回同码，`doctor` 返回 `modal-state` |
| confirm dismiss | pass | `dialog dismiss` 返回 handled，`get text #result` 为 `no` |
| prompt accept | pass | `dialog accept Codex` 返回 handled 且 prompt=Codex，`get text #result` 为 `Codex` |
| HTML modal doctor | pass | `doctor` 返回 `html-modal` 诊断，`recovery.kind=html-modal` |
| HTML modal recovery | pass | 点击 close 后再次 `doctor` 不再返回 `html-modal` |

## 验证命令

```bash
pnpm build
pnpm check:doctor-modal
pnpm check:skill
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-breakthrough-items.yaml
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-command-evaluation-matrix.yaml
git diff --check
```

结果：通过。

## 结论

browser dialog 和 HTML modal 已有区分：

- browser dialog 是 run-code blocked state，错误码为 `MODAL_STATE_BLOCKED`，恢复用 `dialog accept|dismiss`。
- HTML modal 是页面内 overlay，不阻断 run-code read，但会挡交互；`doctor` 现在能在 compact 输出里提示 `html-modal`，恢复用页面内 close/cancel/confirm target。

后续 `run-code-timeout-recovery-breakthrough` 继续处理 provider/long flow timeout 后的 session 恢复，不混入本轮 modal contract。

---
doc_type: evaluation
slug: command-eval-page-tab-workspace
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, page, tab, dialog, snapshot, workspace]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-page-tab-workspace
---

# Command Evaluation: Page / Tab / Workspace

## 范围

本轮覆盖 workspace identity、tab 写操作、browser dialog 恢复和 snapshot ref epoch：

- `page current`
- `page list`
- `page frames`
- `page dialogs`
- `page assess`
- `tab select`
- `tab close`
- `dialog dismiss`
- `snapshot status`
- ref-backed `click` 的 stale ref 失败恢复

验证维度：

- active page 的 `pageId` / `navigationId` 投影。
- iframe frame projection。
- popup 后 `page list` 包含 opener 关系。
- `tab select|close` 只接受 stable `pageId`，拒绝 index。
- close popup 后 fallback 到 opener page。
- browser dialog 触发后 action 返回 `modalPending=true` / `MODAL_STATE_BLOCKED`。
- blocked session 先 `dialog dismiss` 恢复，再继续读取。
- `page dialogs` 是 observed event projection，不是 pending live dialog set。
- `snapshot status --output json` 必须是单一 JSON envelope。
- 导航后旧 ref 写操作失败为 `REF_STALE`，并给 `snapshot -i` 恢复路径。

不扩大范围：

- 页面级 HTML modal 的 blocked state 归 `modal-doctor-recovery-breakthrough`。
- `dialog accept` / prompt 文本归 recovery 专项继续补充；本轮用 alert + dismiss 证明 browser dialog handle 主路。
- 多层 iframe 选择和 frame 内动作归后续 workflow。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `page current` | proven | 返回 active `p1`、当前 `navigationId` 和 workspace projection |
| `page list` | proven | popup 后返回 2 个 page，popup `openerPageId=p1` |
| `page frames` | proven | srcdoc iframe 后 `frameCount >= 2` |
| `page assess` | proven | 页面摘要识别 `hasFrames=true`，输出 nextSteps/limitations |
| `page dialogs` | proven with limitation | 未阻塞时返回 empty projection + limitation；browser dialog pending 时返回 `MODAL_STATE_BLOCKED`；dismiss 后 observed event 可读 |
| `tab select` | proven | `tab select <pageId>` 成功；`tab select 0` 失败为 `TAB_SELECT_FAILED/TAB_PAGE_NOT_FOUND:0` |
| `tab close` | proven | 关闭 popup 后 `closedPageId=p2`，`fallbackPageId=p1` |
| `dialog dismiss` | proven | alert pending 后 `dialog dismiss` 返回 `handled=true` |
| `snapshot status` | proven | fresh/stale 状态均通过；修复 `--output json` 双 envelope 问题 |
| ref-backed `click` | proven | 导航后旧 ref 失败为 `REF_STALE`，suggestions 包含 `snapshot -i` |

## focused check

本轮使用受控 `about:blank` 页面夹具：

```bash
pw session create pgqdve02 --headless --open about:blank --output json
pw code --session pgqdve02 '<inject workspace fixture>' --output json
pw page current --session pgqdve02 --output json
pw page list --session pgqdve02 --output json
pw page frames --session pgqdve02 --output json
pw page assess --session pgqdve02 --output json
pw page dialogs --session pgqdve02 --output json
pw snapshot -i --session pgqdve02 --output json
pw snapshot status --session pgqdve02 --output json
pw click --selector '#popup' --session pgqdve02 --output json
pw page list --session pgqdve02 --output json
pw tab select p2 --session pgqdve02 --output json
pw tab select 0 --session pgqdve02 --output json
pw tab close p2 --session pgqdve02 --output json
pw click --selector '#alert-btn' --session pgqdve02 --output json
pw page dialogs --session pgqdve02 --output json
pw dialog dismiss --session pgqdve02 --output json
pw page dialogs --session pgqdve02 --output json
pw open 'about:blank?after-stale=1' --session pgqdve02 --output json
pw snapshot status --session pgqdve02 --output json
pw click e4 --session pgqdve02 --output json
pw session close pgqdve02 --output json
```

结果：

```text
page/tab/workspace focused check passed
evidence directory: /tmp/pwcli-page-eval-pgqdve02
popupId: p2
actionRef: e4
```

关键 envelope：

```json
{
  "clickAlert": {
    "acted": true,
    "modalPending": true,
    "blockedState": "MODAL_STATE_BLOCKED"
  },
  "tabSelectIndexFailure": {
    "code": "TAB_SELECT_FAILED",
    "messageContains": "TAB_PAGE_NOT_FOUND:0"
  },
  "staleClickFailure": {
    "code": "REF_STALE",
    "recovery": "snapshot -i"
  }
}
```

## 修复记录

本轮评测发现 `snapshot status --output json` 会先输出 `snapshot status` envelope，又继续执行 parent `snapshot` 并输出第二个 envelope。这个会破坏 Agent 对 JSON 输出的稳定消费。

已修复：

- `src/cli/commands/snapshot.ts` 在 `snapshot status` 子命令路径跳过 parent snapshot capture。
- 新增回归：`snapshot status returns a single JSON envelope`。

## 关键发现

- `page dialogs` 不是 pending browser dialog live list。真实 browser dialog pending 时，run-code-backed projection 会被 `MODAL_STATE_BLOCKED` 阻断。
- Agent SOP 必须改成：如果 action 返回 `modalPending=true` 或 `MODAL_STATE_BLOCKED`，直接执行 `pw dialog accept|dismiss`；不要继续堆叠 `page dialogs`。
- `page dialogs` 仍有价值：未阻塞时提供 observed dialog events 和 limitation；dialog dismiss 后可以读到刚才的 alert event。
- `tab select|close` 的写操作目标必须是 `pageId`，不能用 index。`tab select 0` 的失败是预期 contract，不是兼容缺口。
- `snapshot status` 是 ref epoch health check；旧 ref 的动作恢复路径仍是重新 `snapshot -i` 后选择 fresh ref。

## 后续

- `dialog accept`、prompt dialog、confirm dialog 进入 recovery breakthrough 或 workflow 串联继续补证。
- 页面级 HTML modal 需要在 `modal-doctor-recovery-breakthrough` 中覆盖 `status` / `doctor` / `snapshot status` 的一致恢复建议。
- 多页面真实任务需要在 workflow eval 里继续 dogfood，避免只停留在受控 popup 夹具。

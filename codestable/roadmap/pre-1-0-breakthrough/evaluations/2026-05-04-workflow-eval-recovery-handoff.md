---
doc_type: evaluation
slug: workflow-eval-recovery-handoff
status: completed
created: 2026-05-04
tags: [pre-1-0, workflow-evaluation, recovery, handoff, modal, doctor, diagnostics]
related_roadmap: pre-1-0-breakthrough
roadmap_item: workflow-eval-recovery-handoff
---

# Workflow Evaluation: Recovery / Handoff

## 范围

本轮验证 Agent 遇到 browser dialog blocked state 时，是否能按 `skills/pwcli/` 恢复并生成可交接证据。覆盖：

- action 返回 `modalPending=true` / `blockedState=MODAL_STATE_BLOCKED`。
- blocked session 下 read/bundle 的失败 envelope。
- `doctor --session` 的 `modal-state` 恢复建议。
- `dialog dismiss` 恢复。
- 恢复后 `page current` / `page dialogs` / `diagnostics digest` / `diagnostics bundle`。
- bundle 的 run 级 handoff：`failureKind=MODAL_STATE_BLOCKED`，并能用 `diagnostics show/grep --run` 查到 failureSignal。

## 评估结论

| workflow step | 状态 | 证据 |
|---|---|---|
| fixture bootstrap | pass | `scripts/e2e/dogfood-server.js` 本地 fixture，入口 `http://127.0.0.1:44587` |
| precondition | pass | 登录并进入 reproduce workspace，初始 digest 无 console/network/page error |
| trigger blocked state | pass | `click #open-alert` 返回 `modalPending=true`、`blockedState=MODAL_STATE_BLOCKED` |
| blocked read envelope | pass | `page current` 返回 `MODAL_STATE_BLOCKED`、`retryable=false`、recovery commands 包含 `dialog dismiss` 和 `doctor` |
| doctor recovery | pass | `doctor -s wfrecover1` 返回 `diagnostics.kind=modal-state`，`recovery.blocked=true`，`recovery.kind=modal-state` |
| blocked bundle envelope | pass | blocked 当下 `diagnostics bundle` 返回 `MODAL_STATE_BLOCKED`，说明 bundle 也不能绕过 browser dialog |
| dialog recovery | pass | `dialog dismiss` 返回 `handled=true`，随后 `page current` 恢复 |
| observed dialog record | pass | 恢复后 `page dialogs` 返回 `dialogCount=1` 和 `message=dogfood-modal`，同时保留 observed-only limitation |
| recovered digest | pass | 恢复后 digest 无 console error、page error、failed request、HTTP error |
| handoff bundle | pass | `bundle-recovered` manifest 非空，audit 指向 blocked click run 和 `MODAL_STATE_BLOCKED` |
| run handoff | pass | `diagnostics show/grep --run 2026-05-04T01-50-40-474Z-wfrecover1` 返回 `failureSignal.code=MODAL_STATE_BLOCKED` |

## focused workflow

最终证据目录：

```text
/tmp/pwcli-workflow-recovery-handoff-i03VrX
```

关键命令：

```bash
node scripts/e2e/dogfood-server.js 44587

pw session create wfrecover1 --no-headed --open http://127.0.0.1:44587/login
pw fill -s wfrecover1 --selector '#email' recover@example.com
pw click -s wfrecover1 --selector '#login-submit'
pw wait -s wfrecover1 --selector '#project-alpha'
pw open -s wfrecover1 http://127.0.0.1:44587/app/projects/alpha/incidents/checkout-timeout/reproduce
pw wait -s wfrecover1 --selector '#open-alert'
pw diagnostics digest -s wfrecover1

pw click -s wfrecover1 --selector '#open-alert' --output json
pw page current -s wfrecover1 --output json
pw doctor -s wfrecover1 --output json
pw diagnostics bundle -s wfrecover1 --out /tmp/pwcli-workflow-recovery-handoff-i03VrX/bundle-blocked --output json

pw dialog dismiss -s wfrecover1 --output json
pw page current -s wfrecover1 --output json
pw page dialogs -s wfrecover1 --output json
pw diagnostics digest -s wfrecover1 --output json
pw diagnostics bundle -s wfrecover1 --out /tmp/pwcli-workflow-recovery-handoff-i03VrX/bundle-recovered --output json
pw screenshot -s wfrecover1 --selector 'main' --path /tmp/pwcli-workflow-recovery-handoff-i03VrX/recovered-main.png --output json
pw diagnostics show --run 2026-05-04T01-50-40-474Z-wfrecover1 --limit 20 --output json
pw diagnostics grep --run 2026-05-04T01-50-40-474Z-wfrecover1 --text MODAL_STATE_BLOCKED --limit 20 --output json
pw session close wfrecover1
```

最终断言：

```text
click-blocked: modalPending=true, blockedState=MODAL_STATE_BLOCKED
page-current-blocked: error.code=MODAL_STATE_BLOCKED
doctor-modal-state: recovery.blocked=true, recovery.kind=modal-state
bundle-while-blocked: error.code=MODAL_STATE_BLOCKED
dialog-dismiss: handled=true
page-current-after-dismiss: ok=true, title=checkout-timeout reproduce
page-dialogs-after-dismiss: dialogCount=1, message=dogfood-modal, limitation=observed-only
digest-after-dismiss: consoleError=0, pageError=0, failedRequest=0, httpError=0
bundle-recovered-audit: failed_or_risky / click / MODAL_STATE_BLOCKED
bundle-recovered-manifest-bytes: 47717
screenshot-bytes: 106359
run-show-grep: failureSignal.code=MODAL_STATE_BLOCKED
```

## 关键发现

- blocked 当下继续堆叠 read 或 bundle 会得到 `MODAL_STATE_BLOCKED`。正确 handoff 顺序是：action envelope → `doctor` 确认 → `dialog accept|dismiss` → 恢复后再 bundle。
- `diagnostics bundle` 不能绕过 browser dialog，这是合理限制，不应包装成“blocked 时仍可生成完整 bundle”。
- `page dialogs` 恢复后读取的是 observed dialog events，仍然不是 live dialog set；本轮输出 `open=true` 是历史事件字段，不代表 dialog 仍阻塞。SOP 必须继续强调 limitation。
- `doctor` 会同时报告本地 browser install warnings；本轮真正阻塞信号是 `modal-state`，其他环境 warnings 不影响当前恢复闭环。
- bundle 的 handoff 对 run 级 failureSignal 表现正常：`failedCommand=click`、`failureKind=MODAL_STATE_BLOCKED`、`agentNextSteps` 指向 `diagnostics show/grep --run`。

## 验证

```bash
pnpm build
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-breakthrough-items.yaml
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-command-evaluation-matrix.yaml
pnpm check:skill
pnpm check:doctor-modal
git diff --check
```

结果：通过。

## 后续

- `modal-doctor-recovery-breakthrough` 继续覆盖页面级 modal、复杂 blocked state 和 doctor 一致性。
- `run-code-timeout-recovery-breakthrough` 继续验证长等待/超时后的恢复 SOP。

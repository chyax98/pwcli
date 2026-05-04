---
doc_type: evaluation
slug: real-agent-task-matrix
status: completed
created: 2026-05-04
related_roadmap: pre-1-0-breakthrough
roadmap_item: real-agent-task-matrix
result: pass-with-blocker
---

# Real Agent Task Matrix

## 目标

按 Agent 用户视角验证 `pwcli` 1.0 产品可用性。矩阵不以单命令 help 或脚本绿灯为准，而以 Agent 按 `skills/pwcli/` 完成真实任务链为准。

## 结论

本地 Agent-first 核心任务矩阵通过；测试/RND/Forge/DC 真实登录链路仍有正式 P1 blocker，不能把 `auth dc` 标成 proven。

| 场景 | 环境 | 状态 | 证据 |
|---|---|---|---|
| 通用浏览器自动化 | local fixture | pass | `2026-05-04-workflow-eval-browser-automation.md` |
| 自动化测试 / mock / environment | local fixture | pass | `2026-05-04-workflow-eval-automated-testing.md` |
| 填表 / 上传 / 拖拽 / 下载 / PDF | local dogfood fixture | pass | `2026-05-04-workflow-eval-form-file-download.md` |
| 简单爬取 / 多页提取 / iframe | local dogfood fixture | pass | `2026-05-04-workflow-eval-crawler-extraction.md` |
| Deep Bug 复现与分析 | local dogfood fixture | pass | `2026-05-04-workflow-eval-deep-bug-reproduction.md` |
| blocked state 恢复和交接 | local dogfood fixture | pass | `2026-05-04-workflow-eval-recovery-handoff.md` |
| evidence bundle / handoff | local focused test | pass | `2026-05-04-evidence-bundle-1-0-contract.md` |
| HAR replay deterministic stubbing | local focused test | pass | `2026-05-04-har-trace-1-0-decision.md` |
| auth dc / Forge / DC provider proof | test/RND/explicit target | blocked | `codestable/issues/2026-05-04-auth-dc-real-env-proof-blocked/auth-dc-real-env-proof-blocked-report.md` |

## 覆盖能力

矩阵覆盖的 command groups：

- lifecycle / navigation：`session create|close`、`open`
- observation：`status`、`page current|frames|dialogs`、`read-text`、`snapshot`、`locate`、`get`、`verify`
- interaction：`click`、`fill`、`type`、`press`、`hover`、`scroll`、`drag`、`upload`、`download`
- diagnostics：`diagnostics digest|export|bundle|runs|show|grep|timeline`、`console`、`network`、`errors`、`doctor`
- artifacts：`screenshot`、`pdf`、`trace start|stop|inspect`、`video start|stop`
- HAR boundary：`har start|stop` 明确失败，`har replay|replay-stop` proven
- route/mock/bootstrap/environment：`route add|list|remove`、`environment permissions|geolocation`
- state/auth：`auth fixture-auth`、`auth probe`、`state`、`cookies`、`storage`；`auth dc` blocked
- tooling：`batch`、`code`、`skill`、`dashboard`、`sse`

逐 command 状态以 `pre-1-0-command-evaluation-matrix.yaml` 为准；本矩阵只证明产品 workflow 串联。

## 真实环境状态

已完成真实环境入口映射；稳定规则已进入 `skills/pwcli/references/forge-dc-auth.md`、`commands/session-advanced.md` 和 auth blocker issue。

`auth dc` proof 执行后形成 blocker：

- 默认 local-ip 目标：`DC_AUTH_URL_UNREACHABLE`
- 明确 `targetUrl`：`RUN_CODE_TIMEOUT`，后续 session probe 不可读
- 不提交真实 URL、账号、token、cookie、state 或截图
- `auth` command matrix 当前为 `blocked`

解除 blocker 后最短复验：

```bash
pw session create dc-proof --headed --open '<forge-or-dc-url>'
pw auth dc --session dc-proof --arg targetUrl='<forge-or-dc-url>' --output json
pw read-text --session dc-proof --max-chars 1200
pw auth probe --session dc-proof --output json
pw diagnostics bundle --session dc-proof --out /tmp/pwcli-auth-dc-proof/bundle --task 'auth dc proof' --limit 20 --output json
```

## 1.0 影响

本矩阵允许进入 skill SOP audit 和 CodeStable truth audit，但不允许 1.0 acceptance 把 `auth dc` 写成 proven。Pre-1.0 / RC / 1.0 的 release note 必须明确：

- 本地浏览器自动化、测试、表单文件、爬取、bug 复现、恢复、证据交接：proven
- HAR 热录制：不支持；HAR replay：proven
- `auth dc`：blocked，等待有效测试/RND 目标和账号材料解除

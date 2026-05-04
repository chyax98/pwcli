---
doc_type: evaluation
slug: workflow-eval-deep-bug-reproduction
status: completed
created: 2026-05-04
tags: [pre-1-0, workflow-evaluation, deep-bug, diagnostics, network, console, bundle]
related_roadmap: pre-1-0-breakthrough
roadmap_item: workflow-eval-deep-bug-reproduction
related_issues:
  - diagnostics-bundle-session-signal-run-misattribution
---

# Workflow Evaluation: Deep Bug Reproduction

## 范围

本轮验证 Deep Bug 复现与分析 workflow。目标不是让 fixture 通过，而是让 Agent 能复现失败、读取页面事实、定位 console/network 证据、导出 bundle，并形成可交接的下一步。

覆盖：

- 登录并进入受保护 reproduce workspace。
- 清理 page error baseline。
- 触发业务失败：`#trigger-bug` 调用 `/api/incidents/alpha/checkout-timeout/start` 并返回 500。
- 页面事实恢复：错误等待失败后用 `read-text` 重新确认真实文案。
- console/network/errors 查询。
- diagnostics digest/timeline/runs/export/bundle。
- 截图证据。
- bundle handoff 缺陷修复和复验。

## 评估结论

| workflow step | 状态 | 证据 |
|---|---|---|
| fixture bootstrap | pass | `scripts/e2e/dogfood-server.js` 本地 fixture，入口 `http://127.0.0.1:44585` / 修复复验 `44586` |
| baseline clear | pass | `errors clear` 返回 total 0，初始 digest 无 console/network/page error |
| bug reproduce | pass | `click #trigger-bug` 后页面显示 `CHECKOUT_TIMEOUT`，network 500，console error |
| fact recovery | pass | 初次 `wait` 文案写错触发 `RUN_CODE_TIMEOUT`；随后 `read-text` 找到真实错误文案并 `verify text` 通过 |
| console evidence | pass | `console --level error --text checkout-timeout` 返回业务错误 |
| network evidence | pass | `network --status 500 --url ... --include-body` 返回 POST 500 和 JSON body |
| page errors | pass | `errors recent` 为 0，说明本问题是业务 API/console，不是 pageerror |
| diagnostics digest | pass | topSignals 包含 console error、resource 500、POST 500；summary 为 consoleError=2、httpError=1 |
| diagnostics export | pass | network/console 分别导出到 `/tmp/pwcli-workflow-deep-bug-h7EEAN` |
| diagnostics bundle | fixed/pass | 修复后 `bundle-fixed` 指向 session 级 console signal，不再把最新 screenshot run 当失败命令 |

## focused workflow

最终证据目录：

```text
/tmp/pwcli-workflow-deep-bug-h7EEAN
```

关键命令：

```bash
node scripts/e2e/dogfood-server.js 44585

pw session create wfbug01 --no-headed --open http://127.0.0.1:44585/login
pw fill -s wfbug01 --selector '#email' bug-agent@example.com
pw click -s wfbug01 --selector '#login-submit'
pw wait -s wfbug01 --selector '#project-alpha'
pw open -s wfbug01 http://127.0.0.1:44585/app/projects/alpha/incidents/checkout-timeout/reproduce
pw wait -s wfbug01 --selector '#trigger-bug'
pw errors clear -s wfbug01
pw diagnostics digest -s wfbug01

pw click -s wfbug01 --selector '#trigger-bug'
pw wait -s wfbug01 --text 'bug-result: CHECKOUT_TIMEOUT / Simulated checkout timeout'
pw read-text -s wfbug01 --max-chars 1200
pw verify text -s wfbug01 --text 'bug-result: CHECKOUT_TIMEOUT / checkout request timed out after gateway retry' --output json

pw console -s wfbug01 --level error --text checkout-timeout --limit 10 --output json
pw network -s wfbug01 --status 500 --url '/api/incidents/alpha/checkout-timeout/start' --include-body --limit 10 --output json
pw errors recent -s wfbug01 --limit 10 --output json
pw diagnostics digest -s wfbug01 --output json
pw diagnostics timeline -s wfbug01 --limit 30 --output json
pw diagnostics runs -s wfbug01 --limit 10 --output json
pw diagnostics export -s wfbug01 --section network --text CHECKOUT_TIMEOUT --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out /tmp/pwcli-workflow-deep-bug-h7EEAN/network-checkout-timeout.json --output json
pw diagnostics export -s wfbug01 --section console --text checkout-timeout --fields at=timestamp,level,text --out /tmp/pwcli-workflow-deep-bug-h7EEAN/console-checkout-timeout.json --output json
pw screenshot -s wfbug01 --selector 'main' --path /tmp/pwcli-workflow-deep-bug-h7EEAN/bug-reproduce-main.png --output json
pw diagnostics bundle -s wfbug01 --out /tmp/pwcli-workflow-deep-bug-h7EEAN/bundle --output json
```

修复复验：

```bash
node scripts/e2e/dogfood-server.js 44586
pw session create wfbug02 --no-headed --open http://127.0.0.1:44586/login
# 重复登录、打开 reproduce、触发 #trigger-bug、verify 页面错误
pw screenshot -s wfbug02 --selector 'main' --path /tmp/pwcli-workflow-deep-bug-h7EEAN/bug-reproduce-main-fixed.png --output json
pw diagnostics bundle -s wfbug02 --out /tmp/pwcli-workflow-deep-bug-h7EEAN/bundle-fixed --output json
```

最终断言：

```text
page-fact: bug-result: CHECKOUT_TIMEOUT / checkout request timed out after gateway retry
console-error: checkout-timeout CHECKOUT_TIMEOUT
network-500: POST /api/incidents/alpha/checkout-timeout/start -> 500
network-body: errorCode CHECKOUT_TIMEOUT
errors-recent: 0
digest-summary: consoleError=2, httpError=1, pageError=0, failedRequest=0
network-export-bytes: 575
console-export-bytes: 589
screenshot-bytes: 113865
bundle-fixed-manifest-bytes: 59487
bundle-fixed-audit: failed_or_risky / failedCommand=null / failureKind=console:error
bundle-fixed-next-steps: diagnostics timeline/digest/export --session wfbug02
```

## 关键发现

- Deep Bug workflow 必须先看页面事实，再看 console/network。初始 `wait` 使用了错误期望文案并触发 `RUN_CODE_TIMEOUT`，正确恢复路径是 `read-text` → 用真实业务文案 `verify`。
- `errors recent` 为 0 是有价值结论：当前问题不是 pageerror，而是业务 API 500 和 app console error。
- `diagnostics digest` 的 topSignals 足以把问题归因为 `POST /api/incidents/alpha/checkout-timeout/start -> 500` 与 `CHECKOUT_TIMEOUT`。
- 本轮暴露并修复 P1：session 级 console/network 信号被 bundle 的 `failedCommand` 误归因到最新成功 screenshot run。修复记录：
  - `codestable/issues/2026-05-04-diagnostics-bundle-session-signal-run-misattribution/diagnostics-bundle-session-signal-run-misattribution-report.md`
  - `codestable/issues/2026-05-04-diagnostics-bundle-session-signal-run-misattribution/diagnostics-bundle-session-signal-run-misattribution-fix-note.md`

## 验证

```bash
pnpm build
pnpm exec tsx scripts/test/verify-failure-run.test.ts
pnpm exec tsx scripts/test/diagnostics-failure-run.test.ts
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-breakthrough-items.yaml
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-command-evaluation-matrix.yaml
pnpm check:skill
git diff --check
```

结果：通过。

## 后续

- `workflow-eval-recovery-handoff` 继续验证 blocked state、doctor 和 handoff report。
- `evidence-bundle-1-0-contract` 后续需要把 `auditConclusion` 字段命名从历史 `failed*` 进一步收敛成 1.0 manifest 语义。

---
doc_type: evaluation
slug: workflow-eval-automated-testing
status: completed
created: 2026-05-04
tags: [pre-1-0, workflow-evaluation, automated-testing, route, environment, diagnostics]
related_roadmap: pre-1-0-breakthrough
roadmap_item: workflow-eval-automated-testing
---

# Workflow Evaluation: Automated Testing

## 范围

本轮验证 Agent-first 自动化测试 workflow，而不是把 `pwcli` 扩成 Playwright Test 替代品。覆盖：

- 本地 HTTP fixture
- `route add/list/remove` mock API
- `environment permissions grant`
- `environment geolocation set`
- 动作后 `wait` + `verify`
- 故意失败断言的 `VERIFY_FAILED` envelope
- `diagnostics digest` 和 `diagnostics bundle` 失败报告

## 评估结论

| workflow step | 状态 | 证据 |
|---|---|---|
| fixture bootstrap | pass | 本地 HTTP fixture 返回测试页面和 `/api/status` |
| route/mock | pass | `route add "**/api/status"` 后页面 fetch 显示 `api:mocked`；`route list` 有规则；`route remove` 成功 |
| positive assertion | pass | `verify text "api:mocked"` 返回 `passed=true` |
| environment control | pass | geolocation permission + set 后页面显示 `geo:35.6812,139.7671` |
| failure envelope | pass | `verify text "never-present"` 返回非零 `VERIFY_FAILED` |
| failure report | pass | `diagnostics bundle` 将最新失败识别为 `failedCommand=verify`、`failureKind=VERIFY_FAILED` |
| browser noise control | pass | fixture 返回 favicon 204，最终 digest 中 console/page error 为 0 |

## focused workflow

最终证据目录：

```text
/tmp/pwcli-workflow-automated-testing-OxIQOb
```

关键命令：

```bash
pw session create wftest2 --no-headed --open http://127.0.0.1:<port>/ --output json
pw route add "**/api/status" -s wftest2 --method GET --status 200 --content-type application/json --body '{"state":"mocked"}' --output json
pw route list -s wftest2 --output json
pw click -s wftest2 --selector "#load" --output json
pw wait -s wftest2 --text "api:mocked" --output json
pw verify text -s wftest2 --text "api:mocked" --output json
pw environment permissions grant geolocation -s wftest2 --output json
pw environment geolocation set -s wftest2 --lat 35.6812 --lng 139.7671 --accuracy 9 --output json
pw click -s wftest2 --selector "#geo-btn" --output json
pw wait -s wftest2 --text "geo:35.6812,139.7671" --output json
pw verify text -s wftest2 --text "geo:35.6812,139.7671" --output json
pw route remove "**/api/status" -s wftest2 --output json
pw verify text -s wftest2 --text "never-present" --output json
pw diagnostics digest -s wftest2 --output json
pw diagnostics bundle -s wftest2 --out /tmp/pwcli-workflow-automated-testing-OxIQOb/bundle --output json
pw session close wftest2 --output json
```

最终断言：

```text
route-add: pass
route-list: pass
mocked-api-wait: pass
mocked-api-verify: pass
permission: pass
geo-set: pass
geo-wait: pass
geo-verify: pass
route-remove: pass
failure-envelope: VERIFY_FAILED
digest-no-browser-noise: pass
bundle-audit-failure: failed_or_risky / verify / VERIFY_FAILED
```

## 关键发现

- 自动化测试 workflow 必须把正向断言和失败断言都纳入证据；只跑 happy path 不足以证明产品可用于测试。
- 本轮暴露 P1：`VERIFY_FAILED` 有 CLI envelope，但未进入 run artifact，导致 bundle 无法形成失败报告。已修复并记录：
  - `codestable/issues/2026-05-04-verify-failure-run-evidence/verify-failure-run-evidence-report.md`
  - `codestable/issues/2026-05-04-verify-failure-run-evidence/verify-failure-run-evidence-fix-note.md`
- fixture 应避免 favicon 404 等浏览器噪声，否则 diagnostics digest 会出现与任务无关的 console-resource-error。
- `route/mock` 只服务 controlled-testing，不扩成通用测试框架；复杂测试仍按 Agent workflow 串联命令和证据。

## 验证

```bash
pnpm build
pnpm exec tsx scripts/test/verify-failure-run.test.ts
```

结果：通过。

## 后续

- `workflow-eval-form-file-download` 继续覆盖上传、拖拽、下载、截图/PDF 的文件型 workflow。
- `workflow-eval-deep-bug-reproduction` 需要把真实 failureKind、console/network/errors 和 bundle handoff 串起来。

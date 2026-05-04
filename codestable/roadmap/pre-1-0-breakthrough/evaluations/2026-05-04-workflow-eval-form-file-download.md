---
doc_type: evaluation
slug: workflow-eval-form-file-download
status: completed
created: 2026-05-04
tags: [pre-1-0, workflow-evaluation, form, upload, download, drag, artifacts]
related_roadmap: pre-1-0-breakthrough
roadmap_item: workflow-eval-form-file-download
---

# Workflow Evaluation: Form / File / Download

## 范围

本轮验证文件型真实任务 workflow，而不是重复单命令 focused check。覆盖：

- 登录后进入受保护业务页。
- 表单输入和页面导航。
- 文件上传后由页面状态确认。
- 拖拽后由页面状态确认。
- 文件下载后由本地文件内容确认。
- 截图、PDF 和 diagnostics bundle 证据产出。

## 评估结论

| workflow step | 状态 | 证据 |
|---|---|---|
| fixture bootstrap | pass | `scripts/e2e/dogfood-server.js` 本地 fixture，入口 `http://127.0.0.1:44583` |
| login + protected navigation | pass | `wfform05` 登录后 `open` 到 reproduce workspace，`page current` 显示目标 URL |
| upload | pass | `upload #upload-input` 上传 `dogfood-route-body.txt`，`verify text` 确认页面显示文件名 |
| drag | pass | `drag #drag-card-a -> #drag-lane-done`，`verify text` 确认状态为 moved |
| download | pass | `download #download-report --dir ...` 生成 `dogfood-report.txt`，内容包含 `dogfood-report:dogfood-1` |
| screenshot | pass | `reproduce-main.png` 非空，110252 bytes |
| pdf | pass | `reproduce-page.pdf` 非空，159417 bytes |
| diagnostics | pass | digest 无 console error、page error、failed request、HTTP error；bundle audit 为 `no_strong_failure_signal` |

## focused workflow

最终证据目录：

```text
/tmp/pwcli-workflow-form-file-download-kIi4aM
```

关键命令：

```bash
pnpm build
node scripts/e2e/dogfood-server.js 44583

pw session create wfform05 --no-headed --open http://127.0.0.1:44583/login --output json
pw fill -s wfform05 --selector '#email' agent-form@example.com --output json
pw fill -s wfform05 --selector '#password' pwcli-secret --output json
pw click -s wfform05 --selector '#login-submit' --output json
pw wait -s wfform05 --selector 'h1' --output json
pw open -s wfform05 http://127.0.0.1:44583/app/projects/alpha/incidents/checkout-timeout/reproduce --output json
pw wait -s wfform05 --selector '#upload-input' --output json

pw upload -s wfform05 --selector '#upload-input' scripts/e2e/dogfood-route-body.txt --output json
pw wait -s wfform05 --text 'upload-result: dogfood-route-body.txt' --output json
pw verify text -s wfform05 --text 'upload-result: dogfood-route-body.txt' --output json

pw drag -s wfform05 --from-selector '#drag-card-a' --to-selector '#drag-lane-done' --output json
pw wait -s wfform05 --text 'drag-status: moved triage customer report' --output json
pw verify text -s wfform05 --text 'drag-status: moved triage customer report' --output json

pw download -s wfform05 --selector '#download-report' --dir /tmp/pwcli-workflow-form-file-download-kIi4aM/downloads --output json
pw screenshot -s wfform05 --selector 'main' --path /tmp/pwcli-workflow-form-file-download-kIi4aM/reproduce-main.png --output json
pw pdf -s wfform05 --path /tmp/pwcli-workflow-form-file-download-kIi4aM/reproduce-page.pdf --output json
pw diagnostics digest -s wfform05 --output json
pw diagnostics bundle -s wfform05 --out /tmp/pwcli-workflow-form-file-download-kIi4aM/bundle --output json
pw session close wfform05 --output json
```

最终断言：

```text
upload-settle: fileCount=1, filesMatch=true, settled=true
upload-verify: pass
drag: dragged=true
drag-verify: pass
download: downloaded=true, savedAs=/tmp/pwcli-workflow-form-file-download-kIi4aM/downloads/dogfood-report.txt
download-content: dogfood-report:dogfood-1
screenshot-bytes: 110252
pdf-bytes: 159417
diagnostics-summary: consoleError=0, pageError=0, failedRequest=0, httpError=0
bundle-audit: no_strong_failure_signal
```

## 关键发现

- 文件型 workflow 需要页面侧验证和本地 artifact 验证同时存在。只看 `upload uploaded=true` 或 `download downloaded=true` 不足以证明任务完成。
- 宽泛 `wait --text Projects` 在登录后命中了面包屑和 H1，返回 `ACTION_TARGET_AMBIGUOUS` 和恢复建议。最终证据改用 `wait --selector 'h1'` 与目标页的 `#upload-input`，说明 workflow SOP 应优先使用窄 selector 或 role/name。
- `diagnostics bundle` 在成功 workflow 中返回 `status=no_strong_failure_signal`，但 `auditConclusion.failedAt/failedCommand` 字段仍指向最新 run。它不是本轮阻塞，后续由 `evidence-bundle-1-0-contract` 澄清 1.0 manifest 字段语义。

## 验证

```bash
pnpm build
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-breakthrough-items.yaml
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-command-evaluation-matrix.yaml
pnpm check:skill
git diff --check
```

结果：通过。

## 后续

- `workflow-eval-crawler-extraction` 继续验证多页读取、信息提取、导出和去噪。
- `evidence-bundle-1-0-contract` 需要收敛成功/失败 bundle 的 manifest 字段命名，避免成功 run 仍用 `failed*` 字段造成 Agent 误读。

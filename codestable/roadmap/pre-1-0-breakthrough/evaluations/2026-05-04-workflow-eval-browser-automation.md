---
doc_type: evaluation
slug: workflow-eval-browser-automation
status: completed
created: 2026-05-04
tags: [pre-1-0, workflow-evaluation, browser-automation, agent-dogfood]
related_roadmap: pre-1-0-breakthrough
roadmap_item: workflow-eval-browser-automation
---

# Workflow Evaluation: Browser Automation

## 范围

本轮验证通用浏览器自动化 workflow，不只证明单个 command 可用，而是按 `skills/pwcli/` 标准闭环串联：

```text
session create
→ status / page current / read-text
→ locate / snapshot -i
→ fill / click
→ wait
→ verify / get
→ screenshot
→ diagnostics digest / bundle
→ session close
```

任务目标：在本地可控页面中新增一个 release task、等待页面状态变化、验证新增 task 和完成状态、生成截图与诊断证据。

## 评估结论

| workflow step | 状态 | 证据 |
|---|---|---|
| session lifecycle | pass | `session create wfauto2 --no-headed --open <data-url>` 成功，最终 `session close` 成功 |
| first read | pass | `status`、`page current`、`read-text` 返回页面标题和主要文本 |
| locate / structure | pass | `locate --text "Add task"` 返回 `count=1`；`snapshot -i` 成功 |
| form action | pass | `fill #task-name "ship candidate"` 返回 `filled=true` |
| click + wait | pass | `click #add` 返回 `acted=true`；`wait --text "added:ship candidate"` 返回 `matched=true` |
| assertion | pass | `verify text "ship candidate pending"` 和 `verify text "baseline done"` 均返回 `passed=true` |
| read-only fact | pass | `get count --selector ".task"` 返回 `value=2` |
| evidence | pass | selector screenshot 输出非空 PNG；diagnostics bundle 输出 `manifest.json` |
| diagnostics health | pass | digest 里 console/page/network 错误计数均为 0；bundle audit 为 `no_strong_failure_signal` |

## focused workflow

最终证据目录：

```text
/tmp/pwcli-workflow-browser-automation-d1jXLh
```

关键命令：

```bash
pw session create wfauto2 --no-headed --open '<base64 data url>' --output json
pw status -s wfauto2 --output json
pw page current -s wfauto2 --output json
pw read-text -s wfauto2 --max-chars 1000 --output json
pw locate -s wfauto2 --text "Add task" --output json
pw snapshot -i -s wfauto2 --output json
pw fill -s wfauto2 --selector "#task-name" "ship candidate" --output json
pw click -s wfauto2 --selector "#add" --output json
pw wait -s wfauto2 --text "added:ship candidate" --output json
pw verify text -s wfauto2 --text "ship candidate pending" --output json
pw click -s wfauto2 --selector "#complete" --output json
pw wait -s wfauto2 --text "completed" --output json
pw verify text -s wfauto2 --text "baseline done" --output json
pw get count -s wfauto2 --selector ".task" --output json
pw screenshot -s wfauto2 --selector "main" --path /tmp/pwcli-workflow-browser-automation-d1jXLh/main.png --output json
pw diagnostics digest -s wfauto2 --output json
pw diagnostics bundle -s wfauto2 --out /tmp/pwcli-workflow-browser-automation-d1jXLh/bundle --output json
pw session close wfauto2 --output json
```

最终断言：

```text
create: pass
read-text: pass
locate: pass
fill: pass
click-add: pass
wait-added: pass
verify-added: pass
wait-completed: pass
verify-completed: pass
count: pass
diagnostics-clean: pass
screenshot: 16752 bytes
bundle manifest: present
bundle audit: no_strong_failure_signal
```

## 关键发现

- 标准闭环的关键不是 `click` 成功，而是动作后必须 `wait` + `verify`；本轮用新增 task 和完成状态分别验证。
- `read-text` 足够完成首读；需要可交互结构时再用 `locate` 和 `snapshot -i`。
- `diagnostics digest` 在成功 workflow 下应保持低噪声；本轮最终证据中 console error、page error、failed request、HTTP error 均为 0。
- `diagnostics bundle` 当前会读取 run artifact timeline；为了避免历史失败污染证据，workflow 证据应使用新的 session name 或在报告中明确过滤范围。本轮最终证据使用 `wfauto2`，bundle audit 为干净状态。

## 后续

- `workflow-eval-automated-testing` 需要在这个闭环上加入 route/mock、environment、assertion failure 和 failure report。
- `workflow-eval-form-file-download` 继续覆盖上传、拖拽、下载、截图/PDF 的文件型任务。

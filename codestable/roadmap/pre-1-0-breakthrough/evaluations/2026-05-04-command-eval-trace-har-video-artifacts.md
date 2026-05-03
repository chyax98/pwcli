---
doc_type: evaluation
slug: command-eval-trace-har-video-artifacts
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, artifacts, screenshot, pdf, trace, har, video]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-trace-har-video-artifacts
---

# Command Evaluation: Trace / HAR / Video / Artifacts

## 范围

本轮覆盖视觉、归档和离线证据命令：

- `screenshot`
- `pdf`
- `trace start`
- `trace stop`
- `trace inspect`
- `har start`
- `har stop`
- `video start`
- `video stop`

验证维度：

- page / selector / annotated / ref screenshot 都产出非空文件。
- PDF 产出非空文件。
- trace start/stop 产出 trace artifact，inspect 可查看 actions/console/requests。
- video start/stop 产出 WebM artifact。
- HAR start/stop 不伪装为支持；当前必须返回 `supported=false` 和 limitation。

不扩大范围：

- HAR replay 的 mock 能力归 `command-eval-route-mock-bootstrap` 或 HAR decision 专项。
- 1.0 证据包 manifest 字段冻结归 `evidence-bundle-1-0-contract`。
- HAR 热录制是否实现或移出 1.0 contract，归 `har-trace-1-0-decision` 最终拍板。本轮只证明当前状态。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `screenshot` | proven | page/full-page、selector、annotated、ref screenshot 均写出非空 PNG |
| `pdf` | proven | `pw pdf --path` 写出非空 PDF |
| `trace start` | proven | 返回 `started=true` |
| `trace stop` | proven | 返回 `traceArtifactPath`，trace 文件非空 |
| `trace inspect` | proven | actions、console error、requests failed filter 均可执行 |
| `video start` | proven | 返回 `started=true` |
| `video stop` | proven | 返回 `videoPath`，WebM 文件非空 |
| `har start` | documented limitation | 返回 `supported=false` 和明确 limitation，不是 1.0 proven evidence path |
| `har stop` | documented limitation | 返回 `supported=false` 和明确 limitation，不是 1.0 proven evidence path |

## focused check

本轮使用本地 HTML + API fixture：

```bash
pw session create arqewhcy --headless --open http://127.0.0.1:59202/ --output json
pw video start --session arqewhcy --output json
pw trace start --session arqewhcy --output json
pw code --session arqewhcy '<trigger console error + fetch + click>' --output json
pw screenshot --session arqewhcy --path /tmp/pwcli-artifacts-eval-arqewhcy/page.png --full-page --output json
pw screenshot --session arqewhcy --selector .panel --path /tmp/pwcli-artifacts-eval-arqewhcy/panel.png --output json
pw screenshot --session arqewhcy --path /tmp/pwcli-artifacts-eval-arqewhcy/annotated.png --annotate --output json
pw snapshot -i --session arqewhcy --output json
pw screenshot e4 --session arqewhcy --path /tmp/pwcli-artifacts-eval-arqewhcy/ref.png --output json
pw pdf --session arqewhcy --path /tmp/pwcli-artifacts-eval-arqewhcy/page.pdf --output json
pw har start --session arqewhcy --path /tmp/pwcli-artifacts-eval-arqewhcy/recording.har --output json
pw har stop --session arqewhcy --output json
pw trace stop --session arqewhcy --output json
pw trace inspect .pwcli/playwright/traces/trace-1777851538541.trace --section actions --limit 20 --output json
pw trace inspect .pwcli/playwright/traces/trace-1777851538541.trace --section console --level error --limit 20 --output json
pw trace inspect .pwcli/playwright/traces/trace-1777851538541.trace --section requests --failed --limit 20 --output json
pw video stop --session arqewhcy --output json
pw session close arqewhcy --output json
```

结果：

```text
artifact focused check passed
evidence directory: /tmp/pwcli-artifacts-eval-arqewhcy
tracePath: .pwcli/playwright/traces/trace-1777851538541.trace
videoPath: .pwcli/playwright/video-2026-05-03T23-39-00-696Z.webm
```

关键 envelope：

```json
{
  "screenshot": {
    "captured": true,
    "modes": ["full-page", "selector", "annotate", "ref"]
  },
  "trace": {
    "started": true,
    "stopped": true,
    "inspectSections": ["actions", "console", "requests"]
  },
  "video": {
    "started": true,
    "stopped": true,
    "videoPath": ".pwcli/playwright/video-2026-05-03T23-39-00-696Z.webm"
  },
  "har": {
    "supported": false,
    "status": "documented limitation"
  }
}
```

## 关键发现

- `screenshot --annotate` 返回 `annotations`，同时仍复用 screenshot 的 `captured/path/run` contract。
- `screenshot <ref>` 依赖 fresh snapshot ref；stale ref 恢复已在 page/workspace 评测覆盖。
- `trace stop` 的 `traceArtifactPath` 是后续 `trace inspect` 的唯一输入；`.pwcli/runs` 不是 trace replay 证据。
- `trace inspect --failed` 只对 `--section requests` 生效；其他 section 会返回 limitation。
- `har start|stop` 当前不是稳定录制能力。它明确写入 state.har 并返回 `supported=false`，不能在 skill 或 release note 中写成 1.0 已支持。
- HAR 热录制必须在后续 `har-trace-1-0-decision` 中二选一：实现并验证，或从 1.0 supported contract 明确移除/降级。

## 后续

- `har-trace-1-0-decision` 必须处理 HAR 热录制，不能把 `supported=false` 长期留在 1.0 supported surface。
- `evidence-bundle-1-0-contract` 需要决定 screenshot/pdf/trace/video 在 bundle manifest 中的字段、命名和引用方式。

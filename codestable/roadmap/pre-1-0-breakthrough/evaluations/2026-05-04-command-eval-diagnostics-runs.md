---
doc_type: evaluation
slug: command-eval-diagnostics-runs
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, diagnostics, doctor, errors, runs]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-diagnostics-runs
---

# Command Evaluation: Diagnostics / Runs / Doctor / Errors

## 范围

本轮覆盖诊断和证据检索主链：

- `diagnostics digest`
- `diagnostics export`
- `diagnostics bundle`
- `diagnostics runs`
- `diagnostics show`
- `diagnostics grep`
- `diagnostics timeline`
- `doctor`
- `errors recent`
- `errors clear`

验证维度：

- live session digest 能汇总 pageerror。
- export 能按 section/text 输出文件。
- runs 能按 session 列出 action run。
- digest `--run` 能读取单个 run。
- show/grep `--run` 能定位失败 action evidence。
- timeline 能串起 console、pageerror、action 和 failure。
- bundle 能写 `manifest.json`，包含 audit conclusion、timeline 和 latest run events。
- doctor 能在 Node 24 + pnpm 10+ 基线下给出正确环境判断和 session probe。
- errors recent/clear 能先查 pageerror，再清 baseline。

不扩大范围：

- `console` / `network` 的完整过滤矩阵留到 `command-eval-network-console-errors`。
- trace/HAR/video artifact 证据留到 `command-eval-trace-har-video-artifacts`。
- evidence bundle 1.0 最终 manifest contract 留到 `evidence-bundle-1-0-contract`。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `diagnostics digest` | proven | live session pageerror summary、run digest `source=run` 均通过 |
| `diagnostics export` | proven | `--section errors --text ... --out` 写出 JSON 文件 |
| `diagnostics bundle` | proven | `--out <dir>` 写出 `manifest.json`，包含 `auditConclusion` |
| `diagnostics runs` | proven | `--session <name>` 返回本 session run list |
| `diagnostics show` | proven | `--run <runId> --command click` 返回失败 click event |
| `diagnostics grep` | proven | `--run <runId> --text '#missing'` 命中失败 event |
| `diagnostics timeline` | proven | 同一 timeline 包含 `console:log`、`console:error`、`pageerror`、`action:click`、`failure:ACTION_TARGET_NOT_FOUND` |
| `doctor` | proven | session probe 和 endpoint probe 通过；修复 Node 24 被误判为 fail 的问题 |
| `errors recent` | proven | pageerror text filter 命中 |
| `errors clear` | proven | clear 后相同 text filter matched=0 |

## focused check

本轮使用受控 `about:blank` 页面夹具：

```bash
pw session create dgqee9m8 --headless --open about:blank --output json
pw code --session dgqee9m8 '<inject diagnostics fixture>' --output json
pw click --selector '#ok' --session dgqee9m8 --output json
pw click --selector '#missing' --session dgqee9m8 --output json
pw errors recent --session dgqee9m8 --text diagnostics-dogfood-pageerror --limit 5 --output json
pw diagnostics export --session dgqee9m8 --section errors --text diagnostics-dogfood-pageerror --out /tmp/pwcli-diagnostics-eval-dgqee9m8/errors-export.json --output json
pw diagnostics digest --session dgqee9m8 --limit 10 --output json
pw diagnostics runs --session dgqee9m8 --limit 5 --output json
pw diagnostics digest --run 2026-05-03T23-25-09-877Z-dgqee9m8 --limit 10 --output json
pw diagnostics show --run 2026-05-03T23-25-09-877Z-dgqee9m8 --command click --limit 10 --output json
pw diagnostics grep --run 2026-05-03T23-25-09-877Z-dgqee9m8 --text '#missing' --limit 10 --output json
pw diagnostics timeline --session dgqee9m8 --limit 20 --output json
pw diagnostics bundle --session dgqee9m8 --out /tmp/pwcli-diagnostics-eval-dgqee9m8/bundle --limit 10 --output json
pw doctor --session dgqee9m8 --endpoint https://example.com --output json
pw errors clear --session dgqee9m8 --output json
pw errors recent --session dgqee9m8 --text diagnostics-dogfood-pageerror --output json
pw session close dgqee9m8 --output json
```

结果：

```text
diagnostics focused check passed
evidence directory: /tmp/pwcli-diagnostics-eval-dgqee9m8
runId: 2026-05-03T23-25-09-877Z-dgqee9m8
```

关键 envelope：

```json
{
  "failure": {
    "command": "click",
    "code": "ACTION_TARGET_NOT_FOUND",
    "selector": "#missing"
  },
  "timelineKinds": [
    "console:log",
    "pageerror",
    "console:error",
    "action:click",
    "failure:ACTION_TARGET_NOT_FOUND"
  ],
  "bundle": {
    "manifest": "/tmp/pwcli-diagnostics-eval-dgqee9m8/bundle/manifest.json"
  }
}
```

## 修复记录

本轮评测发现两个问题：

1. `doctor` 把当前 Node `v24.12.0` 误判为 fail，且 still 使用旧 `>=18.15.0` 基线。根因是手写版本比较在 major 已经大于 minimum 后仍继续比较 minor，导致 `24.12` 被 `18.15` 的 minor 拉成 fail。
2. `diagnostics show|grep --run <runId>` 已在 skill、E2E、smoke 和 audit nextSteps 中作为正式写法使用，但 CLI help 没声明 `--run`。

已修复：

- `inspectEnvironment` 改为项目真实基线 `>=24.12.0 <26`，并使用明确三段 semver 比较。
- `doctor-health-checks` 和 `fixture-app` 测试同步 Node 24.12 baseline。
- `diagnostics show|grep` 正式声明 `--run <id>`，实现仍走唯一 `readDiagnosticsRunView`。
- `command-help` 增加 `diagnostics show|grep --run` help 回归，并移除 `get --return-ref` 旧漂移断言；`get` 不支持也不应支持 `--return-ref`，ref opt-in 属于 `locate`。

## 关键发现

- `diagnostics show|grep` 的命令名输出都是 `diagnostics show`，但 grep 的 envelope 通过 `text` 字段体现搜索语义；这是当前 shipped contract。
- action failure run event 会带 `diagnosticsDelta.lastConsole` / `lastPageError`，Agent 可以不用先读全量 export 就定位近期信号。
- `doctor` 是健康检查，不负责修复版本管理器差异；但它必须准确反映项目基线，不能把 Node 24 报成 fail。
- `errors clear` 是 baseline clear，不删除历史，只让后续 `recent` 不再返回旧错误。

## 后续

- `console` / `network` / `sse` 的过滤和 projection 进入下一轮 `command-eval-network-console-errors`。
- `diagnostics bundle` 目前 proven 为可交接 evidence bundle，1.0 manifest 字段冻结仍归 `evidence-bundle-1-0-contract`。
- `doctor` 的 modal-state recovery 已有专项 check；复杂 blocked state 继续归 recovery breakthrough。

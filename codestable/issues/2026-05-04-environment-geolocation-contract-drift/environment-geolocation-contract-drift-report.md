---
doc_type: issue-report
issue: 2026-05-04-environment-geolocation-contract-drift
status: confirmed
severity: P1
summary: "environment geolocation set 的 skill/help/参数 contract 漂移，Agent 按 skill 执行 --lat/--lng 会失败。"
tags:
  - environment
  - command-contract
  - skill-drift
  - agent-dogfood
---

# environment geolocation set 参数 Contract 漂移 Issue Report

## 1. 问题现象

Agent 按 `skills/pwcli/` 执行 geolocation 示例：

```bash
pw environment geolocation set -s agdog1 --lat 37.7749 --lng -122.4194
```

命令失败：

```text
ERROR ENVIRONMENT_GEOLOCATION_SET_FAILED
Error: browserContext.setGeolocation: geolocation.longitude: expected float, got undefined
Details:
{}
```

同时 `pw environment geolocation set --help` 只展示 `--accuracy`，没有展示 `--lat` / `--lng`，也没有提示 latitude / longitude positional 参数。

## 2. 复现步骤

1. 构建项目：`pnpm build`。
2. 启动任意可用 session，例如：`pw session create agdog1 --no-headed --open http://127.0.0.1:43280/login`。
3. 执行：`pw environment permissions grant geolocation -s agdog1`。
4. 执行：`pw environment geolocation set -s agdog1 --lat 37.7749 --lng -122.4194`。
5. 观察到：命令失败并报告 longitude 为 `undefined`。

复现频率：稳定复现。

补充观察：

- `pw environment geolocation set -s agdog1 37.7749 -122.4194` 也失败。
- `pw environment geolocation set -s agdog1 37.7749 -- -122.4194` 成功。

## 3. 期望 vs 实际

**期望行为**：Agent 按 skill 示例执行 geolocation 设置，应能成功设置经纬度；或者 help/skill 明确教 Agent 使用当前实际支持的参数形式。

**实际行为**：skill 示例和 CLI help 无法教会 Agent 正确传参；按 skill 的 `--lat/--lng` 写法稳定失败，负数 longitude 的 positional 写法还需要额外 `--` 分隔。

## 4. 环境信息

- 涉及模块 / 功能：`pw environment geolocation set`
- 相关文件 / 函数：
  - `src/cli/commands/environment.ts`
  - `src/engine/environment.ts`
  - `skills/pwcli/SKILL.md`
  - `skills/pwcli/references/command-reference-advanced.md`
  - `codestable/architecture/commands/tools.md`
- 运行环境：local dogfood
- Node：`v24.12.0`
- pnpm：`10.33.0`
- session：`agdog1`

## 5. 严重程度

**P1** — 这是 Agent 可用性和 command contract 漂移问题。存在 `37.7749 -- -122.4194` workaround，但当前中文 skill 示例会把 Agent 带到稳定失败路径，且 help 不提示正确参数形态。

## 备注

本问题由 Agent dogfood 浏览器自动化/诊断场景发现；稳定结论已进入 fix-note、command docs 和 Pre-1.0 workflow evaluations。

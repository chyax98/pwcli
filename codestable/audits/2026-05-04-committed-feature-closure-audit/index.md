---
doc_type: audit-index
audit: 2026-05-04-committed-feature-closure-audit
scope: committed feature closure for shipped pwcli product surface
created: 2026-05-04
status: active
total_findings: 1
---

# committed feature closure 审计报告

## 范围

本次审计只判断“已经写成当前支持能力的 feature 是否还有未完成缺口”，不把 future design、后续扩展口或用户未确认的新能力纳入范围。

扫描范围：

- `README.md`
- `package.json`
- `skills/pwcli/`
- `codestable/architecture/domain-status.md`
- `codestable/architecture/command-surface.md`
- `codestable/architecture/commands/`
- `codestable/architecture/release-v0.2.0.md`
- `codestable/roadmap/project-completion/`
- `src/cli/commands/`
- `src/cli/batch/`

## 总评

当前未发现新的 committed feature implementation gap。

已承诺产品面可以归并为：

- named session lifecycle：`session create|attach|recreate|list|status|close`
- 页面观察与证据：`status/observe`、`page`、`tab`、`read-text/text`、`snapshot`、`screenshot`、`pdf`、`accessibility`
- 页面动作与验证闭环：`click/fill/type/press/hover/scroll/check/uncheck/select/drag/upload/download/resize/mouse/dialog` + `wait/verify/get/is/locate`
- 诊断与可追溯：`diagnostics`、`console`、`network`、`errors`、`trace`、`video`、`sse`
- 受控测试：`route`、`bootstrap`、`environment`
- 登录态与状态：`profile`、`auth`、`state`、`cookies`、`storage`
- 自动化工具层：`batch`、`code`、`skill`

这些能力已在 command docs 中映射到源码、设计边界和证据状态；Agent dogfood 覆盖了项目 completion roadmap 要求的浏览器自动化、自动化测试、表单验证、简单爬取、Deep Bug 诊断和证据交接场景。

## 发现清单

| # | 性质 | 严重度 | 置信度 | 标题 | 状态 |
|---|---|---|---|---|---|
| F-001 | doc-drift | P1 | high | release contract 仍引用 v0.1.0，但 package 已是 v0.2.0 | 已修复 |

## F-001：release contract 版本漂移

### 现象

`package.json` 当前版本是 `0.2.0`，但发布契约和入口文档仍引用 `release-v0.1.0.md`、`v0.1.0` 和 `version: 0.1.0`。

### 影响

这是 shipped truth 漂移。它不会改变 CLI 行为，但会让 release gate、安装验证和最终验收报告引用旧发布目标。

### 修复

已将发布契约移动为：

```text
codestable/architecture/release-v0.2.0.md
```

并同步引用：

- `README.md`
- `codestable/architecture/ARCHITECTURE.md`
- `codestable/roadmap/project-completion/project-completion-roadmap.md`
- `.claude/commands/ship-check.md`

## 边界说明

以下不是 committed feature gap：

- `auth dc`：已作为内置 provider 文档化，但真实 DC/Forge 登录依赖外部业务账号和环境；不使用 fixture 伪造成 proven。
- `har start|stop`：当前返回 `supported=false` 和明确 limitation；HAR 热录制不写成稳定 contract。
- `route load`：不是顶层 `pw route` 子命令；它只存在于 batch 内部 `["route","load",file]` 子集，归 batch contract 管理。
- `batch`：只承诺单 session 稳定 `string[][]` 子集，不追求全命令 parity。
- `.claude/`：只承载 Claude Code 项目规则和本地 slash command，不承载产品规划或 active truth。

## 审计证据

```bash
rg -n "0\\.1\\.0|v0\\.1\\.0|release-v0\\.1\\.0" README.md codestable .claude skills package.json
node dist/cli.js route --help
node dist/cli.js batch --help
rg -n "route.*load|SUPPORTED_BATCH|route" src/cli src/engine skills/pwcli/references/command-reference-advanced.md codestable/architecture/commands/tools.md
rg -n "proven|documented|状态分布" codestable/architecture/commands/*.md
```

## 结论

`committed-feature-closure` 可以关闭。后续如果 release gate 暴露新的 P0/P1，应新建 issue 进入 Bug Closure，而不是把 future design 临时升级成当前 feature 缺口。

# Project Truth

更新时间：2026-04-26  
状态：active

这份文件只做内部索引，不再重复命令教程。

## 真相优先级

1. **源码**
   - `src/app/commands/*`
   - `src/domain/*`
   - `src/infra/*`
2. **Agent 使用教程**
   - [skills/pwcli/SKILL.md](/Users/xd/work/tools/pwcli/skills/pwcli/SKILL.md)
   - [skills/pwcli/references/command-reference.md](/Users/xd/work/tools/pwcli/skills/pwcli/references/command-reference.md)
   - [skills/pwcli/references/workflows.md](/Users/xd/work/tools/pwcli/skills/pwcli/references/workflows.md)
   - [skills/pwcli/references/failure-recovery.md](/Users/xd/work/tools/pwcli/skills/pwcli/references/failure-recovery.md)
3. **架构与决策**
   - [docs/architecture/README.md](/Users/xd/work/tools/pwcli/docs/architecture/README.md)
   - [docs/architecture/domain-status.md](/Users/xd/work/tools/pwcli/docs/architecture/domain-status.md)
   - [docs/architecture/adr-001-agent-first-command-and-lifecycle.md](/Users/xd/work/tools/pwcli/docs/architecture/adr-001-agent-first-command-and-lifecycle.md)
   - [docs/architecture/adr-002-diagnostics-mock-environment.md](/Users/xd/work/tools/pwcli/docs/architecture/adr-002-diagnostics-mock-environment.md)
4. **历史草案**
   - `.claude/archive/`

## 当前产品口径

- `pwcli` 是内部 Agent-first 浏览器工具
- `session create|attach|recreate` 是唯一 lifecycle 主路
- `open` 只做导航
- `auth` 只做 plugin 执行
- `batch` 只走结构化 `string[][]`
- skill 是唯一使用教程真相
- `docs/architecture` 只维护架构、领域现状、限制和扩展方向

## 当前需要牢记的限制

- `page dialogs` 只是事件投影
- `MODAL_STATE_BLOCKED` 会让 run-code-backed 读取和部分动作失效
- `session attach --browser-url/--cdp` 依赖本地 attach bridge registry
- `environment clock set` 当前是 limitation
- `har start|stop` 没有稳定热录制 contract

## 维护要求

- 改命令、flag、错误码、输出：同步 skill
- 改架构边界、限制、领域扩展：同步 `docs/architecture`
- 历史 planning / survey / 迁移稿不再写回 active truth

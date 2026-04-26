# pwcli

`pwcli` 是一个面向内部 Agent 的 Playwright orchestration CLI，默认命令名是 `pw`。

它服务的场景只有两类：

1. 执行浏览器任务
2. 复现、定位、诊断浏览器问题

当前仓库把真相拆成两条：

- **怎么用**：看 [skills/pwcli/SKILL.md](/Users/xd/work/tools/pwcli/skills/pwcli/SKILL.md)
- **为什么这样设计**：看 [docs/architecture/README.md](/Users/xd/work/tools/pwcli/docs/architecture/README.md)

## 当前产品规则

- agent-first
- strict session-first
- 稳定 JSON 输出
- `session create|attach|recreate` 是唯一 lifecycle 主路
- `open` 只做导航
- `auth` 只做 plugin 执行
- `batch` 走结构化 `string[][]`
- diagnostics 优先 query/export
- trace 默认开启

## 稳定主链

```bash
pw session create bug-a --open 'https://example.com'
pw snapshot --session bug-a
pw click e6 --session bug-a
pw wait networkIdle --session bug-a
pw diagnostics export --session bug-a --out ./diag.json
```

接管已有浏览器：

```bash
pw session attach bug-a --ws-endpoint ws://127.0.0.1:9222/devtools/browser/...
```

确定性 mock：

```bash
pw route load ./scripts/manual/mock-routes.json --session bug-a
pw route list --session bug-a
```

环境控制：

```bash
pw environment offline on --session bug-a
pw environment geolocation set --session bug-a --lat 37.7749 --lng -122.4194
```

## 仓库结构

```text
src/
  app/
  domain/
  infra/
skills/
  pwcli/
docs/
  architecture/
```

职责：

- `src/app`：CLI、batch、输出
- `src/domain`：命令语义与领域编排
- `src/infra`：Playwright substrate、fs、plugin 适配
- `skills/pwcli`：模型使用教程的唯一真相
- `docs/architecture`：架构决策、领域现状、已知限制、扩展方向

## 验证

开发期优先：

```bash
pnpm typecheck
pnpm build
pnpm smoke
```

## 已知限制

- `page dialogs` 是事件投影，不是 authoritative live dialog set
- `MODAL_STATE_BLOCKED` 会阻断 run-code-backed 读取和部分动作
- `session attach --browser-url/--cdp` 依赖本地 attach bridge registry
- `environment clock set` 当前是 limitation
- `har start|stop` 当前只暴露 substrate 边界，没有稳定热录制 contract

## 入口

- 使用教程：[skills/pwcli/SKILL.md](/Users/xd/work/tools/pwcli/skills/pwcli/SKILL.md)
- 命令参考：[skills/pwcli/references/command-reference.md](/Users/xd/work/tools/pwcli/skills/pwcli/references/command-reference.md)
- 工作流：[skills/pwcli/references/workflows.md](/Users/xd/work/tools/pwcli/skills/pwcli/references/workflows.md)
- 恢复策略：[skills/pwcli/references/failure-recovery.md](/Users/xd/work/tools/pwcli/skills/pwcli/references/failure-recovery.md)
- 架构总览：[docs/architecture/README.md](/Users/xd/work/tools/pwcli/docs/architecture/README.md)

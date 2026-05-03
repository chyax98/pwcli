# pwcli

`pwcli` 是内部 Agent-first Playwright CLI，默认命令名是 `pw`。

它不是 Playwright 教程，也不是测试框架外壳。它的目标是把浏览器任务变成 Agent 能稳定消费的命令链：创建 session、观察页面、执行动作、等待状态、收集诊断、恢复失败。

## 最短使用链路

```bash
pw session create bug-a --headed --open 'https://example.com'
pw observe status -s bug-a
pw read-text -s bug-a --max-chars 2000
pw snapshot -i -s bug-a
pw click e6 -s bug-a
pw wait network-idle -s bug-a
pw verify text -s bug-a --text 'Saved'
pw diagnostics digest -s bug-a
```

继续已有任务时先看 session：

```bash
pw session list --with-page
pw session status bug-a
```

复用本机 Chrome 登录态：

```bash
pw profile list-chrome
pw session create dc-main --from-system-chrome --chrome-profile Default --headed --open 'https://example.com'
```

运行内置 auth provider：

```bash
pw session create dc-main --headed --open 'about:blank'
pw auth dc -s dc-main --arg targetUrl='https://developer.example.com/forge'
```

## 产品边界

- `session create|attach|recreate` 是唯一 lifecycle 主路。
- `open` 只在已有 session 内导航。
- `auth` 只执行内置 auth provider；没有外部 plugin 加载机制。
- `batch` 只接收结构化 `string[][]`，只承诺稳定子集。
- `locate|get|is|verify` 是 read-only 状态检查，不做 action planner。
- diagnostics 优先 query/export/bundle，不额外维护第二套事件系统。
- trace 默认开启；`.pwcli/runs/` 是轻量动作事件，trace zip 是 Playwright replay 证据。

## 文档入口

| 读者 | 入口 | 作用 |
|---|---|---|
| Agent / 使用者 | [skills/pwcli/SKILL.md](skills/pwcli/SKILL.md) | 唯一使用教程真相 |
| 参数核对 | [skills/pwcli/references/command-reference.md](skills/pwcli/references/command-reference.md) | 核心命令 reference |
| 诊断链路 | [skills/pwcli/references/command-reference-diagnostics.md](skills/pwcli/references/command-reference-diagnostics.md) | diagnostics / route / trace |
| 状态与自动化 | [skills/pwcli/references/command-reference-advanced.md](skills/pwcli/references/command-reference-advanced.md) | auth / state / batch / environment |
| 维护者 | [codestable/architecture/ARCHITECTURE.md](codestable/architecture/ARCHITECTURE.md) | 架构和维护文档入口 |
| 命令面审计 | [codestable/architecture/command-surface.md](codestable/architecture/command-surface.md) | 从源码和 CLI help 对齐的命令能力地图 |
| 命令设计覆盖 | [codestable/architecture/commands/coverage.md](codestable/architecture/commands/coverage.md) | 顶层 command 到命令族 ADR 的覆盖矩阵 |
| 发布准备 | [codestable/architecture/release-v0.1.0.md](codestable/architecture/release-v0.1.0.md) | v0.1.0 发布前检查清单 |
| Claude Code 协作 | [.claude/CLAUDE.md](.claude/CLAUDE.md) | 项目级规则入口 |

## 仓库结构

```text
src/
  cli/        # citty 命令、batch、输出 envelope
  engine/     # Playwright substrate 和浏览器能力封装
  store/      # artifacts、skill path、持久化辅助
  auth/       # 内置 auth provider
skills/
  pwcli/      # Agent 使用教程的唯一真相
codestable/
  architecture/ # 架构事实、限制、扩展口、发布检查、命令 ADR
  roadmap/      # 大型目标拆解与状态
  compound/     # decision / learning / trick / explore
.claude/      # Claude Code 项目指令和 rules
```

## 本地开发

```bash
pnpm install
pnpm build
node dist/cli.js --help
```

开发期优先跑受影响验证：

```bash
pnpm typecheck
pnpm build
pw --help
```

发布前再跑完整 gate，见 [release-v0.1.0.md](codestable/architecture/release-v0.1.0.md)。

## 已知限制

- `page dialogs` 是事件投影，不是 authoritative live dialog set。
- `MODAL_STATE_BLOCKED` 会阻断 run-code-backed 读取和部分动作。
- `observe status` 和 `doctor` 默认 compact，`--verbose` 才展开完整细节。
- `session attach --browser-url/--cdp` 只能接管本机可连接的调试端口。
- `har start|stop` 当前只暴露 substrate 边界，没有稳定热录制 contract。

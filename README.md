# pwcli

`pwcli` 是 Agent-first Playwright CLI，默认命令名是 `pw`。

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
| 参数核对 | `pw --help` / `pw <command> --help` | 当前版本命令细节 |
| 工作流 | [skills/pwcli/references/workflows.md](skills/pwcli/references/workflows.md) | 跨命令任务链路 |
| 恢复与交接 | [skills/pwcli/references/failure-recovery.md](skills/pwcli/references/failure-recovery.md) | 失败恢复和 evidence bundle |
| Forge/DC | [skills/pwcli/references/forge-dc-auth.md](skills/pwcli/references/forge-dc-auth.md) | DC provider 使用规则 |
| 维护者 | [codestable/architecture/ARCHITECTURE.md](codestable/architecture/ARCHITECTURE.md) | 架构和维护文档入口 |
| 命令面审计 | [codestable/architecture/command-surface.md](codestable/architecture/command-surface.md) | 从源码和 CLI help 对齐的命令能力地图 |
| 命令设计覆盖 | [codestable/architecture/commands/coverage.md](codestable/architecture/commands/coverage.md) | 顶层 command 到命令族 ADR 的覆盖矩阵 |
| 发布准备 | [codestable/architecture/release-v1.0.0.md](codestable/architecture/release-v1.0.0.md) | v1.0.0 发布前检查清单 |
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
  compound/     # decision / learning / trick / explore
test/
  unit/          # 轻量 contract / 纯函数测试
  integration/   # 真实 CLI 集成测试
  contract/      # 命令和 skill 的专项契约验证
  smoke/         # 发布前本地主链回归
  e2e/           # Agent dogfood 辅助脚本
  fixtures/      # 本地测试夹具
  app/           # 测试应用
  benchmark/     # deterministic stability harness
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
pnpm check
pw --help
```

发布前再跑完整 gate，见 [release-v1.0.0.md](codestable/architecture/release-v1.0.0.md)。

当前版本发布方式是 GitHub tag 安装：

```bash
npm install -g github:chyax98/pwcli#v1.0.0
```

## 已知限制

- `page dialogs` 是事件投影，不是 authoritative live dialog set。
- `MODAL_STATE_BLOCKED` 会阻断 run-code-backed 读取和部分动作。
- `observe status` 和 `doctor` 默认 compact，`--verbose` 才展开完整细节。
- `session attach --browser-url/--cdp` 只能接管本机可连接的调试端口。
- `har start|stop` 当前只暴露 substrate 边界，没有稳定热录制 contract。

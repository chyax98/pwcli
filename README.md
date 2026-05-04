# pwcli

`pwcli` 是 Agent-first Playwright CLI，默认命令名是 `pw`。

它不是 Playwright 教程，也不是测试框架外壳。它的目标是把浏览器任务变成 Agent 能稳定消费的命令链：创建 session、观察页面、执行动作、等待状态、收集诊断、恢复失败。

## 安装

当前正式版本通过 GitHub tag 安装：

```bash
npm install -g github:chyax98/pwcli#v1.0.0
```

本地开发：

```bash
pnpm install
pnpm build
node dist/cli.js --help
```

## 最短链路

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

## 读者入口

| 读者 | 入口 | 作用 |
|---|---|---|
| 使用工具的 Agent | `skills/pwcli/SKILL.md` | 唯一使用 SOP |
| 维护仓库的 Code Agent | `AGENTS.md` / `CLAUDE.md` | 代码、测试、文档、发版规则 |
| Claude Code | `.claude/rules/` | 本地细分护栏 |
| 命令参数核对 | `pw --help` / `pw <command> --help` | 当前版本命令细节 |

## 仓库结构

```text
src/
  cli/        # 命令解析、batch、输出 envelope
  engine/     # Playwright substrate 和浏览器能力封装
  store/      # artifacts、skill path、持久化辅助
  auth/       # 内置 auth provider
skills/
  pwcli/      # Agent 使用教程
test/
  unit/
  integration/
  contract/
  smoke/
  e2e/
  fixtures/
.claude/
  rules/      # Claude Code 本地细分规则
```

## 测试

```bash
pnpm test:unit
pnpm test:integration
pnpm test:contract
pnpm smoke
pnpm check
```

日常开发优先跑受影响的最小验证。发布或总验收再跑完整 gate。

## 产品边界

- `session create|attach|recreate` 是唯一 lifecycle 主路。
- `open` 只在已有 session 内导航。
- `auth` 只执行内置 auth provider；没有外部 plugin 加载机制。
- `batch` 只接收结构化 `string[][]`，只承诺稳定子集。
- `locate|get|is|verify` 是 read-only 状态检查，不做 action planner。
- trace 默认开启；`.pwcli/runs/` 是轻量动作事件，trace zip 是 Playwright replay 证据。

## 已知限制

- `page dialogs` 是事件投影，不是 authoritative live dialog set。
- `MODAL_STATE_BLOCKED` 会阻断 run-code-backed 读取和部分动作。
- `observe status` 和 `doctor` 默认 compact，`--verbose` 才展开完整细节。
- `session attach --browser-url/--cdp` 只能接管本机可连接的调试端口。
- `har start|stop` 当前只暴露 substrate 边界，没有稳定热录制 contract。

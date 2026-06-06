# pwcli

`pwcli` 是 Agent-first Playwright CLI，默认命令名是 `pw`。

它不是 Playwright 教程，也不是测试框架外壳。它的目标是把浏览器任务变成 Agent 能稳定消费的命令链：创建 session、观察页面、执行动作、等待状态、收集诊断、恢复失败。

## 与官方 playwright-cli 的关系

`pwcli` 和 `microsoft/playwright-cli` 同样建立在 `playwright-core` 之上；当前 `pwcli` 还直接复用了 Playwright 官方 `lib/tools/cli-client/*` 的 session、registry 和 socket substrate。

因此，`pwcli` 的定位不是另起炉灶替代官方 CLI，而是：

> 官方 Playwright agent CLI substrate + 面向本项目 Agent 工作流的增强层。

官方 `playwright-cli` 更新更快，适合承载基础浏览器 primitive，例如 click/fill/snapshot/drop/video/highlight/generate-locator/dashboard show 等。`pwcli` 的价值主要体现在增强层：

- 结构化 JSON envelope 和更稳定的命令输出。
- ref epoch、防 stale ref、snapshot diff。
- diagnostics digest/bundle、console/network/error 信号汇总。
- action evidence、失败截图和恢复建议。
- batch、auth provider、profile/state 复用。
- `takeover/release-control` 人机控制边界。
- `find-best/act`、`analyze-form/fill-form`、`check-injection` 等 Agent shortcut。

维护原则：跟 Playwright 版本能力走，按 Agent 工作流价值取舍；上游 substrate 是复用手段，不是产品边界。上游已有且稳定的 primitive 优先对齐或薄包装；但能减少重跑、增强复现证据、降低诊断成本的能力，即使需要直接接 Playwright API，也应评估进入 `pwcli` 增强层。

当前 Playwright 1.60 适配点：
- `pw snapshot --boxes` 透传官方 snapshot bounding boxes，并保留 ref epoch。
- `pw drop` 基于 `locator.drop()` 投放文件或 MIME data。
- `--role ... --description ...` 透传 `getByRole({ description })`。
- diagnostics 捕获 context-level `weberror`，并保留 location/stack。
- `pw dashboard open` 委托官方 `playwright-cli show`，并注入 pwcli registry 环境。

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
pw status -s bug-a
pw read-text -s bug-a --max-chars 2000
pw snapshot -i -s bug-a
pw find-best -s bug-a submit_form
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

本机 Chrome profile 辅助迁移入口：

```bash
pw profile list-chrome
pw session create dc-main --from-system-chrome --chrome-profile Default --headed --open 'https://example.com'
pw profile save-state main-auth -s dc-main
pw profile load-state main-auth -s reuse-a
PWCLI_VAULT_KEY=local-secret pw profile save-auth main-login --url 'http://localhost:7778/login' --file ./values.json
PWCLI_VAULT_KEY=local-secret pw profile login-auth main-login -s reuse-a
```

说明：`--from-system-chrome` 只尝试用本机 Chrome profile 启动辅助迁移流程，不承诺稳定复用系统 Chrome 已登录态。登录态复用主路是先在 pwcli session 中验证登录，再用 `profile save-state/load-state` 或加密 auth profile 复用。

运行内置 auth provider：

```bash
pw session create dc-main --headed --open 'about:blank'
pw auth dc -s dc-main --arg targetUrl='https://developer.example.com/<target-path>'
```

表单分析、批量填充和结构化抽取：

```bash
pw analyze-form -s auth-a
pw fill-form -s auth-a '{"Username":"demo","Password":"demo123"}'
pw extract -s auth-a '{"fields":[{"key":"title","selector":"h1"}]}'
pw check-injection -s auth-a --include-hidden
```

读取当前安装版本的 skill 和命令发现：

```bash
pw skill refs
pw skill show
pw skill show --full
pw commands list
pw commands search electron
pw commands help snapshot
```

本地预览当前 session：

```bash
pw stream start -s bug-a
pw stream status -s bug-a
pw view open -s bug-a
pw view close -s bug-a
pw control-state -s bug-a
pw takeover -s bug-a --actor tester --reason 'manual inspection'
pw release-control -s bug-a
```

`takeover` 不再只是标记状态。当前版本会阻止常见写操作继续执行，包括导航、元素交互、坐标鼠标、resize、route/mock、bootstrap、`code`、auth helper、cookie/storage/state 写入，直到显式 `release-control`。

## 读者入口

| 读者 | 入口 | 作用 |
|---|---|---|
| 使用工具的 Agent | `skills/pwcli/SKILL.md` | 唯一使用 SOP |
| 维护仓库的 Code Agent | `AGENTS.md` / `CLAUDE.md` | 代码、测试、文档、发版规则 |
| Claude Code | `.claude/rules/` | 本地细分护栏 |
| 当前版本 skill 导出 | `pw skill show` / `pw skill show --full` | 从 CLI 读取当前安装版本 skill |
| 命令发现 | `pw commands list` / `pw commands search <topic>` | Agent-facing 路由元数据 |
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
    code/
    data/
    servers/
    targets/
.claude/
  rules/      # Claude Code 本地细分规则
```

## 测试

```bash
pnpm test:unit
pnpm test:integration:core
pnpm test:integration
pnpm test:contract
pnpm test:contract:all
pnpm smoke
pnpm test:e2e
pnpm test:e2e:agent
pnpm check
```

日常开发优先跑受影响的最小验证。发布或总验收再跑完整 gate。

`test:e2e` 跑系统级 dogfood。`test:e2e:agent` 预留给真实 Agent 任务评测，要求外部 runner 写出结构化 summary。

## 产品边界

- `session create|attach|recreate` 是唯一 lifecycle 主路。
- `open` 只在已有 session 内导航。
- `auth` 只执行内置 auth provider；没有外部 plugin 加载机制。
- `batch` 只接收结构化 `string[][]`，只承诺稳定子集。
- `locate|get|is|verify` 是 read-only 状态检查，不做 action planner。
- trace 默认开启；`.pwcli/runs/` 是轻量动作事件，trace zip 是 Playwright replay 证据。
- HAR 默认随 `session create|recreate` 开启全量录制（`full + embed`），写入 `.pwcli/har/<session>/session-*.har`；需要共享或缩小证据时用 `pw har filter` / `pw har clean` 派生文件；确实不需要时显式 `--no-record-har`。
- 视频录制挂在 `session create|recreate --record-video <dir>` 生命周期上；session 关闭后写出文件。

## 已知限制

- `page dialogs` 是事件投影，不是 authoritative live dialog set。
- `MODAL_STATE_BLOCKED` 会阻断需要页面执行上下文的读取和部分动作。
- `observe status` 和 `doctor` 默认 compact，`--verbose` 才展开完整细节。
- `session attach --browser-url/--cdp` 接管本机可连接的 Chromium CDP 调试端口，`--cdp` 也接受 CDP websocket；positional `http://...` 和 `/devtools/` websocket 会自动按 CDP 连接；`--ws-endpoint` 接 Playwright browser server endpoint。

# pwcli Agent Rules

`pwcli` 是 Agent-first Playwright CLI。它把浏览器任务拆成 Agent 可稳定消费的命令链：创建 session、观察事实、执行动作、等待变化、验证结果、收集证据、恢复失败。

## 读者分工

- 维护仓库的 Code Agent：读本文件和 `.claude/rules/`，负责改代码、改测试、改发布规则、保持仓库干净。
- 使用工具的 Agent：读 `skills/pwcli/`，负责用 `pw` 完成浏览器任务。
- 人类维护者：读 `README.md`，了解项目用途、安装方式和本地开发入口。

不要把三类读者混在一个文档里。仓库维护规则不写进 `skills/pwcli/`；工具使用教程不写进 `.claude/`；README 不承载完整 SOP。

## 真相分工

- 源码真相：`src/cli`、`src/engine`、`src/store`、`src/auth`
- 使用真相：`skills/pwcli/`
- 维护真相：`AGENTS.md`、`.claude/rules/`；`CLAUDE.md` 只保留 `@AGENTS.md` 引用
- 命令参数真相：`pw --help` 和 `pw <command> --help`

## 工作顺序

1. 先看 `git status --short`，不要覆盖无关改动。
2. 改代码前确认影响面：source、skill、README、rules、test、release。
3. 命令、flag、输出、错误码、恢复路径变化时，同步 `skills/pwcli/`。
4. 仓库维护、测试、发布、review 规则变化时，同步 `AGENTS.md` 或 `.claude/rules/`；不要在 `CLAUDE.md` 写重复正文。
5. 做能覆盖风险的最小验证。文档清理不默认跑全量测试。

## 代码边界

```text
src/cli/     命令解析、参数定义、输出格式化
src/engine/  Playwright runtime、session、workspace、actions、diagnostics
src/store/   文件系统 I/O、artifacts、health、skill path
src/auth/    内置 auth provider registry 和实现
```

- `engine/` 不能 import `cli/`。
- `store/` 不能 import `engine/` 或 `cli/`。
- `auth/` 不能 import `cli/`。
- 跨层 import 使用 `#engine/*`、`#cli/*`、`#store/*`、`#auth/*`。
- 不建空 re-export 层。
- 不只按行数拆文件。
- 不为了统一性重写 Playwright 已覆盖的 primitive。

## 上游架构与复利工程

`pwcli` 不是从零实现的 Playwright 替代 CLI。它建立在 Playwright 官方 agent CLI substrate 之上，并在其上做 Agent 工程化增强。

```text
playwright-core
├── Browser / Context / Page / Locator / Tracing 等公开 API
├── lib/tools/cli-client/*           # 官方 playwright-cli 使用的 agent CLI substrate
│   ├── Session
│   ├── Registry
│   └── SocketConnection
├── lib/serverRegistry.js            # bound browser / dashboard / attach 相关 registry
└── microsoft/playwright-cli / pwcli  # 都消费这套底座
```

当前实现已经直接复用这些内部模块：

```ts
lib/tools/cli-client/session.js
lib/tools/cli-client/registry.js
lib/tools/utils/socketConnection.js
lib/serverRegistry.js
```

因此，`microsoft/playwright-cli` 不是竞品，而是同源上游能力参考。维护策略是：**上游 primitive 优先复用或对齐，`pwcli` 专注增强层**。

| 层级 | 上游 `playwright-cli` | `pwcli` 价值 |
|------|-----------------------|--------------|
| 浏览器 primitive | 官方主线，更新最快 | 薄封装、命令别名、兼容本项目输出约定 |
| session / registry | 官方 substrate | `.pwcli/` 运行态、锁、session shape、工作区约束 |
| snapshot / ref | 官方 ref 能力 | ref epoch、防 stale ref、diff、compact/interactive 投影 |
| network / console / trace | 官方基础能力 | digest、bundle、signal scoring、失败恢复建议 |
| 人类观察 | 官方 `show` dashboard | `view/stream/takeover` 与 CLI control policy 结合 |
| Agent 产品层 | skills + 简洁 CLI | JSON envelope、batch、auth/profile、action evidence、policy、semantic shortcut |

复利原则：

- **跟 Playwright 版本能力走，不是跟上游 CLI 表面走**。上游 `playwright-cli` 是可复用 substrate 和参考实现，但是否接入由 Agent 工作流价值决定：能减少重跑、保留证据、降低诊断成本的能力，即使上游 CLI 暂未暴露，也应评估接入。
- **不无差别重写 primitive**。上游已有且足够稳定、能满足 pwcli 价值目标的能力，优先薄包装、转发或参数适配；但“上游未暴露”不能作为不做的理由。
- **增强层必须有明确差异**。只有在结构化输出、恢复建议、证据、批处理、auth/profile、人机控制、业务策略等方面有增益时，才保留自有实现。
- **复现优先完整采集，再派生命令过滤/清洗**。task/session 级证据默认应尽量完整，例如 HAR 默认 `full + embed`；不要为了默认低噪音提前丢失复现证据，避免 Agent 因证据不全反复重跑。
- **上游变强时要收敛**。Playwright 新版本新增 `drop`、`snapshot --boxes`、`video-*`、`generate-locator`、`highlight` 等能力时，优先评估对齐官方，而不是继续扩展旧实现。
- **内部路径视为风险点**。凡是依赖 `lib/tools/*`、`lib/entry/*`、`lib/serverRegistry.js` 的能力，升级 Playwright 时必须做路径和行为验证。
- **dashboard/show 不自研复制**。如果保留 `pw dashboard`，应委托官方 `show` / dashboard substrate，并注入 `PWCLI` 使用的 registry 环境；不要维护一套 dashboard app 路径探测产品。

### Playwright 升级检查清单

升级 `playwright-core` 时按以下顺序做：

1. 阅读 Playwright release notes，标出新增 primitive、breaking changes、browser revision。
2. 读取官方 `playwright-cli` 文档和 `lib/tools/cli-client/help.json`，对比新增/删除命令。
3. 检查内部 substrate 路径是否仍存在：`session.js`、`registry.js`、`socketConnection.js`、`serverRegistry.js`、dashboard/show 入口。
4. 用 `browsers.json` 校验当前版本需要的 Chromium revision，不要只按 `chromium*` 模糊匹配旧浏览器。
5. 对新增能力做取舍：
   - 能减少重跑、增强复现证据或降低诊断成本 → 优先接入，必要时直接用 Playwright API 做 pwcli 增强。
   - 官方 primitive 足够 → 薄包装/转发。
   - 需要 Agent 增强 → 包装成 `pwcli` 命令并补 envelope/recovery/evidence。
   - 低价值 UI 或重复能力 → 文档说明直接用官方命令，不进入 `pwcli` 主面。
6. 同步 `skills/pwcli/`、`README.md`、contract/smoke 测试和 help 文案。
7. 至少验证：`pnpm build`、受影响命令、`pnpm test:unit`、`pnpm test:integration:core`、`pnpm test:contract`；涉及 session/dashboard/preview 再跑 smoke 对应段。

## 1.60 集成经验与策略

### 决策原则的演进

Playwright 1.60 的集成纠正了一个根本性偏差：**能力取舍的判断依据不应该是上游 CLI 有没有暴露，而应该是 Playwright 版本能力对 Agent 工作流有没有价值。**

| 旧原则 | 新原则 |
|--------|--------|
| 上游 CLI 有就接，没有就等 | 跟 Playwright 版本能力走；上游 substrate 只是复用手段，不是产品边界 |
| 怕数据膨胀，默认保守（HAR opt-in） | 复现优先完整采集，再通过命令过滤/清洗；避免 Agent 因证据不全反复重跑 |
| 上游 primitive 优先对齐 | 保留，但补充：上游未暴露不能作为不做的理由 |

### 1.60 融入清单

| 能力 | 落点 | 接入原因 | 架构路径 |
|------|------|----------|----------|
| `ariaSnapshot({ boxes })` | `pw snapshot --boxes` | Agent 需要坐标辅助定位 | 官方 CLI 已有 `snapshot --boxes`，直接透传 |
| `locator.drop()` | `pw drop --selector --data` | 文件/MIME 投放是常见操作 | 官方 CLI 已有 `drop`，薄包装 + JSON envelope |
| `getByRole({ description })` | locator `--description` 参数 | 语义定位更精确，减少重试 | 透传到所有语义 locator 动作和 batch/target parser |
| `browserContext.on('weberror')` | diagnostics 捕获 + `WebError.location()` | 不丢 context 级未捕获 JS 错误 | `managedRunCode` 注入事件监听，去重 pageerror |
| 默认全量 HAR | session `full + embed`，自动路径 | 不复跑就能有网络证据 | `resolveRecordHarConfig` 默认填 path/mode/content；`--no-record-har` 关闭 |
| `pw har filter / clean` | HAR 后处理命令 | 派生小文件用于分享/交接 | 纯 Node，读 JSON → 过滤/清洗 → 写 JSON |
| `context.tracing.startHar()` / `stopHar()` | `pw har start / stop` | 中段录制定向窗口，不重启 session | `managedRunCode` 调 `context.tracing`；需 `--no-record-har` 避免冲突 |

### 不接入的，以及原因

| 能力 | 不接入原因 |
|------|------------|
| `connectOverCDP({ noDefaults })` | 架构限制。`Session.startDaemon` 不传 `noDefaults`，daemon CLI 不暴露 `--no-defaults`。API 层已支持，但 substrate 层不可达。除非上游暴露或 pwcli 接管 daemon 创建。 |
| `test.abort()` | 测试 runner API，非 CLI 场景 |
| `toHaveCSS({ pseudo })` | 测试 runner API |
| `browser.on('context')` | pwcli 自己管理 session |
| `webSocketRoute.protocols()` | 极少用到的 WebSocket 场景 |

### 架构约束的实战案例

两个相似的 API，接入难易度天差地别，取决于它们在 Playwright 调用链里的位置：

**能接的：session 内运行时动作**
```
pwcli → runManagedSessionCommand → session.run()
  → daemon 执行 run-code
  → 页面内 `context.tracing.startHar()`

✅ managedRunCode 就能接入，因为 context 已经可用
```

**接不到的：daemon 创建时参数**
```
pwcli → Session.startDaemon(clientInfo, { cdp: "..." })
  → spawn daemon --cdp=...
  → daemon 内部 chromium.connectOverCDP(url)
  → ❌ 没有 --no-defaults，hardcode 默认行为

除非上游暴露或 pwcli 接管 daemon 创建
```

**判断方法**：看 API 在调用链的哪一层。daemon 启动前的参数需要 substrate 支持；daemon 启动后的运行时动作 `managedRunCode` 就能接。

### HAR 策略转变的经验

| 阶段 | HAR 策略 | 问题 |
|------|----------|------|
| 最初 | opt-in：`--record-har <path>` 显式开启 | Agent 忘记开 → 复现时没证据 → 重跑 |
| 中间方向（错误） | 默认不开启，因为怕数据膨胀、隐私泄露 | 用默认保守换复现成本 |
| 最终 | 默认 `full + embed`，后处理 `filter`/`clean` | 正确：先采集后过滤，证据不全比数据大更致命 |

核心教训：**对复现/诊断工具，默认保守不是美德。Agent 操作不可逆，重跑成本远高于数据存储成本。**



## 工具与 Agent 的边界

`pwcli` 是 AI Agent 的工具层，不是 AI Agent 的代理层。

| 职责 | 归属 |
|------|------|
| 任务规划、意图分解、错误恢复策略 | 外部 Agent |
| 浏览器操作原语（点击、填充、截图、等待） | `pwcli` |
| 语义 shortcut（`act`、`find-best`） | `pwcli` 内的确定性规则表 |

原则：

- **不内嵌 LLM**。`find-best` / `act` 使用硬编码规则表（selector / role / text 权重匹配），保持毫秒级延迟和可预期输出。工具层引入 LLM 会导致延迟、成本和确定性三重恶化。
- **语义层是 shortcut，不是 planner**。`act submit_form` 的本质是让 Agent 少读一次 snapshot，而不是替代 Agent 做决策。规则未命中时直接报错（`ACT_INTENT_NOT_FOUND`），由 Agent 决定下一步。
- **状态暴露，不隐藏**。`snapshot`、`status`、`console`、`network` 把浏览器状态完整交给 Agent，由 Agent 判断。工具层不做"智能兜底"。
- **纯函数优先**。给定相同输入，输出必须一致。不依赖历史上下文、不维护隐式状态。

## 产品边界

- `session create|attach|recreate` 是唯一 lifecycle 主路。
- `open` 只在已有 session 内导航。
- HAR 录制只能通过 `session create|recreate --record-har <file>` 开启。
- 视频录制只能通过 `session create|recreate --record-video <dir>` 开启。
- `auth` 只执行内置 provider，不创建 session，不改变 browser shape。
- `batch` 只接收结构化 `string[][]`，只承诺稳定子集。
- `locate|get|is|verify` 是 read-only 状态检查，不做 action planner。
- `code` 是 escape hatch，不是长流程 runner。
- `.pwcli/` 是唯一运行态目录；不要在仓库根目录生成第二套运行态目录。

## 兼容策略

- 永远不要写逻辑向后兼容实现。
- 旧参数、旧行为、旧文档残留不保留 fallback。
- 只允许命令名称层面的 Agent 友好别名。
- 别名必须收敛到同一条内部实现路径。

## 文档规则

- 项目文档中文优先；英文只用于命令、flag、错误码、API、路径、协议字段和必要引用。
- 根目录只保留 `README.md`、`AGENTS.md`、`CLAUDE.md` 三份长期文档。
- `AGENTS.md` 是包内维护规则唯一正文；`CLAUDE.md` 只保留 `@AGENTS.md` 引用，避免双维护。
- `.claude/rules/` 只保留 Claude Code 细分规则。
- `skills/pwcli/` 是唯一工具使用教程。
- 不写第二套教程、过程日志、历史 plan、临时调研、迁移记录或 backlog。
- limitation code 不能包装成“已支持”。

## 测试分层

```text
test/
  unit/         纯函数和轻量内部 contract
  integration/ 真实 CLI 集成测试；core runner 放默认 gate
  contract/    command/help/skill/专项能力契约
  smoke/       发布前本地主链回归入口脚本
  e2e/         Agent dogfood 入口脚本
  fixtures/
    code/      供 pw code / bootstrap 执行的代码片段
    data/      route、batch、dogfood 数据文件
    servers/   本地测试服务
    targets/   attach/connect 目标进程
```

`test/` 只保留后续会维护、能证明产品 contract 的资产。一次性 probe、旧产品面测试、未接入脚本的测试应用、平台化 benchmark 资产不进仓库。`smoke/` 和 `e2e/` 只放 runner，夹具统一放 `fixtures/`。

## 验证策略

日常最小验证：

```bash
pnpm build
pw <affected-command> ...
```

默认 gate：

```bash
pnpm check
```

测试脚本分层：

```bash
pnpm test:unit
pnpm test:integration:core
pnpm test:integration
pnpm test:contract
pnpm test:contract:all
pnpm test:smoke
pnpm test:e2e
pnpm test:e2e:agent
```

发布或总验收：

```bash
pnpm check
pnpm smoke
git diff --check
pnpm pack:check
```

文档清理只跑引用检查和 `git diff --check`。改运行态、session、命令注册、batch、action evidence、diagnostics 或发布准备时，再跑对应真实命令或完整 smoke。

`test:e2e` 是系统级 dogfood 脚本。`test:e2e:agent` 是真实 Agent 任务评测入口，要求外部 runner 通过 `PWCLI_AGENT_EVAL_RUNNER` 注入，并写出结构化 summary。

## 发布规则

- 当前正式版本从 `package.json` 读取。
- 不发布 npm registry。
- 正式版本以 GitHub tag 为发布锚点。
- package contract：`bin.pw = dist/cli.js`，`files` 包含 `dist`、`skills`、`README.md`。
- `skills/pwcli/` 必须能通过 `pw skill path` 找到，并能通过 `pw skill install` 安装。

## 禁忌

- 不要恢复兼容命令。
- 不要把仓库维护规则写进产品 skill。
- 不要把产品使用说明写进 Claude Code rules。
- 不要把 future design 写成当前支持能力。
- 不要把本地环境漂移包装成产品补丁；本项目基线是 Node 24 + pnpm 10+。

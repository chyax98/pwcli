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
- 维护真相：`AGENTS.md`、`CLAUDE.md`、`.claude/rules/`
- 命令参数真相：`pw --help` 和 `pw <command> --help`

## 工作顺序

1. 先看 `git status --short`，不要覆盖无关改动。
2. 改代码前确认影响面：source、skill、README、rules、test、release。
3. 命令、flag、输出、错误码、恢复路径变化时，同步 `skills/pwcli/`。
4. 仓库维护、测试、发布、review 规则变化时，同步 `AGENTS.md`、`CLAUDE.md` 或 `.claude/rules/`。
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

## 产品边界

- `session create|attach|recreate` 是唯一 lifecycle 主路。
- `open` 只在已有 session 内导航。
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
- `AGENTS.md` 和 `CLAUDE.md` 内容必须完全一致。
- `.claude/rules/` 只保留 Claude Code 细分规则。
- `skills/pwcli/` 是唯一工具使用教程。
- 不写第二套教程、过程日志、历史 plan、临时调研、迁移记录或 backlog。
- limitation code 不能包装成“已支持”。

## 测试分层

```text
test/
  unit/         纯函数和轻量 contract
  integration/ 真实 CLI 集成测试
  contract/    command/help/skill/专项能力契约
  smoke/       发布前本地主链回归
  e2e/         Agent dogfood 辅助脚本和 fixture
  fixtures/    共享测试夹具
```

`test/` 只保留后续会维护、能证明产品 contract 的资产。一次性 probe、旧产品面测试、未接入脚本的测试应用、平台化 benchmark 资产不进仓库。

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

发布或总验收：

```bash
pnpm check
pnpm smoke
git diff --check
pnpm pack:check
```

文档清理只跑引用检查和 `git diff --check`。改运行态、session、命令注册、batch、action evidence、diagnostics 或发布准备时，再跑对应真实命令或完整 smoke。

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

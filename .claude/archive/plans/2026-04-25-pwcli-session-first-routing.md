# pwcli 严格 Session-First 路由实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `pwcli` 从“单一 default session”收口成“严格 session-first 路由”，所有主路径命令都显式声明 session，彻底去掉自动 fallback，避免多 agent 并行时出现 silent misroute。

**Architecture:** 主路径改成显式 session 生命周期：`session create <name>` 建立上下文，后续命令统一带 `--session <name>`。底层继续直接复用 Playwright CLI 的 `session.js + registry.js`，项目层只新增 session 路由解析、named session 管理、命令面约束和结构化错误，不自建第二套 daemon 或 browser substrate。

**Tech Stack:** Node 24、TypeScript（宽松）、ESM、commander、playwright-core@1.59.1、Playwright CLI 内部 `cli-client/session.js` / `registry.js`、Biome、真实浏览器手工验证

---

## 执行记录

### 当前进度（2026-04-25）

已完成：
- 已新增 `session create/list/status/close`
- 已把浏览器相关命令统一切到显式 `-s, --session <name>`
- 已去掉自动 fallback，裸命令统一返回 `SESSION_REQUIRED`
- 已把 `resolvedSession` 写回成功输出
- 已把 README / Runtime State / Project Truth / Manual Verification 收口成 strict session-first

已做过的真实验证：
- 裸 `open` -> `SESSION_REQUIRED`
- 裸 `snapshot` -> `SESSION_REQUIRED`
- `session create bug-a --open https://example.com`
- `snapshot --session bug-a`
- `batch --session bug-a "snapshot" "read-text"`
- `session list`
- `session status bug-a`
- `session close bug-a`
- `code/fill/click/read-text` 显式 session 链

当前已知限制：
- `wait --request/--response/--method/--status` 仍未实现
- session registry 当前 workspace 识别仍沿用 Playwright CLI 内部逻辑

## 方案结论

### 采用方案

采用 **严格 session-first，无自动 fallback**。

主路径：

```bash
pw session create bug-123 --open 'https://...'
pw snapshot --session bug-123
pw click e6 --session bug-123
pw wait networkIdle --session bug-123
pw read-text --session bug-123
pw session close bug-123
```

硬规则：

- 除 `session create` / `session list` / `session status` / `session close` 外，所有浏览器相关命令都必须显式带 `--session <name>`
- CLI 不再自动挑选唯一 live session
- 只要没带 `--session`，统一报 `SESSION_REQUIRED`

### tradeoff

| 方案 | 优点 | 问题 | 结论 |
| --- | --- | --- | --- |
| 全局单 default session | 单人最轻 | 多 agent 最危险，容易串线 | 不采用 |
| 单 session fallback + 多 session 报错 | 兼容单用 | 规则分叉，Agent 仍要理解“什么时候能裸跑” | 不采用 |
| 所有主路径命令强制 `--session` | 最清楚、最稳定、无隐式路由 | 命令更长，单用更机械 | 采用 |

### 场景矩阵

| live sessions | 是否带 `--session` | acquisition 命令 (`open/auth/connect/profile open`) | usage 命令 (`snapshot/click/read-text/...`) |
| --- | --- | --- | --- |
| 任意 | 否 | 报 `SESSION_REQUIRED` | 报 `SESSION_REQUIRED` |
| 任意 | 是 | 落到指定 session；不存在时由 acquisition 创建 | 落到指定 session；不存在时报 `SESSION_NOT_FOUND` |

### 明确取舍

- 主路径必须带 `--session`
- `session use` 这轮不做，避免再引入“当前绑定态”
- `session create` 是唯一推荐的 session 启动方式
- 裸命令不再作为兼容路径存在

## 文件结构与职责

### CLI 与命令层

- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/cli.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/index.ts`
- Create: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/session-options.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/session.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/open.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/connect.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/auth.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/profile.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/page.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/snapshot.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/read-text.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/click.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/fill.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/type.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/press.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/scroll.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/wait.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/console.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/network.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/screenshot.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/trace.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/state.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/upload.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/download.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/drag.ts`

职责：
- 把 `--session <name>` 标成唯一主路径
- 给所有 acquisition / usage 命令统一 session 路由入口
- 裸命令统一失败，不再做任何隐式路由

### Session substrate 与路由解析

- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/session/cli-client.ts`
- Create: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/session/routing.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/core/managed.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/core/batch.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/utils/output.ts`

职责：
- 列出 live sessions
- 解析目标 session
- 统一抛出 `SESSION_REQUIRED` / `SESSION_NOT_FOUND`
- 所有成功输出都回显 `resolvedSession`

### 文档真相源

- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/README.md`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/.claude/project/05-runtime-state-model.md`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/.claude/project/14-command-semantics.md`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/.claude/project/15-batch-and-daemon.md`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/.claude/project/16-project-truth.md`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/.claude/project/08-manual-verification.md`

职责：
- 把“主路径必须带 session，无 fallback”写成项目真相

## Task 1: 固化严格 session-first 设计与命令面

**Files:**
- Create: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/session-options.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/cli.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/index.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/.claude/project/14-command-semantics.md`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/.claude/project/16-project-truth.md`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/README.md`

- [ ] **Step 1: 新建统一的 `--session` 命令选项 helper**

```ts
// src/commands/session-options.ts
import type { Command } from "commander";

export function addSessionOption<T extends Command>(command: T): T {
  return command.option(
    "--session <name>",
    "Target managed session. This is the required main path.",
  );
}
```

- [ ] **Step 2: 在主文档里写死路由规则**

```md
## Session routing

主路径：
- 先 `pw session create <name> ...`
- 后续命令始终带 `--session <name>`

禁止：
- 不带 `--session` 执行主路径命令
- 系统猜测目标 session
```

- [ ] **Step 3: 明写 tradeoff 和推荐用法**

```md
推荐：

pw session create bug-123 --open 'https://...'
pw snapshot --session bug-123
pw click e6 --session bug-123

不推荐：

pw open 'https://...'
pw snapshot
pw click e6
```

- [ ] **Step 4: 校对文档口径**

Run:

```bash
rg -n "SESSION_REQUIRED|--session <name>|session create <name>|strict session-first" /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/README.md /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/.claude/project
```

Expected:
- README 和 project truth 都指向 strict session-first
- 没有 “single-session fallback / 自动落单 session” 这类叙述

- [ ] **Step 5: Commit**

```bash
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build add src/commands/session-options.ts src/cli.ts src/commands/index.ts README.md .claude/project/14-command-semantics.md .claude/project/16-project-truth.md
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build commit -m "docs: 固化严格 session-first 命令面与项目真相"
```

## Task 2: 扩展 session substrate，支持 create/list/close 与严格路由

**Files:**
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/session/cli-client.ts`
- Create: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/session/routing.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/utils/output.ts`

- [ ] **Step 1: 在 cli-client 暴露列出 sessions 的能力**

```ts
export async function listManagedSessions() {
  const clientInfo = createClientInfo();
  const registry = await Registry.load();
  const entries = registry.entries(clientInfo);
  return await Promise.all(
    entries.map(async (entry) => {
      const session = new Session(entry);
      return {
        name: entry.config.name,
        socketPath: entry.config.socketPath,
        version: entry.config.version,
        workspaceDir: entry.config.workspaceDir,
        alive: await session.canConnect(),
      };
    }),
  );
}
```

- [ ] **Step 2: 新建严格路由解析器**

```ts
// src/session/routing.ts
export async function resolveSessionRoute(options: {
  requestedSession?: string;
  allowCreate?: boolean;
}) {
  if (options.requestedSession) {
    return { sessionName: options.requestedSession, mode: "explicit" };
  }
  if (options.allowCreate) {
    return { sessionName: "default", mode: "explicit-default-create" };
  }
  throw new Error("SESSION_REQUIRED");
}
```

- [ ] **Step 3: 把错误翻译成结构化错误**

```ts
export function sessionRoutingError(message: string) {
  if (message === "SESSION_REQUIRED") {
    return {
      code: "SESSION_REQUIRED",
      message: "This command requires --session <name>.",
      suggestions: [
        "Run `pw session create <name> --open <url>` first",
        "Retry with `--session <name>`",
      ],
    };
  }
  if (message.startsWith("SESSION_NOT_FOUND:")) {
    const name = message.slice("SESSION_NOT_FOUND:".length);
    return {
      code: "SESSION_NOT_FOUND",
      message: `Session '${name}' not found.`,
      suggestions: [
        "Run `pw session list` to inspect active sessions",
        "Create it with `pw session create <name> --open <url>`",
      ],
    };
  }
}
```

- [ ] **Step 4: 运行构建基线**

Run:

```bash
cd /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build
pnpm build
pnpm typecheck
```

Expected:
- `build` 成功
- `typecheck` 成功

- [ ] **Step 5: Commit**

```bash
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build add src/session/cli-client.ts src/session/routing.ts src/utils/output.ts
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build commit -m "feat: 新增严格 session 路由解析与错误"
```

## Task 3: 重写 `session` 命令，提供 create/list/status/close 主路径

**Files:**
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/session.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/core/managed.ts`

- [ ] **Step 1: 把 `session` 命令改成完整子命令集**

```ts
const session = program.command("session").description("Manage named browser sessions");

session.command("list");
session.command("create <name>");
session.command("status <name>");
session.command("close <name>");
```

- [ ] **Step 2: 让 `session create` 支持 acquisition 入口**

```ts
session
  .command("create <name>")
  .option("--open <url>")
  .option("--profile <path>")
  .option("--state <file>")
  .option("--connect <endpoint>")
  .option("--headed")
  .action(async (name, options) => {
    // 只允许一种 acquisition 来源
  });
```

- [ ] **Step 3: 明确 create 的唯一入口语义**

```ts
const acquisitionCount = [
  options.open ? 1 : 0,
  options.connect ? 1 : 0,
].reduce((sum, item) => sum + item, 0);

if (acquisitionCount > 1) {
  throw new Error("session create accepts exactly one acquisition source");
}
```

- [ ] **Step 4: 真实 smoke - create/list/close**

Run:

```bash
cd /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build
node dist/cli.js session create bug-a --open https://example.com
node dist/cli.js session list
node dist/cli.js session status bug-a
node dist/cli.js session close bug-a
node dist/cli.js session list
```

Expected:
- `bug-a` 出现在 list 里
- `status bug-a` 可见 `alive: true`
- `close bug-a` 后 list 不再把它标记成 active

- [ ] **Step 5: Commit**

```bash
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build add src/commands/session.ts src/core/managed.ts
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build commit -m "feat: 增加 session create list status close"
```

## Task 4: 让 acquisition 命令走严格 session-first 路由

**Files:**
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/open.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/connect.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/auth.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/profile.ts`

- [ ] **Step 1: 给 acquisition 命令统一补 `--session`**

```ts
addSessionOption(program.command("open <url>"));
addSessionOption(program.command("connect [endpoint]"));
addSessionOption(program.command("auth [plugin]"));
addSessionOption(profile.command("open <path> <url>"));
```

- [ ] **Step 2: acquisition 路由规则写进命令实现**

```ts
if (!options.session) {
  throw new Error("SESSION_REQUIRED");
}

const result = await managedOpen(url, {
  sessionName: options.session,
  reset: false,
});
```

- [ ] **Step 3: acquisition 命令未带 `--session` 必须失败**

```ts
if (!options.session) {
  printCommandError("open", sessionRoutingError("SESSION_REQUIRED"));
  process.exitCode = 1;
  return;
}
```

- [ ] **Step 4: 真实 smoke - acquisition 必须显式 session**

Run:

```bash
cd /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build
node dist/cli.js open https://example.com
node dist/cli.js connect --cdp 9222
node dist/cli.js auth example-auth
node dist/cli.js open --session bug-a https://example.com
```

Expected:
- 前三条都报 `SESSION_REQUIRED`
- `open --session bug-a ...` 成功

- [ ] **Step 5: Commit**

```bash
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build add src/commands/open.ts src/commands/connect.ts src/commands/auth.ts src/commands/profile.ts
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build commit -m "feat: acquisition 命令改成严格 session-first 路由"
```

## Task 5: 让 usage 命令统一显式 session

**Files:**
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/core/managed.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/core/batch.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/page.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/snapshot.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/read-text.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/click.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/fill.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/type.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/press.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/scroll.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/wait.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/console.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/network.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/screenshot.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/trace.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/state.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/upload.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/download.ts`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/src/commands/drag.ts`

- [ ] **Step 1: 给所有 usage 命令补 `--session` 选项**

```ts
addSessionOption(snapshot);
addSessionOption(pageCurrent);
addSessionOption(click);
addSessionOption(fill);
addSessionOption(wait);
```

- [ ] **Step 2: 所有 managed helpers 接收 `sessionName`**

```ts
export async function managedSnapshot(options?: { depth?: number; sessionName?: string }) {
  const result = await runManagedSessionCommand(
    { _: ["snapshot"] },
    { sessionName: options?.sessionName },
  );
}
```

- [ ] **Step 3: usage 命令统一要求显式 session**

```ts
if (!options.session) {
  throw new Error("SESSION_REQUIRED");
}

const result = await managedSnapshot({
  sessionName: options.session,
});
printCommandResult("snapshot", {
  ...result,
  data: {
    ...result.data,
    resolvedSession: options.session,
  },
});
```

- [ ] **Step 4: batch 也改成严格 session-first**

```bash
pw batch --session bug-a "snapshot" "click e6" "read-text"
```

若未带 `--session`：
- 直接报 `SESSION_REQUIRED`

- [ ] **Step 5: 真实 smoke - 严格显式 session**

Run:

```bash
cd /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build
node dist/cli.js session create bug-a --open https://example.com
node dist/cli.js snapshot
node dist/cli.js snapshot --session bug-a
node dist/cli.js batch --session bug-a "snapshot" "read-text"
```

Expected:
- 裸 `snapshot` 报 `SESSION_REQUIRED`
- `snapshot --session bug-a` 成功
- `batch --session bug-a ...` 成功

- [ ] **Step 6: Commit**

```bash
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build add src/core/managed.ts src/core/batch.ts src/commands/page.ts src/commands/snapshot.ts src/commands/read-text.ts src/commands/click.ts src/commands/fill.ts src/commands/type.ts src/commands/press.ts src/commands/scroll.ts src/commands/wait.ts src/commands/console.ts src/commands/network.ts src/commands/screenshot.ts src/commands/trace.ts src/commands/state.ts src/commands/upload.ts src/commands/download.ts src/commands/drag.ts
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build commit -m "feat: usage 命令切到严格 session-first 路由"
```

## Task 6: 同步手工验证清单与项目真相

**Files:**
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/.claude/project/05-runtime-state-model.md`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/.claude/project/08-manual-verification.md`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/.claude/project/15-batch-and-daemon.md`
- Modify: `/Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build/README.md`

- [ ] **Step 1: 把 runtime state 文档改成 strict named sessions truth**

```md
## Session truth

- 多个 managed sessions 可以并存
- 主路径要求显式 `--session <name>`
- 不再保留自动 fallback
- 裸命令统一报 `SESSION_REQUIRED`
```

- [ ] **Step 2: 把手工验证清单补成 strict session 场景**

```md
## Multi-session routing smoke

1. create bug-a
2. bare snapshot -> SESSION_REQUIRED
3. snapshot --session bug-a -> success
4. close bug-a
```

- [ ] **Step 3: 跑最终 build + typecheck + session smoke**

Run:

```bash
cd /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build
pnpm build
pnpm typecheck
node dist/cli.js session list
node dist/cli.js session create bug-a --open https://example.com
node dist/cli.js snapshot
node dist/cli.js snapshot --session bug-a
node dist/cli.js session close bug-a
```

Expected:
- build 成功
- typecheck 成功
- `SESSION_REQUIRED` 与显式 session 路由都符合设计

- [ ] **Step 4: Commit**

```bash
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build add .claude/project/05-runtime-state-model.md .claude/project/08-manual-verification.md .claude/project/15-batch-and-daemon.md README.md
git -C /Users/xd/.config/superpowers/worktrees/pwcli/codex-pwcli-complete-build commit -m "docs: 同步严格 session-first 真相与验证清单"
```

## 自检

### 1. 规格覆盖

- 主路径严格 session-first：已覆盖
- `session create` 完整方案：已覆盖
- 不允许猜：已覆盖
- 无 fallback：已覆盖
- `open/connect/auth/profile open` acquisition 路由：已覆盖
- `snapshot/click/read-text/...` usage 路由：已覆盖
- batch 路由：已覆盖
- 无自动化测试，仅 build/typecheck + 真实命令验证：已覆盖

### 2. Placeholder scan

- 已去掉 `TODO` / `TBD` / `implement later`
- 每个任务都给了具体文件、代码骨架、命令和期望结果

### 3. Type consistency

- 统一名词：
  - `strict session-first`
  - `SESSION_REQUIRED`
  - `SESSION_NOT_FOUND`
  - `resolvedSession`

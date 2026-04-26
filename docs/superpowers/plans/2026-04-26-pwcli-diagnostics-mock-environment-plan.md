# pwcli Diagnostics Mock Environment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `pwcli` 接下来的主线收口成 3 组能力：`diagnostics query/export`、`mock 第一层增强`、`environment control`，直接服务 agent 的找 bug、定位 bug、自动化操作场景。

**Architecture:** 继续保留当前 `app -> domain -> infra -> playwright-core`。不再扩主路径命令的大类，只在现有 `network / console / errors / route / batch / observe / doctor` 上加深查询和可复现能力。优先借 Playwright public API，必要时才围绕 `newCDPSession` 做薄补口。

**Tech Stack:** Node 24、TypeScript、commander、playwright-core 1.59.1、Playwright CLI `session.js` / `registry.js`、BrowserContext public API、`context.route()`、`context.setOffline()`、`context.setGeolocation()`、`context.grantPermissions()`、Playwright clock API（如可用）

---

## 1. Current Position

已经完成：

- strict session-first
- `session defaults` + trace default-on
- `auth` ownership 收缩
- structured batch 主路（`--json` / `--file`）
- action diagnostics delta
- modal blocked surfacing
- minimum run dir
- smoke gate

当前剩余主线只剩：

1. diagnostics query / export
2. mock 第一层增强
3. environment control

这 3 条都直接挂真实 Agent 场景：

- 找 bug
- 定位 bug
- 做 deterministic automation

## 2. Product Thesis

`pwcli` 接下来不该继续扩“更多动作命令”，而该补：

1. **诊断查询**
   - 让 agent 快速拿到它要的请求、错误、console
2. **可控 mock**
   - 让 agent 稳定复现接口和边界条件
3. **环境控制**
   - 让 agent 复现 offline、地理位置、权限、时间相关问题

这一阶段的价值排序：

1. 提升 bug 定位速度
2. 提升复现稳定性
3. 提升自动化可重复性

## 3. Scope Lock

这份计划明确做：

### Diagnostics

- `network list/filter/detail` 加深
- `console` / `errors` query 稳定化
- `diagnostics export`
- run-scoped query

### Mock

- `route list`
- `route load <file>`
- `route add --method`
- `route add --body-file`
- `route add --headers-file`

### Environment

- `offline on|off`
- `geolocation set`
- `permissions grant|clear`
- `clock install|set|resume`

这份计划明确不做：

- raw CDP named-session substrate
- observe stream
- HAR 热录制
- workspace 写操作
- 第二套 diagnostics backend

## 4. Design Decisions

### 4.1 Diagnostics 优先做 query，不优先做更多录制

理由：

- 当前 records 已存在
- action delta 已存在
- run events 已存在
- 真正缺的是“取信息”和“过滤信息”

### 4.2 Mock 只做第一层

理由：

- 当前 route fulfill/abort 已经能工作
- 再往上补 method/body-file/headers-file/route-file/list，收益最高
- 不急着做 inject / 更复杂 hook runtime

### 4.3 Environment control 先做 BrowserContext 直映射

理由：

- Playwright public API 本身就能解决
- 对 bug 复现很值钱
- 不需要引入新的运行模型

### 4.4 `doctor` 和 `observe` 继续只读

理由：

- 当前它们已经是稳定诊断入口
- 不该一边读一边改状态

## 5. Task 1: Diagnostics Query Deepening

**Files:**
- Modify: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/diagnostics.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/app/commands/network.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/app/commands/console.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/app/commands/errors.ts`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/07-artifacts-diagnostics.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/08-manual-verification.md`

- [ ] **Step 1: Add stable list filters to `network`**

Support:

```text
--url <substring>
--kind request|response|requestfailed
--limit <n>
```

Behavior:

- still keep `--request-id`
- `--request-id` remains the detail fast path

- [ ] **Step 2: Add stable `console` filters**

Support:

```text
--level info|warning|error
--text <substring>
--limit <n>
```

- [ ] **Step 3: Add `errors` filters**

Support:

```text
errors recent --session <name> [--text <substring>] [--limit <n>]
```

- [ ] **Step 4: Add `diagnostics export`**

Command surface:

```text
pw diagnostics export --session <name> --out <file>
```

Export shape:

```json
{
  "session": "...",
  "workspace": { ... },
  "console": [...],
  "network": [...],
  "errors": [...],
  "routes": [...],
  "bootstrap": { ... }
}
```

- [ ] **Step 5: Verify against deterministic fixture**

Run:

```bash
node scripts/manual/deterministic-fixture-server.js
node dist/cli.js session create dqx --open http://127.0.0.1:4179/blank
node dist/cli.js code --session dqx --file ./scripts/manual/diagnostics-fixture.js
node dist/cli.js click --selector '#fire' --session dqx
node dist/cli.js network --session dqx --kind response --status 207
node dist/cli.js console --session dqx --text fixture-route-hit-run-1
node dist/cli.js errors recent --session dqx --text fixture-page-error
node dist/cli.js diagnostics export --session dqx --out /tmp/pwcli-diag.json
```

Expected:

- list/filter/detail all return expected rows
- export file is valid JSON and contains all sections

## 6. Task 2: Run-Scoped Query

**Files:**
- Create: `/Users/xd/work/tools/pwcli/src/app/commands/diagnostics.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/app/commands/index.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/infra/fs/run-artifacts.ts`
- Modify: `/Users/xd/work/tools/pwcli/README.md`

- [ ] **Step 1: Add run metadata helpers**

Support:

```ts
listRunDirs()
readRunEvents(runId)
```

- [ ] **Step 2: Add read-only command surface**

Command surface:

```text
pw diagnostics runs
pw diagnostics show --run <runId>
pw diagnostics grep --run <runId> --text <substring>
```

- [ ] **Step 3: Verify against existing run events**

Run:

```bash
node dist/cli.js diagnostics runs
node dist/cli.js diagnostics show --run <runId>
node dist/cli.js diagnostics grep --run <runId> --text fixture-route-hit-run-1
```

Expected:

- run list is discoverable
- grep returns matching events

## 7. Task 3: Mock First Layer Enhancement

**Files:**
- Modify: `/Users/xd/work/tools/pwcli/src/app/commands/route.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/diagnostics.ts`
- Create: `/Users/xd/work/tools/pwcli/scripts/manual/mock-routes.json`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/07-artifacts-diagnostics.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/08-manual-verification.md`

- [ ] **Step 1: Add `route list`**

Command:

```text
pw route list --session <name>
```

Return:

- active routes
- mode
- method if specified
- body preview / headers summary

- [ ] **Step 2: Add `--method` to `route add`**

Command:

```text
pw route add '**/api/**' --session <name> --method POST --body '{}'
```

- [ ] **Step 3: Add `--body-file` and `--headers-file`**

Commands:

```text
pw route add '**/api/**' --session <name> --body-file ./mock.json
pw route add '**/api/**' --session <name> --headers-file ./headers.json
```

- [ ] **Step 4: Add `route load <file>`**

File format:

```json
[
  {
    "pattern": "**/api/users",
    "method": "GET",
    "status": 200,
    "contentType": "application/json",
    "bodyFile": "./users.json"
  }
]
```

Command:

```text
pw route load ./scripts/manual/mock-routes.json --session <name>
```

- [ ] **Step 5: Verify**

Run:

```bash
node dist/cli.js route add '**/__pwcli__/diagnostics/route-hit**' --session mock1 --method GET --body routed --status 211
node dist/cli.js route list --session mock1
node dist/cli.js route load ./scripts/manual/mock-routes.json --session mock1
```

Expected:

- routes are visible
- file load succeeds
- method filter works

## 8. Task 4: Environment Control

**Files:**
- Create: `/Users/xd/work/tools/pwcli/src/app/commands/environment.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/app/commands/index.ts`
- Create: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/environment.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime.ts`
- Modify: `/Users/xd/work/tools/pwcli/README.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/01-use-cases-and-capabilities.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/03-playwright-capability-mapping.md`

- [ ] **Step 1: Add `offline`**

Command:

```text
pw environment offline on --session <name>
pw environment offline off --session <name>
```

### Step 2: Add `geolocation set`

Command:

```text
pw environment geolocation set --session <name> --lat <lat> --lng <lng>
```

- [ ] **Step 3: Add `permissions grant|clear`**

Commands:

```text
pw environment permissions grant --session <name> geolocation clipboard-read
pw environment permissions clear --session <name>
```

- [ ] **Step 4: Add `clock install|set|resume`**

Commands:

```text
pw environment clock install --session <name>
pw environment clock set --session <name> 2026-01-01T00:00:00Z
pw environment clock resume --session <name>
```

- [ ] **Step 5: Verify**

Use a deterministic page and `pw code` to confirm:

- offline affects fetch
- geolocation reads back
- granted permissions are visible
- clock time changes

## 9. Task 5: Docs / Skill / Smoke Sync

**Files:**
- Modify: `/Users/xd/work/tools/pwcli/README.md`
- Modify: `/Users/xd/work/tools/pwcli/skills/pwcli/SKILL.md`
- Modify: `/Users/xd/work/tools/pwcli/skills/pwcli/references/command-reference.md`
- Modify: `/Users/xd/work/tools/pwcli/scripts/smoke/pwcli-smoke.sh`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/16-project-truth.md`

- [ ] **Step 1: Document structured batch and route file**
- [ ] **Step 2: Document environment control commands**
- [ ] **Step 3: Extend smoke only if commands are deterministic enough**

Rule:

- do not add flaky environment assertions into `pnpm smoke`
- prefer a second deterministic regression script if needed

## 10. Final Recommendation

这份方案的主线次序固定：

1. diagnostics query/export
2. run-scoped query
3. mock 第一层增强
4. environment control
5. docs / skill / smoke sync

理由：

- 诊断查询最直接提升 bug 定位速度
- mock 第一层最直接提升复现稳定性
- environment control 扩的是边界场景，但仍然基于 public API
- 全程不需要引入新的重 substrate

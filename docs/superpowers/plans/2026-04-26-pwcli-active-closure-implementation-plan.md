# pwcli Active Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 关闭当前 `pwcli` 还未完成的 P0 / P1 闭环，把工具从“能力存在但链路不稳”推进到“主链稳定、可诊断、可复盘、agent contract 一致”。

**Architecture:** 继续保留 `app -> domain -> infra -> playwright-core`。先做不需要你拍板的 direct work：contract sync、runtime 拆分、action diagnostics delta、modal blocked 检测、evidence 最小 run dir、smoke gate。需要你拍板的 acquisition/batch/auth 决策，不进入这份执行计划。

**Tech Stack:** Node 24、TypeScript、commander、playwright-core 1.59.1、Playwright CLI `session.js` / `registry.js`、BrowserContext/Page public API、Biome、现有 deterministic fixtures

---

## 0. Scope Lock

这份执行计划只覆盖下面 6 件事：

1. agent contract sync
2. runtime lane 拆分
3. action diagnostics delta
4. modal blocked detection + doctor surfacing
5. evidence 最小 run dir
6. smoke / dogfood gate

这份计划明确不做：

- raw CDP named-session substrate
- observe stream
- HAR 热录制
- workspace 写操作
- `connect` 删除
- `auth` ownership 收口
- `batch` JSON mode

## 1. File Map

### Existing files to modify

- `/Users/xd/work/tools/pwcli/README.md`
- `/Users/xd/work/tools/pwcli/skills/pwcli/SKILL.md`
- `/Users/xd/work/tools/pwcli/skills/pwcli/README.md`
- `/Users/xd/work/tools/pwcli/skills/pwcli/references/command-reference.md`
- `/Users/xd/work/tools/pwcli/.claude/project/04-command-surface.md`
- `/Users/xd/work/tools/pwcli/.claude/project/07-artifacts-diagnostics.md`
- `/Users/xd/work/tools/pwcli/.claude/project/08-manual-verification.md`
- `/Users/xd/work/tools/pwcli/.claude/project/16-project-truth.md`
- `/Users/xd/work/tools/pwcli/src/app/output.ts`
- `/Users/xd/work/tools/pwcli/src/app/batch/run-batch.ts`
- `/Users/xd/work/tools/pwcli/src/app/commands/click.ts`
- `/Users/xd/work/tools/pwcli/src/app/commands/fill.ts`
- `/Users/xd/work/tools/pwcli/src/app/commands/type.ts`
- `/Users/xd/work/tools/pwcli/src/app/commands/press.ts`
- `/Users/xd/work/tools/pwcli/src/app/commands/scroll.ts`
- `/Users/xd/work/tools/pwcli/src/app/commands/upload.ts`
- `/Users/xd/work/tools/pwcli/src/app/commands/download.ts`
- `/Users/xd/work/tools/pwcli/src/app/commands/drag.ts`
- `/Users/xd/work/tools/pwcli/src/app/commands/wait.ts`
- `/Users/xd/work/tools/pwcli/src/app/commands/doctor.ts`
- `/Users/xd/work/tools/pwcli/src/app/commands/session.ts`
- `/Users/xd/work/tools/pwcli/src/domain/diagnostics/service.ts`
- `/Users/xd/work/tools/pwcli/src/domain/interaction/service.ts`
- `/Users/xd/work/tools/pwcli/src/domain/workspace/service.ts`
- `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime.ts`

### New files to create

- `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/shared.ts`
- `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/session.ts`
- `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/workspace.ts`
- `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/interaction.ts`
- `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/identity-state.ts`
- `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/diagnostics.ts`
- `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/bootstrap.ts`
- `/Users/xd/work/tools/pwcli/src/infra/fs/run-artifacts.ts`
- `/Users/xd/work/tools/pwcli/scripts/manual/modal-fixture.js`
- `/Users/xd/work/tools/pwcli/scripts/smoke/pwcli-smoke.sh`

## 2. Task 1: Agent Contract Sync

**Files:**
- Modify: `/Users/xd/work/tools/pwcli/README.md`
- Modify: `/Users/xd/work/tools/pwcli/skills/pwcli/SKILL.md`
- Modify: `/Users/xd/work/tools/pwcli/skills/pwcli/README.md`
- Modify: `/Users/xd/work/tools/pwcli/skills/pwcli/references/command-reference.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/04-command-surface.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/16-project-truth.md`

- [ ] **Step 1: Capture shipped command surface**

Run:

```bash
node dist/cli.js --help
node dist/cli.js session --help
node dist/cli.js page --help
node dist/cli.js doctor --help
```

Expected:

- command list matches current registration in `src/app/commands/index.ts`
- no command in docs exists only on paper

- [ ] **Step 2: Rewrite skill command reference**

Replace the stale minimal content in `/Users/xd/work/tools/pwcli/skills/pwcli/references/command-reference.md` with a concise current contract covering:

```md
# Command Reference

Stable lifecycle:
- `pw session create <name> --open <url>`
- `pw session attach <name> --ws-endpoint <url>|--browser-url <url>|--cdp <port>`
- `pw session recreate <name> ...`
- `pw session close <name>`

Stable read path:
- `pw snapshot --session <name>`
- `pw page current|list|frames|dialogs --session <name>`
- `pw read-text --session <name>`
- `pw observe status --session <name>`

Stable action path:
- `pw click|fill|type|press|scroll|upload|download|drag|wait --session <name>`

Stable diagnostics path:
- `pw console --session <name>`
- `pw network --session <name>`
- `pw errors recent|clear --session <name>`
- `pw doctor --session <name>`

Stable reuse path:
- `pw state save|load --session <name>`
- `pw profile inspect|open`
- `pw auth [plugin] --session <name>`
```

- [ ] **Step 3: Rewrite command surface truth**

Update `/Users/xd/work/tools/pwcli/.claude/project/04-command-surface.md` so it stops being a future wish list and starts reflecting shipped command groups:

```md
状态：active

当前一级命令：
- lifecycle: `session`, `open`, `connect`
- workspace/read: `snapshot`, `page`, `read-text`, `observe`
- actions: `click`, `fill`, `type`, `press`, `scroll`, `upload`, `download`, `drag`, `wait`, `resize`
- diagnostics/evidence: `console`, `network`, `errors`, `route`, `trace`, `screenshot`, `har`, `doctor`
- reuse/bootstrap: `state`, `cookies`, `storage`, `profile`, `auth`, `bootstrap`
- distribution: `plugin`, `skill`
```

- [ ] **Step 4: Verify skill and README consistency**

Run:

```bash
rg -n "page dialogs|observe status|cookies|storage|doctor|bootstrap" README.md skills/pwcli .claude/project/04-command-surface.md .claude/project/16-project-truth.md
```

Expected:

- the same commands appear with the same naming
- no stale references like “等待 runtime 落地”

- [ ] **Step 5: Commit**

```bash
git add README.md skills/pwcli/SKILL.md skills/pwcli/README.md skills/pwcli/references/command-reference.md .claude/project/04-command-surface.md .claude/project/16-project-truth.md
git commit -m "docs: align shipped agent contract"
```

## 3. Task 2: Split `runtime.ts` Into Lanes

**Files:**
- Create: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/shared.ts`
- Create: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/session.ts`
- Create: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/workspace.ts`
- Create: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/interaction.ts`
- Create: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/identity-state.ts`
- Create: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/diagnostics.ts`
- Create: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/bootstrap.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime.ts`

- [ ] **Step 1: Create shared helper module**

Create `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/shared.ts` with the helpers that every lane already uses:

```ts
export const DIAGNOSTICS_STATE_KEY = '__pwcliDiagnostics';

export function maybeRawOutput(text: string) {
  return process.env.PWCLI_RAW_OUTPUT === '1' ? { output: text } : {};
}

export function normalizeRef(ref: string) {
  return ref.startsWith('@') ? ref.slice(1) : ref;
}
```

- [ ] **Step 2: Move identity-state functions out first**

Move these functions into `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/identity-state.ts`:

```ts
export async function managedStateSave(...)
export async function managedStateLoad(...)
export async function managedCookiesList(...)
export async function managedCookiesSet(...)
export async function managedStorageRead(...)
```

Reason:

- these functions have the clearest boundary
- they touch BrowserContext state, not page actions

- [ ] **Step 3: Move diagnostics functions**

Move these into `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/diagnostics.ts`:

```ts
export async function managedErrors(...)
export async function managedRoute(...)
export async function managedHar(...)
export async function managedObserveStatus(...)
export async function managedConsole(...)
export async function managedNetwork(...)
```

Also move:

```ts
async function managedEnsureDiagnosticsHooks(...)
```

- [ ] **Step 4: Move workspace projection**

Move these into `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/workspace.ts`:

```ts
async function managedWorkspaceProjection(...)
export async function managedPageCurrent(...)
export async function managedPageList(...)
export async function managedPageFrames(...)
export async function managedPageDialogs(...)
```

- [ ] **Step 5: Move interaction functions**

Move these into `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/interaction.ts`:

```ts
export async function managedSnapshot(...)
export async function managedRunCode(...)
export async function managedClick(...)
export async function managedFill(...)
export async function managedType(...)
export async function managedPress(...)
export async function managedScroll(...)
export async function managedUpload(...)
export async function managedDrag(...)
export async function managedDownload(...)
export async function managedReadText(...)
export async function managedWait(...)
export async function managedScreenshot(...)
```

- [ ] **Step 6: Move session/bootstrap/resize pieces**

Create:

- `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/session.ts`
- `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/bootstrap.ts`

Move:

```ts
export async function managedOpen(...)
export async function managedResize(...)
export async function managedTrace(...)
export async function managedBootstrapApply(...)
```

- [ ] **Step 7: Turn `runtime.ts` into a barrel**

Replace most of `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime.ts` with re-exports:

```ts
export * from './runtime/shared.js';
export * from './runtime/session.js';
export * from './runtime/workspace.js';
export * from './runtime/interaction.js';
export * from './runtime/identity-state.js';
export * from './runtime/diagnostics.js';
export * from './runtime/bootstrap.js';
```

- [ ] **Step 8: Verify no behavior drift**

Run:

```bash
pnpm typecheck
pnpm build
node dist/cli.js session create split-a --open https://example.com
node dist/cli.js snapshot --session split-a
node dist/cli.js observe status --session split-a
node dist/cli.js console --session split-a
node dist/cli.js state save --session split-a /tmp/split-a.json
```

Expected:

- all commands still succeed
- no changed output envelope shape

- [ ] **Step 9: Commit**

```bash
git add src/infra/playwright/runtime.ts src/infra/playwright/runtime src/domain src/app .claude/project/08-manual-verification.md
git commit -m "refactor: split playwright runtime into lanes"
```

## 4. Task 3: Add Action Diagnostics Delta

**Files:**
- Modify: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/diagnostics.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/interaction.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/app/batch/run-batch.ts`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/07-artifacts-diagnostics.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/08-manual-verification.md`

- [ ] **Step 1: Add diagnostics baseline helpers**

Add helpers to `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/diagnostics.ts`:

```ts
export async function captureDiagnosticsBaseline(sessionName?: string) {
  const status = await managedObserveStatus({ sessionName });
  return {
    consoleTotal: status.data.console?.total ?? 0,
    networkTotal: status.data.network?.total ?? 0,
    pageErrorTotal: status.data.pageErrors?.total ?? 0,
  };
}

export async function buildDiagnosticsDelta(
  sessionName: string | undefined,
  before: { consoleTotal: number; networkTotal: number; pageErrorTotal: number },
) {
  const status = await managedObserveStatus({ sessionName });
  return {
    consoleDelta: Math.max(0, (status.data.console?.total ?? 0) - before.consoleTotal),
    networkDelta: Math.max(0, (status.data.network?.total ?? 0) - before.networkTotal),
    pageErrorDelta: Math.max(0, (status.data.pageErrors?.total ?? 0) - before.pageErrorTotal),
    lastConsole: status.data.console?.last ?? null,
    lastNetwork: status.data.network?.last ?? null,
    lastPageError: status.data.pageErrors?.last ?? null,
  };
}
```

- [ ] **Step 2: Wrap action commands with before/after capture**

For each action in `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/interaction.ts`, add the same pattern:

```ts
const before = await captureDiagnosticsBaseline(options.sessionName);
// existing action body
const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
return {
  ...existingResult,
  data: {
    ...existingResult.data,
    diagnosticsDelta,
  },
};
```

Apply this to:

- `managedClick`
- `managedFill`
- `managedType`
- `managedPress`
- `managedScroll`
- `managedUpload`
- `managedDownload`
- `managedDrag`
- `managedWait`

- [ ] **Step 3: Surface delta in batch step results**

Update batch result shape in `/Users/xd/work/tools/pwcli/src/app/batch/run-batch.ts` so action steps preserve the new `diagnosticsDelta` block without stripping fields.

- [ ] **Step 4: Verify with deterministic fixture**

Run:

```bash
node scripts/manual/deterministic-fixture-server.js
node dist/cli.js session create diagd --open http://127.0.0.1:4123
node dist/cli.js click --selector '#trigger-console-and-fetch' --session diagd
node dist/cli.js batch --session diagd "click --selector #trigger-console-and-fetch" "wait --response /fixture --status 200"
```

Expected:

- action command returns `data.diagnosticsDelta`
- batch action step returns `diagnosticsDelta`
- delta values are non-zero when fixture emits console/network activity

- [ ] **Step 5: Commit**

```bash
git add src/infra/playwright/runtime src/app/batch/run-batch.ts .claude/project/07-artifacts-diagnostics.md .claude/project/08-manual-verification.md
git commit -m "feat: attach diagnostics delta to action results"
```

## 5. Task 4: Productize Modal-Blocked Sessions

**Files:**
- Create: `/Users/xd/work/tools/pwcli/scripts/manual/modal-fixture.js`
- Modify: `/Users/xd/work/tools/pwcli/src/app/commands/doctor.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/domain/session/routing.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/workspace.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/diagnostics.ts`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/07-artifacts-diagnostics.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/08-manual-verification.md`

- [ ] **Step 1: Add a deterministic modal fixture**

Create `/Users/xd/work/tools/pwcli/scripts/manual/modal-fixture.js` that serves a page with a button causing `alert()`:

```js
import http from 'node:http';

const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`
    <button id="open-alert" onclick="alert('pwcli-modal')">Open alert</button>
  `);
});

server.listen(4124, '127.0.0.1', () => {
  console.log('http://127.0.0.1:4124');
});
```

- [ ] **Step 2: Detect modal-blocked reads**

In workspace and diagnostics read paths, catch the current substrate failure from `managedRunCode()` and convert it into a typed product error:

```ts
throw new Error('MODAL_STATE_BLOCKED');
```

Apply this only when the failure is clearly caused by the blocked modal read path. Do not collapse unrelated run-code errors into this code.

- [ ] **Step 3: Add routing for the new error**

In `/Users/xd/work/tools/pwcli/src/domain/session/routing.ts`, add:

```ts
if (message === 'MODAL_STATE_BLOCKED') {
  return {
    code: 'MODAL_STATE_BLOCKED',
    message: 'The current managed session is blocked by a modal dialog, so workspace reads are unavailable.',
    suggestions: [
      'Dismiss or accept the browser dialog in the headed window if one is visible',
      'If the session cannot be recovered, recreate it with `pw session recreate <name>`',
    ],
  };
}
```

- [ ] **Step 4: Teach `doctor` to probe and report**

Add a dedicated diagnostic to `/Users/xd/work/tools/pwcli/src/app/commands/doctor.ts`:

```ts
{
  kind: 'modal-state',
  status: 'warn',
  summary: 'Workspace reads are blocked by a modal dialog',
  details: { sessionName, code: 'MODAL_STATE_BLOCKED' }
}
```

Only emit this when the session is actually blocked.

- [ ] **Step 5: Verify the boundary**

Run:

```bash
node scripts/manual/modal-fixture.js
node dist/cli.js session create modal-a --open http://127.0.0.1:4124
node dist/cli.js click --selector '#open-alert' --session modal-a
node dist/cli.js page current --session modal-a
node dist/cli.js observe status --session modal-a
node dist/cli.js doctor --session modal-a
```

Expected:

- `page current` and `observe status` fail with `MODAL_STATE_BLOCKED`
- `doctor` reports a modal-state warning

- [ ] **Step 6: Record the Core boundary**

Update docs to say:

- detection is productized
- recovery is still limited by current managed-session substrate
- no live dialog control contract is claimed yet

- [ ] **Step 7: Commit**

```bash
git add scripts/manual/modal-fixture.js src/app/commands/doctor.ts src/domain/session/routing.ts src/infra/playwright/runtime .claude/project/07-artifacts-diagnostics.md .claude/project/08-manual-verification.md
git commit -m "feat: surface modal-blocked managed sessions"
```

## 6. Task 5: Add Minimum Run Directory

**Files:**
- Create: `/Users/xd/work/tools/pwcli/src/infra/fs/run-artifacts.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/app/output.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/interaction.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/infra/playwright/runtime/diagnostics.ts`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/07-artifacts-diagnostics.md`
- Modify: `/Users/xd/work/tools/pwcli/README.md`

- [ ] **Step 1: Add run-directory allocator**

Create `/Users/xd/work/tools/pwcli/src/infra/fs/run-artifacts.ts`:

```ts
import { mkdir, appendFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export async function ensureRunDir(sessionName?: string) {
  const base = resolve('.pwcli', 'runs');
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${sessionName ?? 'no-session'}`;
  const runDir = join(base, runId);
  await mkdir(runDir, { recursive: true });
  return { runId, runDir };
}

export async function appendRunEvent(runDir: string, event: unknown) {
  await appendFile(join(runDir, 'events.jsonl'), `${JSON.stringify(event)}\n`, 'utf8');
}
```

- [ ] **Step 2: Append action and diagnostics events**

In action and diagnostics paths, append small JSONL events shaped like:

```ts
{
  ts: new Date().toISOString(),
  command: 'click',
  sessionName,
  pageId,
  navigationId,
  diagnosticsDelta,
}
```

Do not build a search system here. Only allocate the directory and append events.

- [ ] **Step 3: Add default-path fallback for screenshot/download**

If `--path` and `--dir` are absent:

- screenshot writes to `<runDir>/screenshot-<timestamp>.png`
- download copies to `<runDir>/<suggestedFilename>`

Return the saved path in command output.

- [ ] **Step 4: Verify run-dir behavior**

Run:

```bash
node dist/cli.js session create run-a --open http://127.0.0.1:4123
node dist/cli.js screenshot --session run-a
node dist/cli.js click --selector '#trigger-download' --session run-a
```

Expected:

- `.pwcli/runs/<runId>/events.jsonl` exists
- screenshot saved without explicit `--path`
- download saved without explicit `--path/--dir`

- [ ] **Step 5: Commit**

```bash
git add src/infra/fs/run-artifacts.ts src/app/output.ts src/infra/playwright/runtime .claude/project/07-artifacts-diagnostics.md README.md
git commit -m "feat: add minimum evidence run directory"
```

## 7. Task 6: Add Smoke / Dogfood Gate

**Files:**
- Create: `/Users/xd/work/tools/pwcli/scripts/smoke/pwcli-smoke.sh`
- Modify: `/Users/xd/work/tools/pwcli/package.json`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/08-manual-verification.md`

- [ ] **Step 1: Create smoke script**

Create `/Users/xd/work/tools/pwcli/scripts/smoke/pwcli-smoke.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

pnpm typecheck
pnpm build
node dist/cli.js --help >/dev/null
node dist/cli.js skill path >/dev/null
node dist/cli.js plugin list >/dev/null
node dist/cli.js session create smoke1 --open https://example.com >/dev/null
node dist/cli.js snapshot --session smoke1 >/dev/null
node dist/cli.js observe status --session smoke1 >/dev/null
node dist/cli.js state save --session smoke1 /tmp/pwcli-smoke-state.json >/dev/null
node dist/cli.js session close smoke1 >/dev/null
```

- [ ] **Step 2: Add package script**

Add to `/Users/xd/work/tools/pwcli/package.json`:

```json
"smoke": "bash scripts/smoke/pwcli-smoke.sh"
```

- [ ] **Step 3: Verify smoke locally**

Run:

```bash
pnpm smoke
```

Expected:

- zero exit code
- no manual intervention needed for the script

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke/pwcli-smoke.sh package.json .claude/project/08-manual-verification.md
git commit -m "chore: add pwcli smoke gate"
```

## 8. Self-Review

### Spec coverage

This plan covers the active P0 / P1 items that do not require a product decision:

- agent contract sync
- runtime split
- action diagnostics delta
- modal blocked productization
- minimum run directory
- smoke gate

It intentionally excludes:

- `connect` deletion
- `auth` ownership changes
- `batch` JSON mode
- raw CDP substrate
- observe stream
- HAR hot recording

### Placeholder scan

No `TODO` / `TBD` placeholders remain. Deferred items are explicitly excluded from scope.

### Type consistency

The new runtime lane file names and exported function names match the existing service naming:

- `managedStateSave`
- `managedObserveStatus`
- `managedPageCurrent`
- `managedClick`
- `managedBootstrapApply`

No new naming fork is introduced.

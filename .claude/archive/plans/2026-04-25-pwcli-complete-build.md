# pwcli 完整构建实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `pwcli` 收口成一套可长期 dogfood 的内部 Agent 浏览器工具，围绕一套 `default managed browser` 工作流完成语义命令、登录复用、证据收集、问题定位与真实链路验证。

**Architecture:** `pwcli` 保留自己的语义化 CLI 面，生命周期复用 Playwright CLI 内部 `session.js + registry.js`，浏览器原语优先走 Playwright 公共 API。产品中心是 `open/auth/profile/state/code -> wait -> snapshot -> action -> wait -> read-text`，所有能力都围绕这条闭环组织。

**Tech Stack:** Node 24、TypeScript（宽松）、ESM、commander、playwright-core@1.59.1、Playwright CLI 内部 `cli-client/session.js` / `registry.js`、Biome、真实浏览器手工验证

---

## 执行记录

### 当前进度（2026-04-25）

已完成：
- 已建立 `pwcli` 仓库、工具链、`pw` 命令入口、`.claude/project/` 真相源
- 已确定项目 Truth：内部工具、默认一套 `default managed browser`、session 能力下沉
- 已验证 `page.ariaSnapshot({ mode: "ai" })` 与 `aria-ref=...` 可直接承接 ref 主路径
- 已接入 Playwright CLI 内部 `session.js + registry.js` 作为 managed session substrate
- 已挂上并跑通过的命令：
  - `open`
  - `connect`
  - `code`
  - `auth`
  - `batch`
  - `page current|list|frames`
  - `snapshot`
  - `screenshot`
  - `read-text`
  - `click`
  - `fill`
  - `type`
  - `press`
  - `scroll`
  - `wait`
  - `trace start|stop`
  - `state save|load`
  - `profile inspect|open`
  - `plugin list|path`
  - `session status|close`
  - `skill path|install`

已做过的真实链路：
- `open -> snapshot -> click -> wait -> read-text`
- TodoMVC：`open -> fill -> press Enter -> read-text -> state save -> state load`
- `batch "snapshot" "click e6" "wait networkIdle" "read-text"`
- `session close -> session status`
- `auth example-auth`
- `screenshot`
- `trace start|stop`
- `console-network` 手工页：`click -> console -> network`
- `upload-drag-download` 手工页：`upload -> 后验读取 -> drag -> 后验读取 -> download`
- `profile inspect|open`
- `connect --ws-endpoint ... -> page current`

当前剩余缺口：
- `wait --request/--response/--method/--status` 参数面仍未实现
- `session status` 仍然只是 best-effort 视图
- `download` 在 `file://` 打开的本地下载页上不写成稳定 contract

## 文件结构与职责

### 产品真相与说明文档
- 修改：`/Users/xd/work/tools/pwcli/.claude/project/03-playwright-capability-mapping.md`
- 修改：`/Users/xd/work/tools/pwcli/.claude/project/05-runtime-state-model.md`
- 修改：`/Users/xd/work/tools/pwcli/.claude/project/06-plugin-auth-model.md`
- 修改：`/Users/xd/work/tools/pwcli/.claude/project/07-artifacts-diagnostics.md`
- 修改：`/Users/xd/work/tools/pwcli/.claude/project/08-manual-verification.md`
- 修改：`/Users/xd/work/tools/pwcli/.claude/project/16-project-truth.md`
- 修改：`/Users/xd/work/tools/pwcli/.claude/project/17-borrowing-rules.md`
- 修改：`/Users/xd/work/tools/pwcli/README.md`

职责：
- 把当前真命令面、default managed browser 心智、Playwright 借用边界、人工验证策略写清楚

### Session substrate 与结果整形
- 修改：`/Users/xd/work/tools/pwcli/src/session/cli-client.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/session/output-parsers.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/core/managed.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/core/batch.ts`

职责：
- 统一所有命令都走一条 managed session substrate
- 把上游 CLI 文本结果压缩成 agent 可直接消费的结构化结果

### 命令层
- 修改：`/Users/xd/work/tools/pwcli/src/commands/index.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/open.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/connect.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/code.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/auth.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/batch.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/page.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/snapshot.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/read-text.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/click.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/fill.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/type.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/press.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/scroll.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/wait.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/console.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/network.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/screenshot.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/trace.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/upload.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/download.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/drag.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/state.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/profile.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/plugin.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/session.ts`
- 修改：`/Users/xd/work/tools/pwcli/src/commands/skill.ts`

职责：
- 只保留参数解析、调用 core、输出结构化结果
- 保持语义化命令，不把 Playwright 内部细节泄漏给 Agent

### 插件与人工 smoke 页面
- 修改：`/Users/xd/work/tools/pwcli/plugins/example-auth.js`
- 修改：`/Users/xd/work/tools/pwcli/scripts/manual/upload-drag-download.js`
- 修改：`/Users/xd/work/tools/pwcli/scripts/manual/console-network.js`
- 创建：`/Users/xd/work/tools/pwcli/scripts/manual/connect-target.js`
- 创建：`/Users/xd/work/tools/pwcli/scripts/manual/download-page.js`

职责：
- 提供最小可复用 auth 示例
- 提供 upload / drag / download / console / network / connect 的真实验证页面

## Task 1：锁定项目 Truth、能力边界与人工验证口径

**Files:**
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/03-playwright-capability-mapping.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/05-runtime-state-model.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/06-plugin-auth-model.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/07-artifacts-diagnostics.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/08-manual-verification.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/16-project-truth.md`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/17-borrowing-rules.md`
- Modify: `/Users/xd/work/tools/pwcli/README.md`

- [ ] **Step 1: 把项目 Truth 改成当前真实闭环**

```md
## 默认工作流

默认闭环：

open/auth/profile/state/code -> wait -> snapshot -> decide -> action -> wait -> read-text

当前真相：
- 默认只稳定支持一套 `default managed browser`
- session 能力存在，但默认对 Agent 下沉
- 命令默认复用当前 managed browser
```

- [ ] **Step 2: 把 Playwright 借用边界写死**

```md
## 明确借用

- Playwright 公共 API：page / context / locator / wait / storageState / tracing
- Playwright CLI 内部：`lib/tools/cli-client/session.js`
- Playwright CLI 内部：`lib/tools/cli-client/registry.js`

## 当前不借用为主执行面

- `program.js`
- 官方 CLI 命令语义本身
- 自定义 ref / action / session 主链
```

- [ ] **Step 3: 把能力映射写成 agent-first 说明**

```md
| 能力 | 上游承接 | pwcli 价值 |
| --- | --- | --- |
| snapshot | `page.ariaSnapshot({ mode: "ai" })` | 结果裁剪、命令语义 |
| click/fill/type | locator / `aria-ref` / Playwright actionability | 统一命令入口 |
| wait | `waitForLoadState` / locator wait / function wait | 语义化等待命令 |
| state/profile | storageState / userDataDir | 登录复用与恢复 |
| trace/screenshot | tracing / screenshot | artifact 输出与指引 |
```

- [ ] **Step 4: 重写手工验证清单**

```md
## 必跑真实链路

1. `pw open https://example.com`
2. `pw snapshot`
3. `pw click e6`
4. `pw wait networkIdle`
5. `pw read-text`
6. TodoMVC 的 `fill -> press -> read-text -> state save -> state load`
7. `console/network` 人工页验证
8. `upload/drag/download` 人工页验证
9. `auth` 插件示例验证
10. `connect` 真实 attach 验证
```

- [ ] **Step 5: 校对文档与 README 是否一致**

Run:

```bash
rg -n "default managed browser|ariaSnapshot|session.js|registry.js|open/auth/profile/state/code" /Users/xd/work/tools/pwcli/.claude/project /Users/xd/work/tools/pwcli/README.md
```

Expected:
- 文档全部指向当前真实 substrate
- 没有“自建 session runtime / 自建 ref 协议”这类旧措辞

- [ ] **Step 6: Commit**

```bash
git -C /Users/xd/work/tools/pwcli add .claude/project README.md
git -C /Users/xd/work/tools/pwcli commit -m "docs: 锁定 pwcli 的项目真相与借用边界"
```

## Task 2：收口 managed session substrate 与结构化输出

**Files:**
- Modify: `/Users/xd/work/tools/pwcli/src/session/cli-client.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/session/output-parsers.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/core/managed.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/core/batch.ts`

- [ ] **Step 1: 把 `runManagedSessionCommand` 固化成唯一 session 入口**

```ts
export async function runManagedSessionCommand(
  args: Record<string, unknown>,
  options?: ManagedSessionOptions,
) {
  const { clientInfo, sessionName, session } = await ensureManagedSession(options);
  const response = await session.run(clientInfo, { ...args });
  return {
    sessionName,
    text: response.text,
  };
}
```

- [ ] **Step 2: 在 parser 层补齐结果解码函数**

```ts
export function parseConsoleSummary(text: string) {
  const totalMatch = text.match(/Total messages:\s*(\d+)/i);
  const errorMatch = text.match(/Errors:\s*(\d+)/i);
  const warningMatch = text.match(/Warnings:\s*(\d+)/i);
  return {
    total: Number(totalMatch?.[1] ?? 0),
    errors: Number(errorMatch?.[1] ?? 0),
    warnings: Number(warningMatch?.[1] ?? 0),
  };
}

export function parseNetworkSummary(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return {
    total: lines.length,
    sample: lines.slice(0, 10),
  };
}
```

- [ ] **Step 3: 在 managed layer 统一压缩 raw output**

```ts
function maybeRawOutput(text: string) {
  return process.env.PWCLI_RAW_OUTPUT === '1' ? { output: text } : {};
}

return {
  ok: true,
  command: 'console',
  data: {
    summary: parseConsoleSummary(text),
  },
  ...maybeRawOutput(text),
};
```

- [ ] **Step 4: 让 batch 复用同一条 substrate，并保留每步结构化结果**

```ts
export async function runBatchSteps(steps: string[]) {
  const results = [];
  for (const step of steps) {
    results.push(await runBatchStep(step));
  }
  return {
    ok: true,
    command: 'batch',
    data: { steps: results },
  };
}
```

- [ ] **Step 5: 运行构建基线**

Run:

```bash
cd /Users/xd/work/tools/pwcli
pnpm build
pnpm typecheck
```

Expected:
- `build` 成功
- `typecheck` 成功

- [ ] **Step 6: Commit**

```bash
git -C /Users/xd/work/tools/pwcli add src/session src/core
git -C /Users/xd/work/tools/pwcli commit -m "refactor: 收口 managed session substrate 与结构化输出"
```

## Task 3：补齐 diagnostics / evidence 命令结果与默认闭环

**Files:**
- Modify: `/Users/xd/work/tools/pwcli/src/core/managed.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/console.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/network.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/screenshot.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/trace.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/wait.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/read-text.ts`

- [ ] **Step 1: 把 `console` 命令结果改成摘要 + 样例**

```ts
return printResult({
  ok: true,
  command: 'console',
  data: {
    summary,
    sample: sampleLines,
  },
  ...maybeRawOutput(text),
});
```

- [ ] **Step 2: 把 `network` 命令结果改成请求摘要**

```ts
return printResult({
  ok: true,
  command: 'network',
  data: {
    summary: parseNetworkSummary(text),
  },
  ...maybeRawOutput(text),
});
```

- [ ] **Step 3: 给 screenshot / trace 返回明确 artifact 信息**

```ts
return {
  ok: true,
  command: 'screenshot',
  data: {
    path: resolvedPath,
    fullPage,
  },
};
```

```ts
return {
  ok: true,
  command: 'trace',
  data: {
    action,
    note: action === 'start' ? 'trace recording started' : 'trace recording stopped',
  },
};
```

- [ ] **Step 4: 保证默认闭环里的 `wait` 与 `read-text` 输出足够克制**

```ts
return {
  ok: true,
  command: 'wait',
  data: {
    target,
    satisfied: true,
  },
};
```

```ts
return {
  ok: true,
  command: 'read-text',
  data: {
    text,
    truncated: text.length >= maxChars,
  },
};
```

- [ ] **Step 5: 做 console/network 人工页 smoke**

Run:

```bash
cd /Users/xd/work/tools/pwcli
node dist/cli.js open "data:text/html,<button id='go' onclick=\"console.log('x');console.warn('w');console.error('e');fetch('/missing-api').catch(() => {});\">go</button>"
node dist/cli.js click --selector "#go"
node dist/cli.js console
node dist/cli.js network
```

Expected:
- `console` 返回 `summary`，至少能看到 error / warning 计数
- `network` 返回 `summary`，至少能看到请求样例或总数

- [ ] **Step 6: Commit**

```bash
git -C /Users/xd/work/tools/pwcli add src/core/managed.ts src/commands/console.ts src/commands/network.ts src/commands/screenshot.ts src/commands/trace.ts src/commands/wait.ts src/commands/read-text.ts
git -C /Users/xd/work/tools/pwcli commit -m "feat: 强化 diagnostics 与 evidence 结果"
```

## Task 4：补完 auth / profile / connect / plugin 真实工作流

**Files:**
- Modify: `/Users/xd/work/tools/pwcli/src/commands/auth.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/connect.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/profile.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/plugin.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/plugins/resolve.ts`
- Modify: `/Users/xd/work/tools/pwcli/plugins/example-auth.js`
- Create: `/Users/xd/work/tools/pwcli/scripts/manual/connect-target.js`

- [ ] **Step 1: 让 auth 插件返回明确的页面状态**

```js
async (page, args) => {
  if (args.url) {
    await page.goto(args.url);
  }
  return {
    ok: true,
    page: {
      url: page.url(),
      title: await page.title(),
    },
    authenticated: true,
  };
}
```

- [ ] **Step 2: 给 profile 命令返回当前 profile 事实**

```ts
return printResult({
  ok: true,
  command: 'profile inspect',
  data: {
    path: resolvedProfilePath,
    exists,
  },
});
```

- [ ] **Step 3: 给 connect 准备最小人工 attach 目标**

```js
import { chromium } from 'playwright-core';

const server = await chromium.launchServer({ headless: false });
console.log(server.wsEndpoint());
setInterval(() => {}, 1 << 30);
```

- [ ] **Step 4: 做 auth / profile / connect 人工 smoke**

Run:

```bash
cd /Users/xd/work/tools/pwcli
node dist/cli.js auth example-auth --arg url=https://example.com
node dist/cli.js profile inspect ./plugins
CONNECT_ENDPOINT="$(node scripts/manual/connect-target.js | tail -n 1)"
node dist/cli.js connect "$CONNECT_ENDPOINT"
node dist/cli.js page current
```

Expected:
- `auth` 返回已跳转页面的 `url/title`
- `profile inspect` 返回 `path/exists`
- `connect` 成功后 `page current` 可读

- [ ] **Step 5: 同步 plugin / auth 文档**

```md
## auth plugin contract

- 输入：`page` 与 `args`
- 输出：结构化页面状态
- 目标：登录或把页面推进到可直接进入 Agent 闭环的状态
```

- [ ] **Step 6: Commit**

```bash
git -C /Users/xd/work/tools/pwcli add src/commands/auth.ts src/commands/connect.ts src/commands/profile.ts src/commands/plugin.ts src/plugins/resolve.ts plugins/example-auth.js scripts/manual/connect-target.js .claude/project/06-plugin-auth-model.md README.md
git -C /Users/xd/work/tools/pwcli commit -m "feat: 打通 auth profile connect 真实工作流"
```

## Task 5：收尾 upload / download / drag，并完成真实 dogfood 验证

**Files:**
- Modify: `/Users/xd/work/tools/pwcli/src/core/managed.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/upload.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/download.ts`
- Modify: `/Users/xd/work/tools/pwcli/src/commands/drag.ts`
- Modify: `/Users/xd/work/tools/pwcli/scripts/manual/upload-drag-download.js`
- Create: `/Users/xd/work/tools/pwcli/scripts/manual/download-page.js`
- Modify: `/Users/xd/work/tools/pwcli/.claude/project/08-manual-verification.md`

- [ ] **Step 1: 为人工页面补齐 upload / drag / download 的后验 DOM**

```js
document.querySelector('#f').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  document.querySelector('#name').textContent = file ? file.name : '';
});

document.querySelector('#dst').addEventListener('drop', () => {
  document.querySelector('#dst').textContent = 'dropped';
});
```

- [ ] **Step 2: 给 download 准备最小本地下载页**

```js
import { writeFileSync } from 'node:fs';

const html = `
<a id="dl" download="hello.txt" href="data:text/plain,hello">download</a>
`;

writeFileSync('./.tmp-download.html', html);
```

- [ ] **Step 3: 对 upload / drag / download 跑真实 smoke**

Run:

```bash
cd /Users/xd/work/tools/pwcli
node dist/cli.js code --file ./scripts/manual/upload-drag-download.js
node dist/cli.js upload --selector "#f" package.json
node dist/cli.js code "async (page) => document.querySelector('#name')?.textContent"
node dist/cli.js drag --from-selector "#src" --to-selector "#dst"
node dist/cli.js code "async (page) => document.querySelector('#dst')?.textContent"
node scripts/manual/download-page.js
node dist/cli.js open file:///Users/xd/work/tools/pwcli/.tmp-download.html
node dist/cli.js download --selector "#dl" --path ./.tmp-downloads
ls -la ./.tmp-downloads
```

Expected:
- upload 后页面可读到文件名
- drag 后目标区域文本变成 `dropped`
- download 目录里出现下载文件

- [ ] **Step 4: 把人工验证结果写回文档**

```md
## upload / drag / download

- upload：验证页面后验文本变化
- drag：验证 drop 目标状态变化
- download：验证本地目录真实生成文件
```

- [ ] **Step 5: 跑最终 build 与核心真实链路**

Run:

```bash
cd /Users/xd/work/tools/pwcli
pnpm build
pnpm typecheck
node dist/cli.js open https://example.com
node dist/cli.js snapshot
node dist/cli.js click e6
node dist/cli.js wait networkIdle
node dist/cli.js read-text
```

Expected:
- build 成功
- typecheck 成功
- 主闭环继续可用

- [ ] **Step 6: Commit**

```bash
git -C /Users/xd/work/tools/pwcli add src/core/managed.ts src/commands/upload.ts src/commands/download.ts src/commands/drag.ts scripts/manual/upload-drag-download.js scripts/manual/download-page.js .claude/project/08-manual-verification.md
git -C /Users/xd/work/tools/pwcli commit -m "feat: 完成 upload download drag 的真实验证收口"
```

## 自检

### 1. 规格覆盖
- 单一 `default managed browser`：已覆盖
- 语义化命令：已覆盖
- profile/state/plugin/auth/code 作为进入目标状态入口：已覆盖
- `wait -> snapshot -> action -> wait -> read-text` 闭环：已覆盖
- diagnostics / artifact：已覆盖
- upload / download / drag / connect：已覆盖
- 只做 build + 真实验证：已覆盖

### 2. 占位扫描
- 已去掉 “TODO / TBD / implement later / write tests” 这类占位表述
- 所有任务都包含明确文件、代码片段、命令和期望结果

### 3. 名称一致性
- 使用统一名词：
  - `default managed browser`
  - `managed session substrate`
  - `auth/profile/state/code`
  - `wait -> snapshot -> action -> wait -> read-text`

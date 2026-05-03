# CLI 层设计规范（citty 版）

> 驱动 src/cli/ 的完整重写。本文是 Codex 实现 cli/ 的唯一参考。

---

## 一、共享 Args 定义（cli/args.ts）

所有命令通过 spread 复用，保持类型安全：

```ts
// cli/args.ts

// 每个命令都有
export const sessionArg = {
  session: { type: "string", alias: "s", description: "Target managed session", valueHint: "name" },
} as const;

export const outputArg = {
  output: { type: "string", description: "Output format: text|json", default: "text" },
} as const;

// 所有元素定位命令共用（click/fill/type/hover/check/uncheck/select/press/locate/get/is/verify）
export const locatorArgs = {
  ref:         { type: "string", description: "Snapshot aria ref" },
  selector:    { type: "string", description: "CSS selector",         valueHint: "css"  },
  text:        { type: "string", description: "Text content locator", valueHint: "text" },
  role:        { type: "string", description: "ARIA role",            valueHint: "role" },
  name:        { type: "string", description: "Accessible name",      valueHint: "name" },
  label:       { type: "string", description: "Label text",           valueHint: "text" },
  placeholder: { type: "string", description: "Placeholder text",     valueHint: "text" },
  "test-id":   { type: "string", description: "data-testid value",    valueHint: "id",
                 alias: ["testid"] },  // 保留 --testid 作为 agent 兜底别名
  nth:         { type: "string", description: "Element index (1-based)", default: "1" },
} as const;

export const sharedArgs = { ...sessionArg, ...outputArg } as const;
export const actionArgs  = { ...sharedArgs, ...locatorArgs } as const;
```

---

## 二、全局设计规则

1. **每个命令文件**只做三件事：defineCommand → 调 engine → printCommandResult/Error
2. **没有全局 --output**：output 放 sharedArgs，每个命令自己定义
3. **--headed / --no-headed**：删掉 `--headless`，citty 原生 boolean 取反
4. **--trace / --no-trace**：同上，删掉 `--no-trace` 独立 flag
5. **enum 约束**：凡是有限选项集的 string 改为 enum
6. **valueHint**：所有接受具体值的 string 必须加 valueHint
7. **隐藏别名**：通过 alias 数组保留 agent 兜底别名（不在 help 显示视 citty 支持而定）
8. **import 路径**：跨层用别名（#engine/*, #store/*, #auth/*），同层用相对路径

---

## 三、重要命令变更

### 3.1 pw observe → pw status（主名称变更）

`observe` 实际是 session/page **状态总览**，不是"看页面内容"。
新名称 `status` 更准确。在 subCommands 注册时同时注册 `status` 和 `observe`（observe 作为别名兼容）。

```ts
// cli/commands/index.ts
subCommands: {
  status:  () => import("./status.js"),
  observe: () => import("./status.js"),  // 兼容旧用法
  ...
}
```

### 3.2 pw read-text 增加短别名 pw text

在 index.ts 同时注册 `read-text` 和 `text`，指向同一实现。

### 3.3 session create/attach/recreate 的 boolean flag 清理

```ts
// 删掉 --headless，改用 --no-headed
headed:     { type: "boolean", description: "Open headed browser", default: false },
// 删掉 --no-trace 独立 flag，用 --trace/--no-trace（citty boolean pair）
trace:      { type: "boolean", description: "Enable trace recording", default: true },
```

### 3.4 wait 命令 state 改为 enum

```ts
state: {
  type: "enum",
  options: ["visible", "hidden", "stable", "attached", "detached"],
  description: "Wait for element state",
  valueHint: "visible|hidden|stable|attached|detached",
},
```

### 3.5 click/mouse button 改为 enum

```ts
button: {
  type: "enum",
  options: ["left", "right", "middle"],
  description: "Mouse button",
  default: "left",
},
```

### 3.6 screenshot format 改为 enum

```ts
format: {
  type: "enum",
  options: ["png", "jpeg"],
  description: "Image format",
  default: "png",
},
```

---

## 四、完整命令注册表（index.ts subCommands）

所有命令按功能分组，使用 lazy import：

```ts
// 页面观察
snapshot:      () => import("./commands/snapshot.js"),
"read-text":   () => import("./commands/read-text.js"),
text:          () => import("./commands/read-text.js"),   // 短别名
status:        () => import("./commands/status.js"),
observe:       () => import("./commands/status.js"),      // 兼容别名
screenshot:    () => import("./commands/screenshot.js"),
pdf:           () => import("./commands/pdf.js"),
accessibility: () => import("./commands/accessibility.js"),

// 页面结构
page:          () => import("./commands/page.js"),
tab:           () => import("./commands/tab.js"),

// 元素操作
click:         () => import("./commands/click.js"),
fill:          () => import("./commands/fill.js"),
type:          () => import("./commands/type.js"),
press:         () => import("./commands/press.js"),
hover:         () => import("./commands/hover.js"),
check:         () => import("./commands/check.js"),
uncheck:       () => import("./commands/uncheck.js"),
select:        () => import("./commands/select.js"),
drag:          () => import("./commands/drag.js"),
upload:        () => import("./commands/upload.js"),
download:      () => import("./commands/download.js"),

// 页面操作
scroll:        () => import("./commands/scroll.js"),
resize:        () => import("./commands/resize.js"),
mouse:         () => import("./commands/mouse.js"),
dialog:        () => import("./commands/dialog.js"),
open:          () => import("./commands/open.js"),

// 状态查询
locate:        () => import("./commands/locate.js"),
get:           () => import("./commands/get.js"),
is:            () => import("./commands/is.js"),
verify:        () => import("./commands/verify.js"),
wait:          () => import("./commands/wait.js"),

// 诊断
console:       () => import("./commands/console.js"),
network:       () => import("./commands/network.js"),
errors:        () => import("./commands/errors.js"),
diagnostics:   () => import("./commands/diagnostics.js"),
trace:         () => import("./commands/trace.js"),
har:           () => import("./commands/har.js"),
route:         () => import("./commands/route.js"),
sse:           () => import("./commands/sse.js"),

// Auth / State
auth:          () => import("./commands/auth.js"),
state:         () => import("./commands/state.js"),
storage:       () => import("./commands/storage.js"),
cookies:       () => import("./commands/cookies.js"),

// Session
session:       () => import("./commands/session.js"),

// 系统
profile:       () => import("./commands/profile.js"),
environment:   () => import("./commands/environment.js"),
doctor:        () => import("./commands/doctor.js"),
bootstrap:     () => import("./commands/bootstrap.js"),
batch:         () => import("./commands/batch.js"),
code:          () => import("./commands/code.js"),
video:         () => import("./commands/video.js"),
skill:         () => import("./commands/skill.js"),
dashboard:     () => import("./commands/dashboard.js"),
```

---

## 五、每个命令文件的标准结构

```ts
// cli/commands/click.ts
import { defineCommand } from "citty";
import { managedClick } from "#engine/act/element.js";
import { printCommandResult, printCommandError } from "#cli/output.js";
import { requireSessionName } from "#cli/parsers/session.js";
import { actionArgs, sharedArgs } from "#cli/args.js";

export default defineCommand({
  meta: { name: "click", description: "Click an element by ref, selector, or semantic locator" },
  args: {
    ...actionArgs,   // session + output + all locator args
    button: {
      type: "enum",
      options: ["left", "right", "middle"],
      description: "Mouse button",
      default: "left",
    },
  },
  async run({ args }) {
    const sessionName = requireSessionName(args.session);
    try {
      const result = await managedClick({
        sessionName,
        ref:         args.ref,
        selector:    args.selector,
        nth:         Number(args.nth ?? 1),
        semantic:    buildSemantic(args),  // 从 locator args 组装 semantic target
        button:      args.button !== "left" ? args.button : undefined,
      });
      printCommandResult("click", result, args.output);
    } catch (error) {
      printCommandError("click", error, args.output);
    }
  },
});
```

---

## 六、cli/parsers/ 设计

### cli/parsers/session.ts
- `requireSessionName(session?: string): string` — 验证 session name，抛错误码
- `printSessionAwareCommandError(...)` — 包含 session 上下文的错误打印

### cli/parsers/target.ts
- `parseStateTarget(args): StateTarget` — 从 locatorArgs 组装 StateTarget
- `buildSemanticTarget(args): SemanticTarget | undefined` — 组装语义定位

### cli/parsers/batch.ts
- `parseBatchSemanticArgs(args): SemanticTarget | undefined`
- `parseBatchStateTarget(args): StateTarget`

---

## 七、cli/batch/ 设计

### cli/batch/plan.ts
从 run-batch.ts 提取：analyzeBatchPlan, findInvalidBatchStep, SUPPORTED_BATCH_TOP_LEVEL

### cli/batch/executor.ts
从 run-batch.ts 提取：executeBatchStep, runBatch
注意修复已知 P1 bug：
- batch verify 不能用 `as any`，必须校验 assertion 枚举
- batch route load 不能静默丢 matchQuery/matchHeaders/matchJson/patchText/mergeHeaders 字段

---

## 八、src/cli.ts 入口

```ts
#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { CLI_VERSION } from "./version.js";
import subCommands from "#cli/commands/index.js";

const main = defineCommand({
  meta: { name: "pw", version: CLI_VERSION, description: "Agent-first Playwright CLI" },
  subCommands,
});

await runMain(main);
```

---

## 注意事项

- `src_backup/` 是旧代码参考，所有 engine 函数签名不变，只改调用方式
- 不要写 commander 的任何 import
- 所有命令文件不超过 80 行（thin adapter 原则）
- 凡是有疑问的 engine 函数，去 src/engine/ 确认导出名称

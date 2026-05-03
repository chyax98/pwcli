/**
 * 验证 citty 能否满足 pwcli 的四个关键需求：
 * 1. pw --output json click ...  (全局 flag 传给子命令)
 * 2. -s 作为每个命令的公共短 flag
 * 3. pw session create|attach|recreate (多层嵌套子命令)
 * 4. --help 输出质量
 */

import { defineCommand, runMain, runCommand, renderUsage } from "citty";

// ─── 共享 args（每个命令都要的） ───────────────────────────────────────────
const sharedArgs = {
  session: { type: "string" as const, alias: "s", description: "Target managed session" },
  output:  { type: "string" as const, description: "Output format: text|json", default: "text" },
} as const;

// ─── 验证1：嵌套子命令 pw session create|attach ─────────────────────────
const sessionCreate = defineCommand({
  meta: { name: "create", description: "Create a new managed session" },
  args: {
    ...sharedArgs,
    headed:  { type: "boolean" as const, description: "Open headed browser" },
    profile: { type: "string"  as const, description: "Browser profile path" },
    open:    { type: "string"  as const, description: "URL to open", valueHint: "url" },
  },
  run({ args }) {
    console.log("✅ session create 可以运行");
    console.log("   session:", args.session);     // string | undefined ← 类型安全
    console.log("   headed:",  args.headed);      // boolean | undefined
    console.log("   output:",  args.output);      // string (default "text")
    console.log("   open:",    args.open);        // string | undefined
  },
});

const sessionAttach = defineCommand({
  meta: { name: "attach", description: "Attach to an existing session" },
  args: { ...sharedArgs },
  run({ args }) {
    console.log("✅ session attach:", args.session);
  },
});

const sessionCmd = defineCommand({
  meta: { name: "session", description: "Manage browser sessions" },
  subCommands: { create: sessionCreate, attach: sessionAttach },
});

// ─── 验证2：全局 --output + 公共 -s ─────────────────────────────────────
const clickCmd = defineCommand({
  meta: { name: "click", description: "Click an element" },
  args: {
    ...sharedArgs,
    ref:      { type: "string" as const, description: "Aria ref" },
    selector: { type: "string" as const, description: "CSS selector" },
    text:     { type: "string" as const, description: "Text content" },
  },
  run({ args }) {
    console.log("✅ click 可以运行");
    console.log("   session:", args.session);   // -s 短 flag ← 类型安全
    console.log("   output:",  args.output);    // 全局 flag ← 类型安全
    console.log("   ref:",     args.ref);
  },
});

// ─── 验证3：enum 类型约束 ────────────────────────────────────────────────
const snapshotCmd = defineCommand({
  meta: { name: "snapshot", description: "Capture accessibility snapshot" },
  args: {
    ...sharedArgs,
    format: {
      type: "enum" as const,
      options: ["text", "json"] as const,
      description: "Output format",
      default: "text",
    },
  },
  run({ args }) {
    console.log("✅ snapshot format:", args.format); // 'text' | 'json' ← 类型安全
  },
});

// ─── 根命令 ──────────────────────────────────────────────────────────────
const main = defineCommand({
  meta: { name: "pw", version: "0.3.0", description: "Agent-first Playwright CLI" },
  subCommands: {
    session: sessionCmd,
    click:   clickCmd,
    snapshot: snapshotCmd,
  },
});

// ─── 运行测试 ─────────────────────────────────────────────────────────────
const test = process.argv[2];

if (test === "help") {
  // 验证4：--help 输出质量
  console.log("=== pw --help ===");
  console.log(await renderUsage(main));
  console.log("\n=== pw click --help ===");
  console.log(await renderUsage(clickCmd, main));
  console.log("\n=== pw session --help ===");
  console.log(await renderUsage(sessionCmd, main));
} else if (test === "global-flag") {
  // 验证1：pw --output json click -s mysession --ref r1
  console.log("=== 测试 pw --output json click -s mysession --ref r1 ===");
  await runCommand(main, {
    rawArgs: ["--output", "json", "click", "-s", "mysession", "--ref", "r1"],
  });
} else if (test === "nested") {
  // 验证3：pw session create --headed --session newsession
  console.log("=== 测试 pw session create --headed -s newsession ===");
  await runCommand(main, {
    rawArgs: ["session", "create", "--headed", "-s", "newsession"],
  });
} else {
  // 默认全跑
  console.log("=== 测试1：嵌套子命令 ===");
  await runCommand(main, { rawArgs: ["session", "create", "--headed", "-s", "s1", "--open", "https://example.com"] });

  console.log("\n=== 测试2：全局 --output + 公共 -s ===");
  await runCommand(main, { rawArgs: ["click", "-s", "s1", "--ref", "r1", "--output", "json"] });

  console.log("\n=== 测试3：enum 约束 ===");
  await runCommand(main, { rawArgs: ["snapshot", "--format", "json", "-s", "s1"] });

  console.log("\n=== 测试4：--help 输出 ===");
  console.log(await renderUsage(clickCmd, main));

  console.log("\n=== 关键验证：--output 在子命令前的顺序 ===");
  // pw --output json click ... (output 在子命令名之前)
  // citty 是否能正确解析？
  await runCommand(main, { rawArgs: ["--output", "json", "click", "-s", "s1", "--ref", "r2"] }).catch(e => {
    console.log("❌ 全局 flag 前置失败:", e.message);
  });
}

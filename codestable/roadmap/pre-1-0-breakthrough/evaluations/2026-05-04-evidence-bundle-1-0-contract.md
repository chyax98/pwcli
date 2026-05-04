---
doc_type: evaluation
slug: evidence-bundle-1-0-contract
status: completed
created: 2026-05-04
related_roadmap: pre-1-0-breakthrough
roadmap_item: evidence-bundle-1-0-contract
commands: [diagnostics, screenshot, verify]
result: pass
---

# Evidence Bundle 1.0 Contract

## 目标

把 `pw diagnostics bundle` 从“诊断导出”收敛成 1.0 证据包 contract，满足 Agent 交接、bug 复现和后续审查。

## Contract

`manifest.json` 稳定字段：

```ts
{
  schemaVersion: "1.0";
  session: string;
  createdAt: string;
  task?: string;
  commands: string[];
  runIds: string[];
  artifacts: Array<{
    type: "screenshot" | "pdf" | "trace" | "video" | "network" | "console" | "state" | "custom";
    path: string;
    sizeBytes?: number;
  }>;
  summary: {
    status: "pass" | "fail" | "blocked";
    highSignalFindings: string[];
  };
}
```

同一份 manifest 继续包含现有诊断细节：`auditConclusion`、`digest`、`diagnostics`、`latestRunEvents`、`timeline`、`highSignalTimeline`。这是单一实现，不另起第二套兼容结构。

`--out <dir>` 额外写 `handoff.md`，给下一个 Agent 快速读取状态、关键发现、commands、runIds、artifacts 和 next steps。

## 验证

执行：

```bash
pnpm build
pnpm exec tsx scripts/test/verify-failure-run.test.ts
pnpm exec tsx scripts/test/diagnostics-failure-run.test.ts
pnpm exec biome check src/engine/diagnose/export.ts src/cli/commands/diagnostics.ts scripts/test/verify-failure-run.test.ts
```

覆盖：

- `VERIFY_FAILED` 仍写入 run event，bundle `auditConclusion.failedCommand=verify`
- `manifest.schemaVersion=1.0`
- `manifest.session` 和 `manifest.task` 写入
- `summary.status=fail`
- `summary.highSignalFindings` 包含 `verify text failed`
- `commands` 包含 `screenshot` 和 `verify`
- `runIds` 覆盖本次 bundle 范围内 run
- `artifacts` 包含截图路径和非零 `sizeBytes`
- `handoff.md` 包含 schema、task 和关键失败摘要

## 结论

`diagnostics bundle` 已满足 1.0 evidence bundle 最小 contract。后续真实 Agent task matrix 应把 `.pwcli/bundles/<task>/manifest.json` 和 `handoff.md` 作为交接证据入口。

## 已知边界

- browser dialog 阻塞中不能强行 bundle；仍按恢复 SOP：action envelope -> `doctor` -> `dialog accept|dismiss` -> 恢复后 bundle。
- trace/video artifact 只有进入 run event 或后续专项纳入 evidence scope 时才会出现在 bundle `artifacts`。当前 HAR 热录制仍由 `har-trace-1-0-decision` 决定。

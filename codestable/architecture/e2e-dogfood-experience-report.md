# E2E Dogfood Stable Conclusions

更新时间：2026-05-02
状态：active

这份文档只保留 dogfood 后沉淀下来的稳定结论。历史修复流水、阶段计划和 issue 候选不在这里维护。

## 1. 已验证入口

```bash
pnpm smoke
pnpm test:dogfood:e2e
```

Dogfood fixture 和脚本位于：

```text
scripts/e2e/dogfood-server.js
scripts/e2e/pwcli-dogfood-e2e.sh
```

## 2. 已验证能力

- session-first lifecycle 是正确主路：`session create|attach|recreate|close` 收口后，Agent 不需要把 `open` 当 lifecycle。
- `observe status` / `read-text` / `snapshot -i` 是低噪声页面理解主链。
- action 后的 `diagnosticsDelta` + run artifacts 对定位回放有价值。
- `diagnostics digest` 是 bug 复现后的第一诊断入口。
- `diagnostics runs|show|grep|export|bundle` 能把 live session 证据和 run evidence 连接起来。
- `route` / `environment` / `bootstrap` 能支撑受控测试，但应作为第二层能力按需引入。
- `batch` 适合 single-session 串行稳定子集，不应扩成完整 CLI parity。
- `state save|load` 是登录态复用主路；current-origin storage mutation 只适合临时状态调整。

## 3. 当前仍有效限制

- Playwright daemon completion 会在部分 run-code-backed 路径后等待导航/网络稳定；pwcli 用 `RUN_CODE_TIMEOUT` 防止无限等待，但长流程仍应拆成小命令。
- `session recreate` 涉及旧 browser/profile 释放，已加入启动超时保护；失败时不要循环 recreate，同名 session 可换名重建。
- HAR start/stop 仍是 substrate 边界，不是稳定证据录制路径。
- Dialog 恢复只覆盖 browser dialog handle；复杂页面级 modal 仍需 `observe status` / `doctor` / recreate 升级。
- Snapshot refs 只在当前 page/navigation epoch 内有效，跨导航必须重新 `snapshot -i`。

## 4. 对架构的结论

- `skills/pwcli/` 必须维持 Agent 可执行主链，而不是命令百科。
- `docs/architecture/` 只保留架构边界、限制、contract 和稳定结论。
- 诊断能力优先深化 query/export/bundle，不引入第二套录制系统。
- mock/environment/bootstrap 只在确定性测试或复现场景中出现，不进入常规探索默认链路。
- 所有 workspace 写操作继续遵守 stable identity contract：tab 写操作只接受 `pageId`，ref 写操作必须校验 epoch。

## 5. 后续维护

Dogfood 暴露的问题按以下规则处理：

1. 命令行为变化：更新 `skills/pwcli/`。
2. 新 limitation / recoverability：更新 `skills/pwcli/references/failure-recovery.md`。
3. 架构边界变化：更新 `docs/architecture/domain-status.md` 或 ADR。
4. 具体任务、修复流水、候选 issue：放 GitHub issues / PR，不长期保存在 docs。

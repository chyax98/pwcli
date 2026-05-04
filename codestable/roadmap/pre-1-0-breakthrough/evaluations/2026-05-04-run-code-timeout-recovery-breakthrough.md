---
doc_type: evaluation
slug: run-code-timeout-recovery-breakthrough
status: completed
created: 2026-05-04
tags: [pre-1-0, recovery, run-code, timeout, doctor, diagnostics]
related_roadmap: pre-1-0-breakthrough
roadmap_item: run-code-timeout-recovery-breakthrough
---

# RUN_CODE_TIMEOUT Recovery Breakthrough

## 范围

本轮验证并修复 `RUN_CODE_TIMEOUT` 后 Agent 是否能继续恢复：

- `pw code` 长流程超出 25s guard timeout。
- CLI 进程必须及时退出，而不是依赖外层 shell timeout。
- timeout 后 `page current`、`status`、`diagnostics digest`、`doctor` 可恢复。
- timeout 后一等动作和短 `pw code` 可继续执行。
- SOP 保持：不扩大 `pw code` 为长流程 runner，复杂等待拆成一等命令和显式 `wait`。

## 关键发现

受控验证发现 P1：`pw code` 已输出 `RUN_CODE_TIMEOUT` envelope，但当前 CLI 进程没有及时退出，外层 shell 45s 后杀掉进程。session 事实随后可恢复，说明问题在 CLI timeout 退出路径，不是页面事实不可恢复。

Issue：

```text
codestable/issues/2026-05-04-run-code-timeout-cli-hang/
```

## 修复结论

- 带 `timeoutMs` 的 managed session command 改为可控 socket client。
- timeout 触发时主动关闭本次 socket，CLI 及时返回。
- command lock 不再 deferred release，timeout 后恢复命令可立即接管。

## 验证命令

```bash
pnpm build
pnpm check:run-code-timeout
pnpm check:skill
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-breakthrough-items.yaml
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-command-evaluation-matrix.yaml
git diff --check
```

结果：通过。

## 结论

`RUN_CODE_TIMEOUT` 的恢复 contract 现在成立：

1. CLI 返回结构化 timeout error。
2. 调用方不需要依赖外层 shell timeout 杀进程。
3. Agent 可以继续执行 `page current` / `status` / `diagnostics digest`。
4. 业务动作和短 `pw code` 能继续运行。

`auth dc` 真实环境 blocker 仍未自动解除；该 provider 真实登录是否能成功仍归 `auth-dc-real-env-proof-blocked` 后续分析。

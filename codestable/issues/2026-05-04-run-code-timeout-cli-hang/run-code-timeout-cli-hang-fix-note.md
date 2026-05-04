---
doc_type: issue-fix-note
issue: 2026-05-04-run-code-timeout-cli-hang
status: fixed
severity: P1
summary: timeout 路径改为可主动关闭 socket 的 managed session command，RUN_CODE_TIMEOUT 后 CLI 及时退出并可继续恢复读取
tags: [pre-1-0, recovery, run-code, timeout, session]
---

# RUN_CODE_TIMEOUT CLI Hang Fix Note

## 根因

`runManagedSessionCommand` 过去直接调用 Playwright CLI client 的 `Session.run()`，再用外层 `Promise.race` 生成 timeout。`Session.run()` 内部会打开 socket 并在收到 daemon 响应后才关闭连接。

当 `pw code` 的 page function 永不完成时，外层 timeout 能构造 `RUN_CODE_TIMEOUT` 错误，但底层 `Session.run()` 的 socket 仍保持活跃，导致当前 CLI 进程不退出。此前还把原始 operation 挂到 command lock 的 deferred release 上，进一步让 timeout 后的生命周期不清晰。

## 修复

- `runManagedSessionCommand` 对带 `timeoutMs` 的路径改用本地可控 socket client。
- timeout 到达时主动 `connection.close()`，使当前 CLI 进程可以及时退出。
- command lock 不再支持 deferred release；命令返回或 timeout 后直接释放锁，恢复命令可以接管 session。
- 新增 `pnpm check:run-code-timeout`，覆盖：
  - `pw code` 永不完成时返回 `RUN_CODE_TIMEOUT`，且不会被外层 40s timeout 杀掉。
  - timeout 后 `page current` / `status` / `diagnostics digest` 可恢复。
  - timeout 后 `click` 和短 `pw code` 仍可执行。

## 修改文件

- `src/engine/session.ts`
- `scripts/check-run-code-timeout-recovery.js`
- `package.json`

## 验证

```bash
pnpm build
pnpm check:run-code-timeout
```

结果：通过。

## 边界

本修复不把 `pw code` 扩大成长流程 runner。`RUN_CODE_TIMEOUT` 仍表示该命令超过 guard timeout；正确使用方式仍是拆成一等命令和显式 `wait`。

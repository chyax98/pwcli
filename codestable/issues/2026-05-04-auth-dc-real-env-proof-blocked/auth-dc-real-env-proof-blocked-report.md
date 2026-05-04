---
doc_type: issue-report
issue: 2026-05-04-auth-dc-real-env-proof-blocked
status: confirmed
severity: P1
summary: auth dc 真实环境证明未完成，默认入口不可达，明确 targetUrl 尝试触发 RUN_CODE_TIMEOUT 并导致 session probe 失败
tags: [pre-1-0, auth, dc, real-env, blocker]
---

# auth dc 真实环境证明阻塞 Issue Report

## 1. 问题现象

`auth-dc-real-env-proof` 真实验证未能把 `auth dc` 从 documented 推进到 proven。

已观察到两类失败：

- 默认 local-ip 入口返回 `AUTH_FAILED`，内部错误为 `DC_AUTH_URL_UNREACHABLE`，`resolvedBy=local-ip`，页面导航返回 `net::ERR_HTTP_RESPONSE_CODE_FAILURE`。
- 明确 `targetUrl` 入口返回 `AUTH_FAILED`，内部错误为 `RUN_CODE_TIMEOUT`。随后 `page current`、`status`、`diagnostics digest` 读取也超时；`doctor` 返回 `observe-status` fail，session 页面状态不可读。

报告不提交真实 URL、手机号、验证码、cookie、state 或截图。

## 2. 复现步骤

1. 构建后创建临时 session：

   ```bash
   pw session create dcauthp1 --no-headed --output json
   ```

2. 使用 provider 默认目标：

   ```bash
   pw auth dc --session dcauthp1 --output json
   ```

   观察到：`AUTH_FAILED`，message 包含 `DC_AUTH_URL_UNREACHABLE`、`resolvedBy=local-ip` 和 `Pass --arg targetUrl=<forge-url>`。

3. 使用明确 Forge/DC targetUrl：

   ```bash
   pw auth dc --session dcauthp1 --arg targetUrl='<forge-url>' --output json
   ```

   观察到：`AUTH_FAILED`，message 为 `RUN_CODE_TIMEOUT:Code execution exceeded the 25s guard timeout...`。

4. 读取 session 状态：

   ```bash
   pw page current --session dcauthp1 --output json
   pw status --session dcauthp1 --output json
   pw diagnostics digest --session dcauthp1 --output json
   pw doctor --session dcauthp1 --output json
   ```

   观察到：`page current` 返回 `PAGE_CURRENT_FAILED` + `RUN_CODE_TIMEOUT`；`status` / `diagnostics digest` 在 shell 层超时；`doctor` 返回 `observe-status` fail，`pageCount=0`，`currentPageId=null`，`recovery.blocked=false`。

5. 清理：

   ```bash
   pw session close dcauthp1 --output json
   ```

   观察到：session 成功关闭。

复现频率：本轮本机验证稳定复现。

## 3. 期望 vs 实际

**期望行为**：在测试/RND 或明确 Forge/DC 目标中，`auth dc` 能完成 provider 登录链，并用 `read-text`、`auth probe`、`diagnostics digest/bundle` 证明登录后页面可用；如果环境材料不足，应该形成明确 blocker 而不是伪装 proven。

**实际行为**：默认入口不可达；明确 targetUrl 尝试超出 25s guard timeout，且失败后 session probe 不可读，无法生成 1.0 所需真实登录证明。

## 4. 环境信息

- 涉及模块 / 功能：`auth dc` provider、real-env proof、session recovery
- 相关文件 / 函数：`src/auth/dc.ts`、`src/cli/commands/auth.ts`
- 运行环境：local → 测试/RND 入口尝试
- 其他上下文：Node 24 + pnpm 10+ 基线；不为 Volta/proto/node 漂移写产品补丁；证据命令来自 `codestable/roadmap/pre-1-0-breakthrough/drafts/2026-05-04-real-env-access-map.md`

## 5. 严重程度

**P1** — 阻塞 1.0 将 `auth dc` 标成 proven。浏览器主能力不受影响，但 1.0 acceptance 不能把该能力伪装成已验证。

## 备注

下一步建议走标准分析：

- 判断 `RUN_CODE_TIMEOUT` 是 provider 长流程 contract 问题、目标环境响应问题，还是 session/read recovery 问题。
- 如果缺少当前有效测试/RND URL 或账号材料，应把 blocker 明确归类为环境材料缺失。
- 如果 provider 需要超过 25s，应重新设计 provider 内部阶段化流程，而不是提高 timeout 或堆兼容补丁。

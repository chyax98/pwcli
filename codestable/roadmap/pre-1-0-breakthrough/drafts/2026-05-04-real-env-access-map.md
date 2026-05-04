---
doc_type: real-env-access-map
slug: real-env-access-map
status: completed
created: 2026-05-04
tags: [pre-1-0, real-env, rnd, forge, dc, auth, sop]
related_roadmap: pre-1-0-breakthrough
roadmap_item: real-env-access-map
---

# Real Environment Access Map

## 结论

本轮完成测试/RND/Forge/DC 真实验证入口映射和安全记录规则，但不把 `auth dc` 标成 proven。`auth dc` 的真实登录证明必须在下一轮 `auth-dc-real-env-proof` 中产出 pass 证据，或形成正式 blocker issue。

当前可执行入口分为四类：

| 入口 | 用途 | 状态 | 记录规则 |
|---|---|---|---|
| explicit `targetUrl` | 用户或测试/RND 任务给出明确 Forge/DC URL | preferred | 只记录脱敏 `<target-url>` 和 `resolvedBy=targetUrl` |
| existing Forge/DC session | session 当前页已经是 Forge/DC | usable | 只记录 session 名和脱敏当前 URL |
| provider default local-ip | provider 根据本机内网 IP 推导默认 Forge URL | fallback | 只记录 `resolvedBy=local-ip`，不把具体内网 URL 写入 skill |
| system Chrome profile | 人类已登录 Chrome profile 作为起点 | handoff | 只记录 profile 名称来源，不提交 profile/state/cookie |

## 信息源

- `skills/pwcli/references/forge-dc-auth.md`
- `skills/pwcli/references/command-reference-advanced.md`
- `codestable/architecture/commands/session-advanced.md`
- `src/auth/dc.ts`
- `pw auth list --output json`
- `pw auth info dc --output json`

`pw auth info dc` 会暴露 provider contract 和默认参数。CodeStable 与 skill 不复写默认账号、验证码或内部环境 URL；真实验证只记录脱敏占位符和 `resolvedBy`。

## 真实环境验证 SOP

### A. 明确目标 URL

这是下一轮主路。

```bash
pw session create dc-proof --headed
pw auth dc --session dc-proof --arg targetUrl='<forge-or-dc-url>' --output json
pw read-text --session dc-proof --max-chars 1200
pw auth probe --session dc-proof --output json
pw diagnostics digest --session dc-proof --output json
pw diagnostics bundle --session dc-proof --out /tmp/pwcli-auth-dc-proof/bundle --limit 20 --output json
pw session close dc-proof
```

Pass 判据：

- `auth dc` 返回 `ok=true`，`resolvedBy=targetUrl`，`resolvedTargetUrl` 指向脱敏目标。
- `read-text` 能读到 Forge/DC 登录后页面事实，不在登录页。
- `auth probe` 不能是明确 `anonymous`；若为 `uncertain`，必须用页面事实、cookies/storage 或业务页面可见性补证。
- `diagnostics digest` 没有阻断当前主流程的 top signal。
- bundle 可生成，并能用于 Agent handoff。

### B. 已在 Forge/DC 页面

用于用户先开 headed session、或通过 `open` 进入目标页后执行 provider。

```bash
pw page current --session dc-proof --output json
pw auth dc --session dc-proof --output json
pw read-text --session dc-proof --max-chars 1200
pw auth probe --session dc-proof --output json
```

Pass 判据：

- `auth dc` 返回 `resolvedBy=current-page`。
- 页面事实能证明登录后主流程可继续。

### C. 默认目标

仅作为 fallback。默认目标由 provider 本机探测推导，可能受 VPN、内网 DNS、RND 网络和本机 IP 影响。

```bash
pw session create dc-default --headed
pw auth dc --session dc-default --output json
pw read-text --session dc-default --max-chars 1200
pw diagnostics digest --session dc-default --output json
```

如果失败，不直接修代码；先按错误分类：

| 错误 / 现象 | 分类 | 下一步 |
|---|---|---|
| `DC_AUTH_URL_REQUIRED` | 缺目标 | 改走 explicit `targetUrl` |
| `DC_AUTH_URL_UNREACHABLE` | 网络 / VPN / DNS / 目标错误 | 记录 endpoint 脱敏摘要，要求明确测试/RND URL 或建立 blocker |
| `DC_AUTH_LOGIN_URL_NOT_FOUND` | 业务登录入口异常 | 收集 diagnostics 后建立 issue 或改走明确 URL |
| `DC_AUTH_PHONE_LOGIN_FAILED` | 账号/验证码/环境策略 | 不猜账号，要求用户提供材料或建立 blocker |
| 登录后仍在登录页 | auth flow 不完整 | `read-text`、`console`、`network`、`diagnostics bundle` 后分类 |
| challenge / two-factor / interstitial | human handoff | 记录 blocker 或使用 headed human takeover |

### D. System Chrome profile

用于人类已登录或需要人工接管的场景，不替代 provider proof。

```bash
pw profile list-chrome --output json
pw session create dc-profile --from-system-chrome --chrome-profile '<profile-name>' --headed --open '<forge-or-dc-url>'
pw auth probe --session dc-profile --output json
pw read-text --session dc-profile --max-chars 1200
```

约束：

- 不复制、不提交 Chrome profile。
- 不把 system profile 成功当成 `auth dc` provider proven。
- 如果 profile 被 Chrome 占用，关闭 Chrome 或换 profile/session 名；不写兼容补丁。

## 敏感信息边界

禁止提交：

- token、cookie、验证码、手机号、账号、真实 session state。
- `.pwcli/` 下的 browser context、trace、video、bundle 原始物。
- 真实业务页面截图、PDF、HTML、network body，除非已确认脱敏。
- 内部环境完整 URL、IP、业务路径，除非用户明确要求该仓库可记录。

允许记录：

- 脱敏 URL：`<forge-url>`、`<dc-url>`、`<rnd-target-url>`。
- `resolvedBy`、错误码、HTTP status、是否可达。
- bundle 目录在 `/tmp/...` 的路径和 manifest 大小。
- runId、命令序列、pass/fail/blocked 结论。

证据文件建议放在：

```text
/tmp/pwcli-real-env/<scenario>/
```

如需保存 state 仅用于本地连续验证：

```bash
pw auth dc --session dc-proof --save-state /tmp/pwcli-real-env/dc-proof/state.json --arg targetUrl='<forge-url>'
```

`state.json` 不进入 git，不复制到 CodeStable。

## 下一轮 auth-dc proof 验收

`auth-dc-real-env-proof` 必须产出二选一结果。

2026-05-04 实际执行结果已经走 blocked 分支：默认 local-ip 入口 `DC_AUTH_URL_UNREACHABLE`，显式 `targetUrl` 尝试触发 `RUN_CODE_TIMEOUT` 且后续 session probe 不可读。command matrix 当前为 `blocked`，blocker issue 见 `codestable/issues/2026-05-04-auth-dc-real-env-proof-blocked/auth-dc-real-env-proof-blocked-report.md`。

### pass

- 有真实测试/RND 或用户明确目标 URL 的 `auth dc` 命令证据。
- 有登录后页面事实读取。
- 有 `auth probe` 结果和解释。
- 有 `diagnostics digest` / `bundle` handoff。
- 更新 command matrix：`auth dc` 从 `documented` 变为 `proven`。
- 同步 `codestable/architecture/commands/session-advanced.md` 和 `skills/pwcli/references/forge-dc-auth.md`。

### blocked

- 在 `codestable/issues/YYYY-MM-DD-auth-dc-real-env-blocker/` 建 report。
- 说明 blocker 类型：无目标 URL、网络不可达、账号/验证码不可用、challenge/two-factor、provider contract 不匹配、业务登录入口异常。
- 给出下一次解除 blocker 后的最短验证命令。
- command matrix 保持 `blocked`，不能伪装成 `proven`。

## 本轮验证

```bash
pw auth list --output json
pw auth info dc --output json
```

结果：

- provider registry 包含 `dc` 和 `fixture-auth`。
- `dc` provider contract 包含 `phone`、`smsCode`、`targetUrl`、`baseURL`。
- 真实登录未在本轮执行；下一轮必须使用明确测试/RND 目标或记录 blocker。

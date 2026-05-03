---
doc_type: evaluation
slug: command-eval-lifecycle-navigation
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, lifecycle, navigation]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-lifecycle-navigation
---

# Command Evaluation: Lifecycle / Navigation

## 范围

本轮覆盖：

- `session create`
- `session list`
- `session status`
- `session attach`
- `session recreate`
- `session close`
- `open`
- `profile list-chrome`

不扩大范围：

- 不验证真实 Forge/DC 登录态。
- 不提交真实 Chrome profile、cookie、session state。
- 不把 `open` 当 lifecycle；`open` 只在已有 session 中导航。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `session` | proven | 本地 fixture 上完成 create/list/status/attach/recreate/close |
| `open` | proven | 已有 session 内导航到公开页面；未创建新 session |
| `profile` | proven | `profile list-chrome --output json` 返回结构化 profile 列表；未提交真实路径 |

## focused check

本地 fixture：

```bash
node scripts/e2e/dogfood-server.js 43291
```

生命周期主链：

```bash
node dist/cli.js session create life91 --open http://127.0.0.1:43291/login --output json
node dist/cli.js session list --with-page --output json
node dist/cli.js session status life91 --output json
node dist/cli.js open --session life91 http://127.0.0.1:43291/login/mfa --output json
node dist/cli.js session recreate life91 --open http://127.0.0.1:43291/login --output json
node dist/cli.js session close life91 --output json
```

结果：

```text
lifecycle-navigation focused check passed
```

Attach 主链：

```bash
node scripts/manual/attach-target.js
node dist/cli.js session attach lifeatt --browser-url <local-browser-url> --output json
node dist/cli.js read-text --session lifeatt --max-chars 500 --output json
node dist/cli.js session close lifeatt --output json
```

结果：

```text
session attach focused check passed
```

Profile 主链：

```bash
node dist/cli.js profile list-chrome --output json
```

结果：

```text
profile list-chrome focused check passed
```

## 关键发现

- `session create|attach|recreate|close` 是唯一 lifecycle 主路，当前 focused check 成立。
- `open` 的行为是导航已有 session。初次误测把 `open` 导向受保护路径，fixture 正常重定向到 `/login`；改用公开路径后验证通过。这说明评测必须区分 command contract 和页面业务重定向。
- `session attach` 可通过本地 CDP browser URL 验证，不需要真实外部环境。
- `profile list-chrome` 只记录结构化返回是否可用，不记录本机 profile 路径或账号状态。

## 后续

- 在 `real-env-access-map` 和 `auth-dc-real-env-proof` 中再验证真实 profile / auth 相关 workflow。
- 在 `skill-sop-1-0-audit` 中补充“protected URL redirect 不等于 open 失败”的判断规则。

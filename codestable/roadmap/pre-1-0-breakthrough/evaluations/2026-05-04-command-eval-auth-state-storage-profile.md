---
doc_type: evaluation
slug: command-eval-auth-state-storage-profile
status: completed
created: 2026-05-04
tags: [pre-1-0, command-evaluation, auth, state, storage, cookies, profile]
related_roadmap: pre-1-0-breakthrough
roadmap_item: command-eval-auth-state-storage-profile
---

# Command Evaluation: Auth / State / Storage / Profile

## 范围

本轮覆盖登录态和浏览器状态复用命令：

- `auth list`
- `auth info fixture-auth`
- `auth info dc`
- `auth probe`
- `auth fixture-auth --save-state`
- `cookies list|set`
- `storage local get|set|delete|clear`
- `storage session get|set|delete|clear`
- `storage indexeddb export`
- `state save|load|diff`
- `profile list-chrome`

明确不把 `auth dc` 视为 proven。本轮只验证 `auth dc` provider 元信息和参数 contract；真实 Forge/DC 登录链路留给 `real-env-access-map` 和 `auth-dc-real-env-proof`。

## 评估结论

| command | 状态 | 证据 |
|---|---|---|
| `auth list` | proven | 返回内置 providers：`dc`、`fixture-auth` |
| `auth info fixture-auth` | proven | 返回 args、examples、notes 和 provider source |
| `auth info dc` | documented | 返回 provider contract；真实登录链路未在本地 fixture 证明 |
| `auth probe` | proven | login 页返回 `anonymous/high/reauth`，app 页返回 `authenticated/high/continue` |
| `auth fixture-auth` | proven | 写入 cookie + localStorage，并通过 `--save-state` 输出可复用 state |
| `cookies list` | proven | 能列出当前 session cookie，并支持 domain filter |
| `cookies set` | proven | 能写入 current domain cookie，后续 `cookies list` 可见 |
| `storage local` | proven | 覆盖 read / set / get / delete / clear |
| `storage session` | proven | 覆盖 set / get / delete / clear |
| `storage indexeddb export` | proven | 覆盖 database/store filter 和 `--include-records` sampled record |
| `state save` | proven | 保存当前 storage state 文件 |
| `state load` | proven | 新 session load state 后恢复 cookie 和 localStorage |
| `state diff` | proven | 覆盖 baseline、before/after、`--include-values`、IndexedDB metadata 和 value-only changedBuckets |
| `profile list-chrome` | proven | 返回本机 Chrome profile discovery；不提交真实 profile state |

## focused check

本轮使用本地 HTTP fixture：

```bash
pw session create as18082 --no-headed --open http://127.0.0.1:61468/login --output json
pw auth list --output json
pw auth info fixture-auth --output json
pw auth info dc --output json
pw auth probe --session as18082 --output json
pw open http://127.0.0.1:61468/app --session as18082 --output json
pw auth fixture-auth --session as18082 --arg marker=auth-alpha --save-state auth-state.json --output json
pw auth probe --session as18082 --output json
pw cookies list --session as18082 --output json
pw cookies set --session as18082 --name pwcli_extra --value cookie-beta --domain 127.0.0.1 --output json
pw storage local set local-key local-value --session as18082 --output json
pw storage local get local-key --session as18082 --output json
pw storage session set session-key session-value --session as18082 --output json
pw storage session get session-key --session as18082 --output json
pw state save before-state.json --session as18082 --output json
pw state diff --session as18082 --before diff-baseline.json --include-values --output json
pw code --session as18082 '<create IndexedDB pwclidb/items record>' --output json
pw storage indexeddb export --session as18082 --database pwclidb --store items --include-records --limit 5 --output json
pw storage local set local-key local-value-2 --session as18082 --output json
pw cookies set --session as18082 --name pwcli_extra --value cookie-gamma --domain 127.0.0.1 --output json
pw state diff --session as18082 --before diff-baseline.json --after diff-after.json --include-values --output json
pw storage local delete local-key --session as18082 --output json
pw storage session delete session-key --session as18082 --output json
pw storage local clear --session as18082 --output json
pw storage session clear --session as18082 --output json
pw state save final-state.json --session as18082 --output json
pw session create bs20136 --no-headed --output json
pw state load auth-state.json --session bs20136 --output json
pw open http://127.0.0.1:61468/app --session bs20136 --output json
pw storage local --session bs20136 --output json
pw cookies list --session bs20136 --domain 127.0.0.1 --output json
pw profile list-chrome --output json
pw session close as18082 --output json
pw session close bs20136 --output json
```

结果：

```text
evidence directory: /tmp/pwcli-auth-state-eval-MGMP3J
main session: as18082
reload session: bs20136
auth probe login: anonymous / high / reauth
auth probe app: authenticated / high / continue
indexeddb export: pwclidb.items countEstimate=1, sampled id=one
state load reload: localStorage pwcli-auth-marker=auth-alpha, cookie pwcli_auth_marker=auth-alpha
```

## 关键发现

- `auth probe` 对 login 页和 app 页的 heuristic 能区分匿名与已登录状态；高置信判断依赖页面身份信号 + protected resource 信号 + storage 信号。
- `auth fixture-auth` 只用于本地 contract 回归，不是业务登录 provider。
- `auth dc` 的命令 contract 已文档化，但真实链路不能由本地 fixture 替代；后续必须进入测试/RND 环境验证。
- `storage local/session` 是 current-origin 受控状态操作，不替代跨 session 登录态主路。
- `state save|load` 能跨新 session 恢复 cookie + localStorage。
- `state diff --include-values` 评测暴露 P1：value-only localStorage 变化出现在明细中，但 `summary.changedBuckets` 漏报 `localStorage`。已修复并落入 issue/fix-note：
  - `codestable/issues/2026-05-04-state-diff-storage-value-bucket/state-diff-storage-value-bucket-report.md`
  - `codestable/issues/2026-05-04-state-diff-storage-value-bucket/state-diff-storage-value-bucket-fix-note.md`

## 验证

```bash
pnpm build
pnpm exec tsx scripts/test/state-diff.test.ts
```

结果：通过。

## 后续

- `real-env-access-map` 需要明确测试/RND/Forge/DC 入口、账号材料边界和脱敏证据规则。
- `auth-dc-real-env-proof` 必须把 `auth dc` 从 documented 推进到 proven，或形成正式环境 blocker。

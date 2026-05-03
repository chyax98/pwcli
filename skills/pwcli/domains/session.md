# Session Domain

适用：浏览器生命周期、接管、重建、清理和人类观察。

精确参数见：

- `../references/command-reference.md`
- `../references/command-reference-advanced.md`
- `../references/failure-recovery.md`

## 边界

Session domain 只回答一个问题：**浏览器任务上下文如何存在、复用、接管、重建、结束**。

拥有：

- `session create|attach|recreate|list|status|close`
- `dashboard open`
- named session 约束和 lifecycle 主路

不拥有：

- URL 导航细节：用 `open`
- 页面动作：用 interaction commands
- 登录执行：用 `auth`
- 状态保存/读取：用 `state` / `cookies` / `storage`
- 诊断查询：用 diagnostics commands

## 决策规则

1. 新任务 / 新系统 / 新 URL 空间 / 新登录态：`session create`。
2. 用户明确说继续旧页面：`session list --with-page` 后复用。
3. 已有 session 换 URL：`open`，不要 recreate。
4. 需要改变 headed/non-headed/profile/state shape：`session recreate`。
5. 需要接管已有 browser endpoint：`session attach` 或 attachable flow。
6. 需要人类观察多 session：`dashboard open`，不要放进 Agent 自动化主链。

## 常见误用

| 误用 | 正确做法 |
|---|---|
| 用 `open` 创建 session | 先 `session create` |
| 让 `auth` 决定 headed/profile/state | session lifecycle 先建好 shape，再 auth |
| 同时并发 create/recreate/close 同名 session | 串行执行，遇 `SESSION_BUSY` 等待后复查 |
| 用 tab index/title 关闭页面 | `page list` 找 `pageId`，再 `tab close <pageId>` |
| 反复 recreate 试图解决 profile lock | 换 session 名或先关闭占用 profile 的 Chrome |

## 恢复路径

- session 不存在：`pw session list` → `pw session create <name> --open '<url>'`
- session 忙：`pw session status <name>`，等待后重试；不要并发同名 lifecycle。
- recreate startup timeout：换 session 名 create；使用系统 Chrome profile 时先关闭 Chrome 或换 profile。
- dashboard 不可用：用 `session list --with-page` / `page list` 作为 CLI fallback。

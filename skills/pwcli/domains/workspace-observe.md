# Workspace / Observe Domain

适用：读取当前 browser workspace、页面、tab、frame、dialog 和页面摘要。

精确参数见：

- `../references/command-reference.md`
- `../references/failure-recovery.md`

## 边界

Workspace/Observe domain 只处理 **当前 session 里有哪些页面、当前页是什么、页面有没有阻断状态**。

拥有：

- `observe status`
- `page current|list|frames|dialogs|assess`
- `tab select|close <pageId>`
- workspace/page/frame/dialog projection

不拥有：

- 页面动作
- 页面结构 ref 生成（用 `snapshot`）
- diagnostics 细查
- auth/state 判断

## 决策规则

1. 新页面先 `observe status`，再 `read-text` / `snapshot -i`。
2. 多 tab 先 `page list` 找 `pageId`。
3. tab 写操作只用 `pageId`，不要用 index/title/URL substring。
4. dialog 先看 `page dialogs` / `observe status`，再 `dialog accept|dismiss`。
5. `page assess` 只读 compact summary，不是 planner。

## 常见误用

| 误用 | 正确做法 |
|---|---|
| 用 tab index 关闭页面 | `page list` → `tab close <pageId>` |
| 把 `page assess` 当动作计划器 | 只把它当页面摘要 hints |
| 看到 dialog 后继续 click | 先恢复 dialog |
| 用 `observe status` 替代 diagnostics | bug 细查用 diagnostics |

## 恢复路径

- 页面状态不明：`observe status -s <name>`。
- 多页面混乱：`page list -s <name>`，按 `pageId` select。
- dialog 阻塞：`page dialogs` → `dialog accept|dismiss`。
- 页面级 modal：结合 `observe status` 的 modal summary 和 `read-text` 判断；必要时 `doctor` / recreate。

# Workspace Mutation Contract

状态：implemented
更新时间：2026-04-28

## 目标

把 workspace 写操作 contract 定死，避免再长出第二套 workspace 心智。

## 当前基础

当前只读投影已经稳定：

- `page current`
- `page list`
- `page frames`
- `page dialogs`
- `observe status`

当前写操作已经稳定：

- `tab select <pageId>`
- `tab close <pageId>`
- ref-backed interaction writes (`click` / `fill` / `type`) guarded by snapshot epoch

运行时里已经存在这些 identity：

- `pageId`
- `navigationId`
- `currentPageId`
- `currentNavigationId`
- `openerPageId`

## 决策

### 1. Stable target identity

workspace mutation 唯一稳定 target id 用：

- `pageId`

理由：

- `pageId` 已在 runtime projection 中稳定存在
- `navigationId` 会因为导航变化
- index 只是当前顺序投影，不适合作为 mutation 主键

### 2. `tab select`

接受：

- `pageId`

而不是：

- index
- title
- URL substring

这些都只能作为读侧辅助信息，不适合作为 mutation contract。

### 3. `tab close`

`tab close <pageId>` 关闭当前 active target 后，回退规则固定为：

1. 优先回退到同一 opener chain 的 opener
2. 否则回退到当前 context.pages() 顺序里的前一个可用 page
3. 如果没有前一个，则回退到下一个可用 page
4. 如果都没有，则 workspace 为空

### 4. popup / opener 关系

popup / opener 关系继续通过：

- `openerPageId`

表达。

关闭 popup 后回到 opener 沿用这条关系，不再发明新字段。

### 5. dialog / modal 对 active target 的影响

当前 `page dialogs` 只是事件投影，不是 authoritative live dialog set。

所以在 mutation contract 里：

- browser dialog 不改变 active `pageId`
- modal blockage 是 interaction / recovery 问题
- 不是 workspace target routing 问题

### 6. Snapshot ref epoch

Ref-backed writes require a fresh snapshot epoch for the active page identity. A ref is not a stable cross-navigation identifier.

`snapshot` records the latest ref epoch in the managed browser context with:

- `snapshotId`
- `pageId`
- `navigationId`
- `url`
- captured refs

`click` / `fill` / `type` ref paths must validate the ref against that latest epoch before reporting `acted` / `filled` / `typed` success. Missing snapshot, missing ref, page switch, and navigation change all fail as `REF_STALE`.

## 当前结论

`tab select|close` 已进入主线实现。

保持的硬规则：

1. 写操作只接受 `pageId`
2. index / title / URL substring 只做读侧辅助信息
3. 关闭 active target 后按 opener、前一个 page、后一个 page 的顺序回退
4. browser dialog 不改变 active `pageId`
5. ref-backed writes only accept refs from the latest snapshot epoch of the active page/navigation identity

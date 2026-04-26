# Workspace Mutation Contract

状态：accepted  
更新时间：2026-04-27

## 目标

在真正实现 `tab select|close` 之前，先把 workspace 写操作 contract 定死，避免再长出第二套 workspace 心智。

## 当前只读基础

当前只读投影已经稳定：

- `page current`
- `page list`
- `page frames`
- `page dialogs`
- `observe status`

运行时里已经存在这些 identity：

- `pageId`
- `navigationId`
- `currentPageId`
- `currentNavigationId`
- `openerPageId`

## 决策

### 1. Stable target identity

未来如果做 workspace mutation，唯一稳定 target id 用：

- `pageId`

理由：

- `pageId` 已在 runtime projection 中稳定存在
- `navigationId` 会因为导航变化
- index 只是当前顺序投影，不适合作为 mutation 主键

### 2. `tab select`

如果以后实现，应该接受：

- `pageId`

而不是：

- index
- title
- URL substring

这些都只能作为读侧辅助信息，不适合作为 mutation contract。

### 3. `tab close`

如果以后实现 `tab close <pageId>`，active target 回退规则固定为：

1. 优先回退到同一 opener chain 的 opener
2. 否则回退到当前 context.pages() 顺序里的前一个可用 page
3. 如果没有前一个，则回退到下一个可用 page
4. 如果都没有，则 workspace 为空

### 4. popup / opener 关系

popup / opener 关系继续通过：

- `openerPageId`

表达。

如果 future mutation 需要“关闭 popup 后回到 opener”，就沿用这条关系，不再发明新字段。

### 5. dialog / modal 对 active target 的影响

当前 `page dialogs` 只是事件投影，不是 authoritative live dialog set。

所以在 future mutation contract 里：

- browser dialog 不改变 active `pageId`
- modal blockage 是 interaction / recovery 问题
- 不是 workspace target routing 问题

## 当前结论

这份 contract 已经足够支撑 future implementation。

但当前仍然 **不直接进入主线实现**，原因是：

- 当前真实高频场景仍以只读 workspace + interaction 为主
- 还没有足够多的 Agent-first 场景证明 `tab select|close` 值得进入第一层命令面

## 进入主线的条件

只有同时满足下面条件，才建议补命令：

1. 真实任务里频繁出现多 tab 切换
2. `page list/current` + `click/open` 不能稳定替代
3. skill 里能明确教清楚 `pageId` 主路

在此之前，继续保持只读 projection 即可。

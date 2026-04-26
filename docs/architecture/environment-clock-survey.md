# Environment Clock Survey

状态：accepted  
更新时间：2026-04-27

## 结论

`clock set` 值得继续做，而且当前 Playwright Core 已经存在低成本稳路径。

最终落地：

- `pw environment clock install`
- `pw environment clock set`
- `pw environment clock resume`

当前 `clock set` 已不再作为 limitation 暴露。

## round2 调研结论

### 1. 之前为什么失败

之前实现把 `clock set` 建模成：

- 先 `install`
- 再 `pauseAt(iso)`

问题在于 `pauseAt()` 的语义并不适合我们对 `clock set` 的期望。

`pauseAt()` 更接近：

- 让时间跳到某个时刻
- 然后停住

这更像“暂停到某个时刻”，不是“把当前时间设成某个值”。

同时，Playwright 自己在类型文档里明确把：

- `setFixedTime()`
- `setSystemTime()`

作为更简单直接的时间设定路径。

### 2. 当前采用的稳定路径

当前实现改成：

1. 仍然要求先 `clock install`
2. `clock set` 优先走：
   - `clock.setFixedTime()`
3. 如果当前 substrate 只有：
   - `clock.setSystemTime()`
   则回退到它

这样更贴近命令心智：

- `install`：安装 fake timers
- `set`：把当前时间设到目标值
- `resume`：恢复时间继续流动

### 3. 为什么现在认为值得进入主线

- 这是 Playwright Core 已有的一层能力
- 不需要引入 raw CDP substrate
- 不需要引入第二套 environment runtime
- smoke / dogfood 已经验证通过

## 当前 contract

### `clock install`

- 安装 fake timers

### `clock set <iso>`

- 要求先 `clock install`
- 将当前时间设到目标 ISO 时间
- 当前实现不会把 clock 状态标成 paused

### `clock resume`

- 恢复时间继续流动

## 仍然后置的内容

虽然 `clock set` 已支持，但下面这些仍然不进入当前主线：

- `fastForward`
- `runFor`
- 明确的 pause / freeze / advance 语义分拆
- 更复杂的时间编排 DSL

如果未来 Agent 真有高频时间驱动场景，再考虑追加命令面。

# ADR-002 Diagnostics, Mock, And Environment

状态：accepted  
更新时间：2026-05-04

## 决策

`pwcli` 先把信息面做深，再扩更重的录制和 runtime 面。

当前主路：

- diagnostics 走 query/export/run-scoped replay
- mock 继续沿 `route` 主路增强
- environment 先做 Playwright public API 直映射

明确后置：

- raw CDP named-session substrate
- observe stream
- HAR 热录制
- workspace 写操作

## 原因

当前真实场景只有两类：

1. 找 bug / 定位 bug / 修 bug
2. 做确定性的浏览器自动化

这两类场景最值钱的能力不是更多录制开关，而是：

- 动作后立即拿到 diagnostics
- 能把 request / console / error 查出来
- 能快速 mock 某类请求
- 能复现 offline / geolocation / permission / time 相关边界

## 当前实现口径

### diagnostics

- `console`
- `network`
- `errors recent|clear`
- `diagnostics digest`
- `diagnostics export`
- `diagnostics bundle`
- `diagnostics runs|show|grep`
- `diagnostics timeline`
- `sse`
- action 结果里的 `diagnosticsDelta`

### mock

- `route list`
- `route add`
- `route remove`
- `batch` 内部 route load 子集；顶层 `pw route load` 不是 shipped command
- 第二层当前已覆盖：
  - body substring matching
  - query / header / JSON body matcher
  - request header inject + continue
  - upstream JSON/text response patch、status override、response header merge

### environment

- `offline on|off`
- `geolocation set`
- `permissions grant|clear`
- `clock install|set|resume`

## 当前取舍

### 收益

- 实现成本可控
- 命令和 Playwright Core 的关系清楚
- 诊断和复现已经能闭环

### 代价

- 没有事件流
- 没有通用 raw CDP 接管
- 没有稳定 HAR 热录制
- 不把 route/mock 扩成通用 DSL 或第二套 runner

## 扩展方向

后续如果要继续扩，只按下面顺序：

1. diagnostics 查询更深
   - 时间范围
   - field projection
   - body 裁剪
2. mock 第二层继续深化
   - query / header / json-body matching 是否值得继续扩
   - response patch 是否需要 header merge 或 text patch
3. environment substrate 继续深化
   - 是否补 `fastForward` / `runFor` / explicit pause

只有在这些完成后，才讨论 observe stream 或 raw CDP substrate。

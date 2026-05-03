# Mock / Controlled Testing Domain

适用：用 route/mock、environment、bootstrap 让页面行为更确定，便于复现和验证。

精确参数见：

- `../references/command-reference-diagnostics.md`
- `../references/command-reference-advanced.md`
- `../workflows/controlled-testing.md`

## 边界

Controlled testing 只在需要确定性时引入，不是常规探索默认链路。

拥有：

- route fulfill / abort / patch / header injection
- route file loading
- environment offline/geolocation/permissions/clock
- bootstrap init script / headers
- 动作后的 verify / diagnostics 证据闭环

不拥有：

- 通用场景平台
- GraphQL planner
- 复杂 schema matcher
- 第二套测试框架

## 决策规则

1. 先确认真实页面状态，再决定是否引入 mock。
2. 只 mock 当前验证所需的最小接口。
3. route 改响应，environment 改浏览器运行条件，bootstrap 改页面启动条件。
4. mock 后必须 `route list` 或通过 network/页面结果验证命中。
5. 测完清理 route，避免污染后续步骤。

## 常见误用

| 误用 | 正确做法 |
|---|---|
| 一开始就大面积 mock route | 先观察真实页面，再用最小 `route add`；多条规则用 `batch` 编排 |
| 用 route 替代 bug 诊断 | 先复现真实失败并导出证据 |
| mock 后不验证命中 | 查 `network` / 页面文本 / route list |
| route 留在 session 里继续探索 | 测完 `route remove` |
| 把 batch 当完整测试框架 | batch 只做 single-session 稳定子集 |

## 恢复路径

- mock 未命中：检查 URL pattern、method、query/header/body matcher。
- patch 无效：查 upstream response content-type 和 `network --url`。
- route 污染：`route remove -s <name>` 清理全部或指定 pattern。
- 结果不确定：导出 `diagnostics export --section network` 留证据。

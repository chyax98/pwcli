# Code Escape Hatch Domain

适用：一等命令不够时，用 `pw code` 在 managed session 里执行小段 Playwright 代码。

精确参数见：

- `../references/command-reference-advanced.md`
- `../references/failure-recovery.md`

## 边界

`pw code` 是 escape hatch，不是第二套产品 API。

适合：

- 一次读取多个 DOM / localStorage / computed state
- 快速验证 selector 或页面假设
- 组合少量 Playwright 逻辑
- 一等命令暂未覆盖的 Playwright primitive

不适合：

- 长时间流程编排
- 替代 diagnostics/query/export
- 绕过 auth provider 机制
- 写成持久脚本管理平台

## 决策规则

1. 高频动作和证据链优先用一等命令。
2. 需要多个读取合并时用 `pw code` 降低往返。
3. 返回值自己设计成 JSON-friendly，方便 Agent 读。
4. 保持小步可恢复；长导航/网络等待拆成一等 `pw wait`。
5. 失败后先看错误和 `diagnostics digest`，不要无限重试同一段 code。

## 常见误用

| 误用 | 正确做法 |
|---|---|
| 用 code 重写 click/fill/wait 主链 | 用一等命令拿 action evidence |
| 在 code 里写长流程和长等待 | 拆成多条 CLI 命令 |
| code 返回巨大 DOM | 返回摘要 JSON |
| 外部登录脚本挂到 auth | 外部脚本只走 `pw code --file` |

## 恢复路径

- `RUN_CODE_TIMEOUT`：查 `page current` / `status` / `diagnostics digest`，拆小步骤。
- modal 阻断：`status` → `dialog accept|dismiss`。
- selector 失败：回到 `locate` / `snapshot -i` 找目标。

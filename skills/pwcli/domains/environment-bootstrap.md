# Environment / Bootstrap Domain

适用：在已有 session 上控制网络、地理位置、权限、时间、init script 和 headers。

精确参数见：

- `../references/command-reference-advanced.md`
- `../workflows/controlled-testing.md`

## 边界

Environment/Bootstrap domain 只处理 **已有 browser context 的运行条件**。

拥有：

- `environment offline on|off`
- `environment geolocation set`
- `environment permissions grant|clear`
- `environment clock install|set|resume`
- `bootstrap apply --init-script|--headers-file`

不拥有：

- session 创建 / profile / headed shape
- route mock 响应体
- 用户脚本管理平台
- 完整时间控制平台

## 决策规则

1. 需要断网/位置/权限/时间：先 `session create`，再 `environment ...`。
2. 需要页面初始化脚本或 headers：先 `bootstrap apply`，再导航/动作验证。
3. 需要 mock 接口内容：用 `route`，不是 environment/bootstrap。
4. clock 使用顺序固定：`install` → `set` → 验证 → `resume`。
5. bootstrap 是 live apply，不负责改变 session shape。

## 常见误用

| 误用 | 正确做法 |
|---|---|
| 用 bootstrap 创建 session | 先 `session create` |
| 用 environment mock API 响应 | 顶层用 `route add`；批量规则走 batch 内部 route load 子集 |
| clock set 前没 install | 先 `environment clock install` |
| 权限 flag 写成 `--permission` | 用 `permissions grant geolocation` |
| 地理位置写成 `--latitude/--longitude` | 用 `--lat` / `--lng` |

## 恢复路径

- 页面表现异常：`status` / `diagnostics digest`。
- bootstrap 注入后异常：recreate session，去掉 bootstrap 后复现。
- clock 不生效：确认命令顺序，必要时用 `pw code` 在页面上下文读 `new Date()` 验证。
- 权限/位置不生效：确认当前页面 origin 和权限提示状态。

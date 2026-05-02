# Interaction Domain

适用：页面动作、等待、文件交互和 read-only 状态检查。

精确参数见：

- `../references/command-reference.md`
- `../references/failure-recovery.md`

## 边界

Interaction domain 只处理 **当前 session 的当前页面怎么被读、被操作、被确认**。

拥有：

- 动作：`click`、`fill`、`type`、`press`、`hover`、`drag`、`scroll`、`select`、`check|uncheck`
- 文件：`upload`、`download`
- 等待：`wait`
- 只读检查：`snapshot`、`locate`、`get`、`is`、`verify`
- 视觉/归档证据：`screenshot`、`pdf`

不拥有：

- session lifecycle
- auth/state
- diagnostics 查询和导出
- route/environment/bootstrap 确定性控制

## 决策规则

1. 先用 `read-text` / `locate` / `snapshot -i` 找目标，不默认全量 snapshot。
2. 优先 selector 或语义定位；已有 fresh ref 时可用 ref。
3. 动作后如果依赖导航、请求或 DOM 更新，必须补 `wait`。
4. 动作后用 `verify` / `get` / `is` 做 read-only 确认。
5. 失败后看 `diagnostics digest`，不要盲目重复点击。
6. 只读命令只回答事实，不返回 ref、不规划动作。

## Targeting 规则

优先级：

1. 稳定 selector / test id
2. 语义定位：`--role --name`、`--label`、`--placeholder`、`--text`
3. fresh snapshot ref：`e42`
4. `pw code` 临时处理复杂 Playwright 能力

Snapshot ref 只在当前 page/navigation epoch 内有效；导航、tab 切换或重新 snapshot 后旧 ref 可能 `REF_STALE`。

## 常见误用

| 误用 | 正确做法 |
|---|---|
| click 后马上判断，不 wait | click → wait → verify/read |
| 把 `locate/get/is/verify` 当 action planner | 它们只做 read-only check |
| 旧 ref 跨导航复用 | 重新 `snapshot -i` |
| get value 用在非表单元素 | 只对 input/textarea/select 等表单控件用 |
| upload 后只看命令成功 | 继续 `wait` / `verify` 页面接收态 |

## 恢复路径

- `ACTION_TARGET_NOT_FOUND`：`read-text` / `locate` / `snapshot -i` 重新定位。
- `REF_STALE`：重新 `snapshot -i`，不要重试旧 ref。
- `MODAL_STATE_BLOCKED`：`observe status` → `dialog accept|dismiss` 或页面级恢复。
- `RUN_CODE_TIMEOUT`：查 `page current` / `observe status` / `diagnostics digest`，拆小步骤。

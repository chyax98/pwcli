# 核心使用规则

本文件是 `SKILL.md` 的规则摘要。主教程以 `SKILL.md` 为准。

## Session

- 新任务、新系统、新 URL、新登录态，默认 `pw session create <name>`。
- 只有用户明确要求继续当前页面，或任务依赖已有页面状态时，才复用 session。
- lifecycle 只走 `session create|attach|recreate`。
- `open` 只导航已有 session。
- 浏览器命令必须显式带 `--session <name>`。
- session 名最长 16 字符，只允许 `[a-zA-Z0-9_-]`。

## 观察和动作

- 默认观察顺序：`observe status` -> `page current` -> `read-text`。
- 大页面不要先 `snapshot`；需要 aria ref 时才用 `snapshot`。
- 动作优先用 selector、语义定位或 snapshot ref。
- `open`、`click`、`press` 后，如果下一步依赖页面状态，先 `wait`。

## 诊断

- 页面/API bug 先查 `diagnostics digest`。
- 然后查 `console`、`network`、`errors recent`。
- 用 `--since`、`--text`、`--limit`、`--fields` 降噪。
- 需要证据文件时用 `diagnostics export`。
- 回放 run 时用 `diagnostics runs|show|grep`。
- session 卡住或状态异常时用 `doctor`。

## Auth

- `auth` 只执行内置 provider，不创建 session。
- Forge/DC 登录用 `pw auth dc`。
- `dc` 适用时，禁止手填手机号、短信页、登录表单。
- 不要把 `dc2` 或 `dc2.0` 推断成 `instance=2`。
- 不要猜 `developer-p2-*`。
- 用户没给 URL 且没说 RND 时，直接执行默认登录命令。
- 用户明确说 RND 时，打开 `https://developer.xdrnd.cn/forge`。

## `pw code`

- `pw code` 是快速探索和组合动作通道，不是最后手段。
- 需要多 DOM 状态读取、复杂 Playwright 逻辑、selector 验证、本地脚本时可以优先用。
- 需要稳定 action 记录、diagnostics delta、标准输出时优先用一等命令。
- modal 阻塞时 `pw code` 可能失败，先恢复 dialog。

## 输出

- 默认输出是给 Agent 阅读的 text。
- 脚本解析、smoke、字段断言必须用 `--output json`。
- `pw batch --stdin-json` 表示 stdin steps，不表示输出 JSON。
- `batch` 只接收 `string[][]`。
- limitation code 只报告限制，不包装成已支持。

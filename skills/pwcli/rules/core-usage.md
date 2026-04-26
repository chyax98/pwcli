# Core Usage

- 优先用 `pw`。
- 默认走 Playwright Core 原生能力。
- 复杂页面流程优先 `pw code`。
- `skill install` 是一等公民能力，必须持续可用。
- 主路径永远显式带 `--session <name>`。
- `open` 只做导航。
- `profile` 只做 inspect。
- 先读 `snapshot/page/read-text/observe`，再执行动作。
- `batch` 只用 `--json` 或 `--file` 的 `string[][]`。
- `auth` 只负责内置 auth provider 执行，不负责 session shape。
- `diagnostics` 优先 query/export，不优先发明新的录制系统。
- 命中 limitation code 时，先恢复或报告，不要硬凹“已支持”。

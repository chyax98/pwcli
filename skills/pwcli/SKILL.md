---
name: pwcli
description: Use pw to drive Playwright-native browser workflows through strict named sessions, inspect diagnostics, and install this shipped skill for agent use.
---

# pwcli

用 `pw`，不要绕过 CLI 直接调底层脚本。

## 何时使用

适用场景：

- 需要稳定的浏览器 session
- 需要读取当前页面、文本、frames、dialogs
- 需要执行点击、输入、上传、拖拽、下载、等待
- 需要即时拿到 console / network / errors / observe / doctor
- 需要复用 state / profile / auth plugin

## 稳定工作流

### 1. 创建或接管 session

```bash
pw session create bug-a --open 'https://example.com'
pw session attach bug-a --ws-endpoint ws://127.0.0.1:9222/devtools/browser/...
```

规则：

- session 名最长 `16` 个字符
- 只允许字母、数字、`-`、`_`
- 缺失 `--session` 会失败

### 2. 读取页面真相

```bash
pw snapshot --session bug-a
pw page current --session bug-a
pw page list --session bug-a
pw page frames --session bug-a
pw page dialogs --session bug-a
pw read-text --session bug-a --max-chars 1200
pw observe status --session bug-a
```

### 3. 执行动作

```bash
pw click e6 --session bug-a
pw fill e8 hello --session bug-a
pw type --selector '#search' world --session bug-a
pw press Enter --session bug-a
pw wait networkIdle --session bug-a
```

选择器优先级：

1. `snapshot` 返回的 aria ref
2. `--selector`
3. 语义定位：
   - `--role` + `--name`
   - `--text`
   - `--label`
   - `--placeholder`
   - `--testid`

### 4. 拿诊断

```bash
pw console --session bug-a --level warning
pw network --session bug-a --resource-type xhr
pw errors recent --session bug-a
pw doctor --session bug-a
```

### 5. 复用状态

```bash
pw state save ./auth.json --session bug-a
pw session create bug-b --open 'https://example.com' --state ./auth.json

pw cookies list --session bug-a
pw storage local --session bug-a
```

### 6. 跑插件和 batch

```bash
pw auth dc-login --session auth-a --arg targetUrl='https://example.com'
pw bootstrap apply --session bug-a --init-script ./script.js
printf '%s\n' '[["click","e6"],["wait","networkIdle"],["errors","recent"]]' | pw batch --session bug-a --json
```

## 输出 contract

每条命令都输出 JSON。

成功字段：

- `ok: true`
- `command`
- `data`
- 按需返回 `session` / `page` / `diagnostics`

失败字段：

- `ok: false`
- `command`
- `error.code`
- `error.message`
- `error.retryable`
- `error.suggestions`

## 推荐规则

- 新自动化统一使用 `session create` 或 `session attach`
- `batch` 统一使用 `--json` 或 `--file`
- 先读 `snapshot`，再用 aria ref
- 先保存 state，再考虑 profile 迁移

## 当前限制

- `page dialogs` 是事件投影
- modal state 会让 `page *` / `observe status` 读路径失效
- `session attach --browser-url/--cdp` 依赖本地 attach bridge registry
- `har` 当前主要暴露 substrate 能力边界
- `auth` 不负责 session shape；先建 session，再跑 plugin

## 相关文件

- 参考命令面：[references/command-reference.md](./references/command-reference.md)
- skill 目录说明：[README.md](./README.md)

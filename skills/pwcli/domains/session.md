# Session Domain

适用：浏览器生命周期、接管、重建、会话清理、Dashboard 观察。

相关命令：

- `session create|attach|recreate|list|status|close`
- `dashboard open`

参数与输出精确口径见：

- `../references/command-reference.md`
- `../references/command-reference-advanced.md`

---

## 1. Purpose

Session domain 解决的是：

1. 什么时候创建一个新的浏览器任务上下文
2. 什么时候复用已有上下文
3. 什么时候接管外部浏览器
4. 什么时候重建 browser shape
5. 什么时候结束和清理一个上下文

这个 domain 是 `pwcli` 的生命周期主路。只要你要和浏览器建立、复用、销毁关系，先看这里。

---

## 2. Mental Model

`pwcli` 的 session 不是“顺手记个名字”，而是一个稳定的运行单元：

- 有唯一 `sessionName`
- 有自己的 page/context/browser 状态
- 有自己的 trace / diagnostics / run artifacts
- 有自己的 lifecycle 锁

理解这件事很重要：

```text
session create|attach|recreate
= 唯一 lifecycle 主路
```

`open` 不是 lifecycle。  
`auth` 不是 lifecycle。  
`page current` 不是 lifecycle。  
它们都假设 session 已经存在。

---

## 3. What This Domain Owns

这个 domain 负责：

- 创建 named session
- 接管 browser endpoint / attachable target
- 重建 session browser shape
- 列举和检查 session 状态
- 关闭 session
- 打开 Playwright session dashboard

这个 domain 不负责：

- 页面导航细节（`open` 负责）
- 页面动作（interaction 负责）
- 登录执行（`auth` 负责）
- 状态保存/比较（state/auth 负责）
- 诊断查询（diagnostics 负责）

---

## 4. Command Set

### 4.1 `session create`

用途：

- 新任务
- 新 URL 空间
- 新登录态
- 新 browser shape

典型参数：

- `--open <url>`
- `--headed` / `--headless`
- `--trace` / `--no-trace`
- `--profile <path>`
- `--persistent`
- `--state <file>`
- `--from-system-chrome`
- `--chrome-profile <name>`

关键语义：

- 默认打开 `about:blank`
- `--open` 只是创建后立刻导航
- `--state` 是创建后加载 state，不是 auth provider
- `--from-system-chrome` 是复用本机 Chrome profile 的启动身份来源

### 4.2 `session attach`

用途：

- 接管已存在的可连接 browser endpoint
- 接管当前 workspace 里可发现的 attachable browser server

路径：

- `--ws-endpoint`
- `--browser-url`
- `--cdp`
- `--attachable-id`

关键语义：

- attach 是“接管现有浏览器”，不是新建
- `--attachable-id` 只在当前 workspace registry 范围内生效
- `session list --attachable` 是 discovery，不是 attach

### 4.3 `session recreate`

用途：

- 当前 session 还存在，但 browser shape 需要整体切换
- 想保留 session identity，但重新起浏览器

典型场景：

- headed -> headless
- 切 trace 开关
- 重新带 `--open`

### 4.4 `session list`

用途：

- 查看当前可见的 managed sessions
- 用 `--with-page` 看 best-effort 页面摘要
- 用 `--attachable` 看 attach 候选和 capability facts

### 4.5 `session status`

用途：

- 快速状态查看

不是：

- 完整诊断
- 完整页面健康检查
- `doctor` 的替代品

### 4.6 `session close`

用途：

- 结束一个 session
- 清理全部 session

### 4.7 `dashboard open`

用途：

- 给人类看和接管 Playwright managed sessions

不是：

- Agent 主执行链必需步骤
- diagnostics 平台

---

## 5. Primary Workflows

### 5.1 新任务起手

```bash
pw session create bug-a --headed --open 'https://example.com'
pw observe status -s bug-a
pw read-text -s bug-a --max-chars 2000
```

### 5.2 复用本机 Chrome 登录态

```bash
pw profile list-chrome
pw session create bug-a --from-system-chrome --chrome-profile Default --headed --open 'https://example.com'
```

### 5.3 接管已登记 browser server

```bash
pw session list --attachable
pw session attach bug-a --attachable-id <id>
```

### 5.4 改 browser shape

```bash
pw session recreate bug-a --headless --open 'https://example.com'
```

### 5.5 收尾

```bash
pw session close bug-a
```

---

## 6. Key Rules

### 6.1 Session naming

- 最长 16 字符
- 只允许字母、数字、`-`、`_`

### 6.2 Lifecycle is serialized

同一个 session 的：

- startup
- reset
- close
- managed command dispatch

都会通过 per-session lock 串行进入 Playwright substrate。

这意味着：

- 不要并发发同名 lifecycle 命令
- 同一个 session 的依赖动作仍然顺序发
- 锁等待超时返回 `SESSION_BUSY`

### 6.3 `open` is not lifecycle

如果只是换 URL：

```bash
pw open -s bug-a 'https://example.com/next'
```

如果要换 browser shape、profile、trace：

```bash
pw session recreate ...
```

### 6.4 `auth` is not lifecycle

`auth` 只执行 provider。  
session shape 必须先建好。

---

## 7. Boundaries

### Session vs Open

- Session：创建/接管/重建浏览器上下文
- Open：在已存在 session 内导航

### Session vs State/Auth

- Session：提供浏览器上下文
- State/Auth：在这个上下文里复用或建立身份

### Session vs Workspace

- Session：浏览器生命周期
- Workspace：当前 page/frame/dialog 的只读事实和稳定 identity

### Session vs Diagnostics

- Session：浏览器存在与形状
- Diagnostics：运行证据和查询

---

## 8. Limitations

### `session status`

只做快速状态检查。  
页面忙、弹窗阻塞、断连时可能拿不到完整信息。  
这时改用：

```bash
pw doctor --session <name>
```

### `session attach`

只接管可连接 endpoint。  
不做：

- 进程扫描
- 自动 attach
- 跨 workspace attach 发现

### `session list --attachable`

只发现 Playwright-core 已登记的 browser servers。  
不是 extension bridge，不是 native host，不是系统级浏览器扫描器。

### `dashboard open`

依赖 Playwright 内部 CLI surface。  
如果 entrypoint 消失，应该按 `DASHBOARD_UNAVAILABLE` 失败。

---

## 9. Failure And Recovery

常见错误：

- `SESSION_REQUIRED`
- `SESSION_NAME_TOO_LONG`
- `SESSION_NAME_INVALID`
- `SESSION_BUSY`

恢复原则：

- `SESSION_BUSY`：先等同一 session 的命令收尾，再重试
- profile locked：关闭本机 Chrome 或换 profile
- attach 失败：先确认 endpoint 是否可访问，再改 `attach` 目标
- status 信息不完整：改跑 `doctor`

详细恢复路径见：

- `../references/failure-recovery.md`

---

## 10. Real Examples

### 新开一个调试 session

```bash
pw session create bug-a --headed --trace --open 'https://example.com'
```

### 从本机 Chrome profile 起步

```bash
pw profile list-chrome
pw session create bug-a --from-system-chrome --chrome-profile Default --headed
```

### 看 attachable targets

```bash
pw session list --attachable
```

### 快速看 session

```bash
pw session list --with-page
pw session status bug-a
```

### 重建

```bash
pw session recreate bug-a --headless --open 'https://example.com'
```

---

## 11. Related Domains

- 页面读取和页签操作：`workspace-observe.md`
- 页面动作：`interaction.md`
- 登录态和 profile：`state-auth.md`
- 诊断和 run evidence：`diagnostics.md`
- 现场脚本执行：`code-escape-hatch.md`

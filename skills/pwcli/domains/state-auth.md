# State / Auth Domain

适用：登录态、cookies/storage、browser state 文件、Chrome profile 复用和 auth provider。

精确参数见：

- `../references/command-reference-advanced.md`
- `../references/forge-dc-auth.md`
- `../references/failure-recovery.md`

## 边界

State/Auth domain 只处理 **身份状态如何获得、判断、保存、复用、局部修改**。

拥有：

- `auth list|info|<provider>|probe`
- `state save|load|diff`
- `cookies list|set`
- `storage local|session|indexeddb`
- `profile inspect|list-chrome`

不拥有：

- session shape：由 `session create|recreate` 决定
- 页面动作：由 interaction commands 执行
- 外部 auth plugin 生命周期：当前没有 plugin 机制
- 站点特化 auth intelligence：`auth probe` 只是 generic heuristic

## 决策规则

1. 需要登录：先创建 session，再执行 `auth <provider>`。
2. 不确定 provider 参数：先 `auth info <provider>`。
3. 需要判断当前是否可复用：`auth probe` + 页面文本 + cookies/storage 证据。
4. 需要跨 session 复用：`state save` → 新 session `--state`。
5. 只临时切 feature flag：用 current-origin `storage local set/delete`。
6. 想复用本机 Chrome 登录态：`profile list-chrome` → `session create --from-system-chrome` → `auth probe`。

## Forge/DC 规则

看到 Forge / DC / DC2 / 开发者后台，主文档会路由到 `pw auth dc`。专项降级逻辑见 `../references/forge-dc-auth.md`。

核心边界：

- `auth dc` 是内置 provider，不是外部脚本。
- provider 参数以 `pw auth info dc` 为准，不在文档里硬编码账号或验证码。
- 目标优先级：`targetUrl` → 当前 Forge/DC 页面 → provider 默认目标。
- 不支持 `instance`。

## 常见误用

| 误用 | 正确做法 |
|---|---|
| 让 `auth` 创建 session | 先 `session create` |
| 用 storage mutation 代替登录态复用 | 用 `state save/load` 或 provider |
| 把 `auth probe` 当强认证结论 | 它是启发式；结合页面和 storage 判断 |
| 把 `--from-system-chrome` 当 auth provider | 它只是 session 启动来源 |
| 文档里硬编码账号/验证码/真实域名 | 用占位符和 `auth info` |

## 恢复路径

- `auth probe` uncertain：读页面、cookies、storage；challenge/two-factor 交给人类。
- state 文件不可用：重新 `state save`，不要把任意 JSON 当 state/diff 文件。
- system Chrome profile locked：关闭 Chrome 或换 profile/session name。
- DC/Forge 目标错误：补 `--arg targetUrl='<forge-url>'`。

# State And Auth Domain

适用：登录态复用、cookies/storage/profile、auth provider、状态比较与读写边界。

相关命令：

- `state save|load|diff`
- `cookies list|set`
- `storage local|session`
- `storage indexeddb export`
- `profile inspect|list-chrome`
- `auth list|info|<provider>`
- `auth probe`

参数与输出精确口径见：

- `../references/command-reference-advanced.md`
- `../references/forge-dc-auth.md`
- `../references/failure-recovery.md`

---

## 1. Purpose

这个 domain 解决的是：

- 如何保存和恢复登录态
- 如何检查当前浏览器里有哪些状态痕迹
- 如何读写当前 origin 的 cookies/storage
- 如何使用内置 auth provider
- 如何判断当前 session 看起来是否处于可用身份状态

---

## 2. Mental Model

这里有四类不同东西，不能混：

1. **state file**
   - `state save|load`
2. **browser storage facts**
   - cookies / localStorage / sessionStorage / IndexedDB
3. **profile source**
   - 本机 Chrome profile、persistent profile path
4. **auth provider execution**
   - `auth <provider>`

很多误用都来自把这四类当同一回事。

---

## 3. What This Domain Owns

负责：

- state 文件保存/加载/比较
- cookies 操作
- 当前页 origin storage 读写
- IndexedDB 只读导出
- profile 可用性检查
- 内置 auth provider 执行
- generic auth-state probe

不负责：

- session lifecycle
- 页面动作
- diagnostics 查询
- 站点级 auth intelligence
- 插件式 auth provider 生态

---

## 4. Command Groups

### 4.1 State

- `state save`
- `state load`
- `state diff`

### 4.2 Cookies And Storage

- `cookies list|set`
- `storage local|session`
- `storage indexeddb export`

### 4.3 Profile

- `profile inspect`
- `profile list-chrome`

### 4.4 Auth

- `auth list`
- `auth info`
- `auth <provider>`
- `auth probe`

---

## 5. State Files

### 5.1 `state save`

把当前 session 的 storage state 导出到文件。

适合：

- 登录后留快照
- 后续重复使用

### 5.2 `state load`

把 storage state 从文件导入到当前 session。

适合：

- 在已有 session 里恢复身份态

### 5.3 `state diff`

用途：

- 比较 before/after 状态变化
- 看某次登录、操作、导航到底改了什么

它当前是 metadata-first 比较，不是深值比对系统。

---

## 6. Cookies And Storage

### 6.1 `cookies list|set`

`cookies` 是当前浏览器 cookie 层的受控接口。

适合：

- 看某个 domain 的 cookies
- 人工补一个 cookie 做受控测试

不适合：

- 完整 auth 建模
- 站点登录产品化

### 6.2 `storage local|session`

适合：

- 读当前 origin 的 storage
- 对当前 origin 做小范围受控写入

限制很关键：

- 只作用于当前页 origin
- 不做跨 origin

### 6.3 `storage indexeddb export`

适合：

- 只读查看当前 origin 的 IndexedDB 摘要
- 需要 sample records 时带 `--include-records`

不是：

- mutation 工具
- 跨 origin 迁移工具
- Cache Storage / service worker 探针

---

## 7. Profile Source

### 7.1 `profile inspect`

回答：

- 路径存不存在
- 能不能写
- 会不会在打开时创建

### 7.2 `profile list-chrome`

回答：

- 本机 Chrome 有哪些 profile 可以作为 `session create --from-system-chrome` 的来源

关键边界：

这只是 session 启动身份来源，不是 auth provider。

---

## 8. Auth Providers

### 8.1 `auth list`

列出内置 provider。

### 8.2 `auth info`

看 provider 参数、默认值、说明。

### 8.3 `auth <provider>`

执行某个内置 provider。

关键边界：

- 它不创建 session
- 它不决定 session shape
- 它不是 plugin 机制
- 外部脚本不走 `auth`，走 `pw code --file`

### 8.4 `auth dc`

当前是内置 DC/Forge provider。

要点：

- 默认手机号和验证码内聚在 provider
- 目标解析顺序：
  1. 显式 `targetUrl`
  2. 当前 Forge 页面
  3. 默认本地 Forge

---

## 9. `auth probe`

这是最容易被误解的命令。

### 它是什么

它是：

```text
generic auth-state heuristic
```

也就是：

- 看起来像已登录
- 看起来像未登录
- 看起来卡在 challenge / interstitial
- 不确定

### 它看什么

三层信号：

1. `pageIdentity`
2. `protectedResource`
3. `storage`

### 它不是什么

- 不是登录执行器
- 不是站点 `/me` API 探测器
- 不是 GitHub/Google/内部系统的站点规则库
- 不是 site-aware auth intelligence

这条边界必须守住。

---

## 10. Primary Workflows

### 10.1 登录后保存状态

```bash
pw auth dc -s forge-a
pw state save ./forge-state.json -s forge-a
```

### 10.2 恢复状态

```bash
pw session create forge-a --headed
pw state load ./forge-state.json -s forge-a
pw auth probe -s forge-a
```

### 10.3 看 storage 痕迹

```bash
pw storage local -s forge-a
pw storage session -s forge-a
pw cookies list -s forge-a --domain example.com
```

### 10.4 比较 before/after

```bash
pw state diff --session forge-a --before ./baseline.json --after ./after.json
```

---

## 11. Boundaries

### State/Auth vs Session

- Session：浏览器上下文存在与形状
- State/Auth：上下文里的身份与状态

### State/Auth vs Code

- State/Auth：受控命令面
- Code：更自由的 runtime/network 现场读取

### State/Auth vs Diagnostics

- State/Auth：状态与身份层
- Diagnostics：证据与事件层

---

## 12. Limitations

### `storage local|session`

只作用于当前 origin。

### `state diff`

当前只做：

- cookie 摘要
- local/session storage key 集合
- IndexedDB metadata + `countEstimate`

不做：

- local/session value 级 diff
- Cache Storage diff
- service worker diff

### `storage indexeddb export`

只读、只看当前 origin。

### `auth probe`

冻结在 generic probe。  
不继续扩成站点规则系统。

### `--from-system-chrome`

不复制 profile；直接使用本机 Chrome user data dir + profile-directory。  
同 profile 正被 Chrome 占用时可能失败。

---

## 13. Failure And Recovery

常见恢复策略：

- state load 后仍未登录：`auth probe` -> `read-text` / `pw code` / 重新 auth
- profile 被占用：关 Chrome 或换 profile
- storage 没有你预期的键：确认当前 origin 是否正确
- auth provider 跑完状态不稳：先 `auth probe`，再看 diagnostics

---

## 14. Real Examples

### 看当前身份状态

```bash
pw auth probe -s bug-a
```

### 保存并恢复

```bash
pw state save ./state.json -s bug-a
pw state load ./state.json -s bug-a
```

### 当前 origin storage

```bash
pw storage local -s bug-a
pw storage session -s bug-a
```

### 看 IndexedDB

```bash
pw storage indexeddb export -s bug-a --include-records --limit 10
```

### 用系统 Chrome profile 起步

```bash
pw profile list-chrome
pw session create bug-a --from-system-chrome --chrome-profile Default --headed
```

---

## 15. Related Domains

- 生命周期：`session.md`
- 页面事实：`workspace-observe.md`
- 诊断与 run evidence：`diagnostics.md`
- 脚本采集与 escape hatch：`code-escape-hatch.md`

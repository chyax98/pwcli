# Environment And Bootstrap Domain

适用：控制浏览器环境、注入 init script / headers、制造可重复执行条件。

相关命令：

- `environment offline on|off`
- `environment geolocation set`
- `environment permissions grant|clear`
- `environment clock install|set|resume`
- `bootstrap apply --init-script --headers-file`

参数与输出精确口径见：

- `../references/command-reference-advanced.md`

---

## 1. Purpose

这个 domain 解决的是：

- 怎么让浏览器进入受控环境
- 怎么模拟离线、地理位置、权限、时钟
- 怎么在 session 上做 preload/runtime patch

---

## 2. Mental Model

这里有两种不同的控制：

### A. Environment control

对浏览器运行环境本身做控制：

- offline
- geolocation
- permissions
- clock

### B. Bootstrap

对页面启动前后注入额外行为：

- init script
- request headers

它们都属于“基础环境设定”，但不是同一种东西。

---

## 3. What This Domain Owns

负责：

- browser offline 状态
- geolocation
- permissions
- clock 控制
- live bootstrap apply

不负责：

- session lifecycle
- 页面动作
- auth
- route mock

---

## 4. Command Groups

### 4.1 Environment

- `offline on|off`
- `geolocation set`
- `permissions grant|clear`
- `clock install|set|resume`

### 4.2 Bootstrap

- `bootstrap apply --init-script --headers-file`

---

## 5. Environment Commands

### 5.1 `offline on|off`

用途：

- 模拟离线
- 验证前端离线兜底

### 5.2 `geolocation set`

用途：

- 模拟位置相关页面

### 5.3 `permissions grant|clear`

用途：

- 控制地理位置、通知等权限面

### 5.4 `clock install|set|resume`

用途：

- 固定或推进页面时间相关行为

当前边界：

- 更复杂的 `fastForward` / `runFor` / explicit pause 还没进命令面

---

## 6. Bootstrap

### `bootstrap apply`

支持：

- `--init-script <file>`
- `--headers-file <file>`

用途：

- 在 live session 上安装 init script
- 注入额外请求头

关键边界：

- 这是 bootstrap，不是 lifecycle
- 这是 preload/runtime patch，不是 userscript 平台
- 它不负责 session shape

---

## 7. Primary Workflows

### 7.1 离线测试

```bash
pw environment offline on -s bug-a
pw open -s bug-a 'https://example.com'
pw diagnostics digest -s bug-a
```

### 7.2 固定地理位置

```bash
pw environment geolocation set -s bug-a --latitude 35.68 --longitude 139.76
```

### 7.3 赋权限

```bash
pw environment permissions grant -s bug-a --permission geolocation
```

### 7.4 注入 init script

```bash
pw bootstrap apply -s bug-a --init-script ./inject.js
```

---

## 8. Boundaries

### Environment/Bootstrap vs Session

- Session：浏览器上下文存在与形状
- Environment/Bootstrap：在已有上下文上施加环境条件

### Environment/Bootstrap vs Mock

- Environment/Bootstrap：改变浏览器运行环境或页面启动条件
- Mock：改变网络请求/响应

### Environment/Bootstrap vs Code

- Environment/Bootstrap：稳定命令面
- Code：更自由的现场脚本

---

## 9. Limitations

### Clock

当前 clock 语义没有继续扩成完整时间控制平台。

### Bootstrap

当前只支持 `apply`。  
不提供更复杂模板系统。

### Headers / init-script

这是 live apply 的受控能力，不是脚本管理平台。

---

## 10. Failure And Recovery

常见恢复：

- 页面表现异常：先看 `observe status` / `diagnostics digest`
- 注入后页面异常：去掉 bootstrap，再复现
- clock 行为不符合预期：确认页面是否真的依赖时间 API

---

## 11. Real Examples

### 离线

```bash
pw environment offline on -s bug-a
```

### 给权限

```bash
pw environment permissions grant -s bug-a --permission geolocation
```

### 注入 headers

```bash
pw bootstrap apply -s bug-a --headers-file ./headers.json
```

### 注入 init script

```bash
pw bootstrap apply -s bug-a --init-script ./inject.js
```

---

## 12. Related Domains

- 受控测试与 route：`mock-controlled-testing.md`
- 诊断：`diagnostics.md`
- 脚本 escape hatch：`code-escape-hatch.md`

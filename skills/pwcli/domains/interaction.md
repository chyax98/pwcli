# Interaction Domain

适用：对页面执行动作，或对目标做低噪声状态检查。

相关命令：

- 动作：`click`、`fill`、`type`、`press`、`hover`、`drag`、`scroll`、`select`、`check|uncheck`、`upload`、`download`、`pdf`、`wait`
- 只读检查：`snapshot`、`locate`、`get`、`is`、`verify`

参数与输出精确口径见：

- `../references/command-reference.md`
- `../references/failure-recovery.md`

---

## 1. Purpose

Interaction domain 解决的是：

- 怎么稳定地和页面交互
- 怎么低噪声地读目标状态
- 动作后怎么等待页面进入下一个稳定状态
- 怎么保留足够证据去定位失败

---

## 2. Mental Model

这里有两类命令，必须分清：

### A. 动作命令

- 改变页面状态
- 触发导航、请求、DOM 更新

例如：

- `click`
- `fill`
- `type`
- `press`
- `upload`

### B. 只读检查命令

- 不改变页面状态
- 只回答某个事实是否成立

例如：

- `locate`
- `get`
- `is`
- `verify`
- `snapshot`

很多误用都来自把 B 当成 A，或者把 A 当成 B。

---

## 3. What This Domain Owns

负责：

- 页面动作
- 动作证据
- 目标检查
- 等待页面状态变化
- 文件上传下载
- 页面 PDF 导出

不负责：

- 浏览器生命周期
- 页面总体状态摘要
- auth/state
- diagnostics 查询面

---

## 4. Command Groups

### 4.1 Pointer / Form actions

- `click`
- `fill`
- `type`
- `press`
- `hover`
- `drag`
- `scroll`
- `select`
- `check`
- `uncheck`

### 4.2 File actions

- `upload`
- `download`
- `pdf`

### 4.3 Waits

- `wait`

### 4.4 Read-only checks

- `snapshot`
- `locate`
- `get`
- `is`
- `verify`

---

## 5. Targeting Model

### 5.1 Prefer stable semantic targets

优先顺序通常是：

1. aria ref（已有 fresh snapshot ref）
2. `--selector`
3. `--role + --name`
4. `--text`
5. `--label`
6. `--placeholder`
7. `--testid`

### 5.2 `--nth`

当同一定位命中多个目标时，`--nth <n>` 是 disambiguation 手段。  
它是 1-based。

### 5.3 Snapshot refs are not permanent ids

`snapshot` ref 不是 cross-navigation 的稳定 identity。  
一旦：

- 导航
- tab 切换
- 新 snapshot

旧 ref 可能变成 `REF_STALE`。

这时应重新：

```bash
pw snapshot -i -s bug-a
```

---

## 6. Read-Only Check Commands

### 6.1 `snapshot`

用途：

- 理解结构
- 找 ref
- 看可交互节点

常用模式：

- `snapshot -i`
- `snapshot -c`

全量 snapshot 不是默认入口。  
先 `read-text` / `locate` 缩范围，再 snapshot。

### 6.2 `locate`

用途：

- 确认目标是否存在
- 看匹配数量
- 看前几个候选 metadata

不返回：

- ref
- 动作计划

### 6.3 `get`

用途：

- 读事实

支持：

- `text`
- `value`
- `count`

### 6.4 `is`

用途：

- 读布尔状态

支持：

- `visible`
- `enabled`
- `checked`

### 6.5 `verify`

用途：

- 动作后做窄断言
- 给 Agent 一个明确的 passed/failed 结果

它是 read-only assertion，不是测试框架，也不是 planner。

---

## 7. Action Commands

### 7.1 `click`

典型用于：

- 提交
- 打开菜单
- 触发导航

动作后通常要跟：

```bash
pw wait ...
pw diagnostics digest ...
```

### 7.2 `fill`

用途：

- 一次性写入表单字段

适合：

- input/textarea
- 稳定赋值

### 7.3 `type`

用途：

- 模拟键入

适合：

- 依赖键入事件触发建议框、过滤器、即时搜索的场景

### 7.4 `press`

用途：

- 触发 Enter/Escape/Arrow 等按键行为

### 7.5 `hover`

用途：

- 展开 menu / popover / tooltip

hover 后如果要读浮层，继续：

```bash
pw read-text --include-overlay ...
```

### 7.6 `drag`

用途：

- 拖拽源到目标

### 7.7 `scroll`

用途：

- 人工推动页面或容器继续渲染

不要把它包装成“自动全抓页面”。  
它只是显式滚动动作。

### 7.8 `select`

用途：

- 选择 `<select>` 的 option value

### 7.9 `check` / `uncheck`

用途：

- checkbox / radio

---

## 8. File Actions

### 8.1 `upload`

用途：

- 给 `<input type=file>` 赋文件

限制：

- 它只保证文件被赋到 input
- 不保证页面业务逻辑已经完全接受上传结果

所以 `upload` 后仍然可能要继续：

```bash
pw wait ...
pw verify ...
```

### 8.2 `download`

用途：

- 触发并保存下载结果

### 8.3 `pdf`

用途：

- 低频页面归档证据

不是：

- 报告生成器
- 页面采集器

---

## 9. Waiting Model

### 9.1 `wait` is mandatory after dependent actions

动作后如果你依赖：

- 导航完成
- 接口返回
- DOM 更新
- 文案出现

就必须显式 `wait`。

常见：

- `wait network-idle`
- `wait --text`
- `wait --selector`
- `wait --response`

### 9.2 `wait` is not a bandaid

不要把 `wait` 变成“多等等试试看”。  
它应该等的是**明确的状态变化**。

---

## 10. Evidence And Diagnostics

绝大多数动作命令都会产出：

- `target`
- `diagnosticsDelta`
- `run`

这意味着动作失败后，你应该优先走：

```bash
pw diagnostics digest -s bug-a
pw diagnostics runs --session bug-a
pw diagnostics show --run <runId>
```

而不是盲目重试。

---

## 11. Boundaries

### Interaction vs Workspace

- Workspace：先看页面事实
- Interaction：对页面施加动作

### Interaction vs Diagnostics

- Interaction：执行动作
- Diagnostics：解释动作后发生了什么

### Interaction vs Code

- Interaction：标准动作命令面
- Code：标准命令面不够时的 escape hatch

---

## 12. Common Misuse

### 12.1 把 `locate/get/is/verify` 当 planner

错。  
它们只做窄检查。

### 12.2 动作后不等待

错。  
这会让你把页面过渡态当最终态。

### 12.3 把 `snapshot` 当默认观察入口

错。  
应先走 `observe status` / `read-text` / `locate`。

### 12.4 把 `upload` 当上传完成

错。  
它只保证 input 赋值。

---

## 13. Failure And Recovery

常见失败：

- `REF_STALE`
- `MODAL_STATE_BLOCKED`
- selector 多匹配或目标不存在
- 动作后页面没有进入期望状态

恢复原则：

- `REF_STALE`：重新 `snapshot -i`
- `MODAL_STATE_BLOCKED`：先 `page dialogs` / `dialog accept|dismiss`
- 多匹配：改 selector 或加 `--nth`
- 页面没稳定：补明确 `wait`

详细错误码见：

- `../references/failure-recovery.md`

---

## 14. Real Examples

### 提交表单

```bash
pw fill -s bug-a --label 'Email' 'user@example.com'
pw click -s bug-a --role button --name '提交'
pw wait network-idle -s bug-a
pw verify text -s bug-a --text '保存成功'
```

### 展开菜单再读浮层

```bash
pw hover -s bug-a --selector '.menu-trigger'
pw read-text -s bug-a --include-overlay --max-chars 800
```

### 失败后追证据

```bash
pw click -s bug-a --selector '#submit'
pw diagnostics digest -s bug-a
```

---

## 15. Related Domains

- 页面事实层：`workspace-observe.md`
- 状态与 auth：`state-auth.md`
- 诊断与证据：`diagnostics.md`
- 现场脚本：`code-escape-hatch.md`

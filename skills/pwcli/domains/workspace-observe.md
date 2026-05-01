# Workspace And Observe Domain

适用：读取当前页面事实、列举 pages/frames/dialogs、切换页签、快速页面摘要。

相关命令：

- `page current|list|frames|dialogs`
- `page assess`
- `observe status`
- `tab select|close`
- `read-text`

参数与输出精确口径见：

- `../references/command-reference.md`

---

## 1. Purpose

这个 domain 解决的是：

- 当前浏览器里到底有哪些页面
- 当前焦点页是什么
- 页签怎么切换
- 当前页的 frame 和 dialog 状态是什么
- 页面现在大概是个什么形态
- 在不执行动作的前提下，先拿一层可靠事实

这是“先看页面”的主入口。

---

## 2. Mental Model

Workspace 是**只读事实层**，加上极少量基于稳定 identity 的页签写操作。

这里最重要的概念不是 selector，而是：

- `pageId`
- `navigationId`
- page/frame/dialog projection

工作方式是：

```text
先读取 workspace facts
再决定要不要动作
```

不是：

```text
先猜页面
再瞎点
```

---

## 3. What This Domain Owns

负责：

- 当前 page facts
- 当前 workspace 下 pages 列表
- frame 投影
- dialog 投影
- `page assess` 的 compact summary
- `observe status` 的综合读摘要
- 基于 `pageId` 的 `tab select|close`

不负责：

- 点击/输入等动作
- auth/state
- network/console 细节查询
- 页面完整内容抓取

---

## 4. Command Set

### 4.1 `page current`

返回当前 active page 的投影。

适合：

- 看当前在哪个 URL
- 看当前 title
- 确认当前 pageId

### 4.2 `page list`

返回当前 workspace 里所有 page 的稳定投影。

适合：

- popup / OAuth / preview 页存在时先找目标 pageId
- 配合 `tab select|close`

### 4.3 `page frames`

返回当前页 main frame 和 child frames 的投影。

适合：

- 页面有 iframe
- 需要知道 frame 层级

### 4.4 `page dialogs`

返回 browser dialog 的事件投影。

适合：

- 诊断 `alert/confirm/prompt`
- 配合 `dialog accept|dismiss`

不是：

- authoritative live dialog set

### 4.5 `page assess`

返回 compact、read-only 的页面评估摘要。

会给：

- `summary`
- `dataHints`
- `complexityHints`
- `nextSteps`
- `limitations`
- `evidence`

用途是帮 Agent 快速判断：

- 当前页更像列表页、表单页、文档页还是登录页
- 现在更适合先读文本、看 snapshot、跑 code，还是看 diagnostics

不是：

- planner
- target picker
- 文档分类器
- auth intelligence

### 4.6 `observe status`

比 `page current` 更宽的 compact 摘要：

- 当前页
- dialog
- routes
- pageErrors
- console
- network
- trace
- har
- bootstrap

适合作为进入页面的第一眼总结。

### 4.7 `tab select|close`

写操作，但严格受限：

- 只认 `pageId`
- 不认 index、title、URL substring

这是稳定 identity contract 的核心。

### 4.8 `read-text`

严格说它是页面内容读取命令，但在使用上属于 observe 主路的一部分。

适合：

- 先拿可见文本
- 在不写脚本的前提下快速理解当前页

---

## 5. Primary Workflows

### 5.1 进入页面后的最短观察链

```bash
pw observe status -s bug-a
pw page current -s bug-a
pw read-text -s bug-a --max-chars 2000
```

### 5.2 发现多页

```bash
pw page list -s bug-a
pw tab select <pageId> -s bug-a
pw page current -s bug-a
```

### 5.3 页面里有 iframe

```bash
pw page frames -s bug-a
pw snapshot -i -s bug-a
```

### 5.4 页面看起来复杂

```bash
pw page assess -s bug-a
pw read-text -s bug-a --selector '<main-or-panel>' --max-chars 2000
pw snapshot -i -s bug-a
```

---

## 6. Stable Identity Rules

### 6.1 `pageId` is the only write target

任何 workspace 写操作都必须依赖 `pageId`。

原因：

- index 会漂
- title 会重复
- URL 会变化

### 6.2 `page current` and `observe status` are facts, not plans

它们回答的是：

- 当前状态是什么

不是：

- 下一步应该点哪里

### 6.3 `page assess` stays narrow

`page assess` 只能停在 compact summary。

不要把它当成：

- 页面智能层
- planner
- intent model

---

## 7. Boundaries

### Workspace/Observe vs Interaction

- Workspace/Observe：只读事实、稳定 target identity、少量页签写操作
- Interaction：具体动作执行

### Workspace/Observe vs Diagnostics

- Workspace/Observe：当前页和 workspace 形态
- Diagnostics：console/network/errors/run evidence

### Workspace/Observe vs Code

- Workspace/Observe：先拿低噪声事实
- Code：当需要 DOM/runtime/network 深取时再现场写脚本

---

## 8. Limitations

### `page dialogs`

是事件投影，不是 authoritative live dialog set。

### `tab select|close`

只接受 `pageId`。  
如果你还没 `pageId`，先跑：

```bash
pw page list -s bug-a
```

### `page assess`

只做 inference-only summary：

- 不导出 runtime state
- 不导出 storage state
- 不导出 network payload
- 不做动作规划

### `read-text`

只拿可见文本。  
如果你要：

- runtime 数据
- network 响应
- DOM 深取

就该去 `pw code` 或 diagnostics，不要把 `read-text` 当万能抓取器。

---

## 9. Failure And Recovery

常见恢复思路：

- 页面信息不完整：`observe status` -> `page current` -> `doctor`
- 页签目标不清：先 `page list`
- iframe 复杂：`page frames` 后改走 `pw code`
- assess 不够：继续 `read-text` / `snapshot -i` / `pw code`

---

## 10. Real Examples

### 看当前页

```bash
pw page current -s bug-a
```

### 看全部页签

```bash
pw page list -s bug-a
```

### 切到 popup

```bash
pw page list -s bug-a
pw tab select <pageId> -s bug-a
```

### 快速页面摘要

```bash
pw page assess -s bug-a
```

### 综合状态

```bash
pw observe status -s bug-a
```

---

## 11. Related Domains

- 动作命令：`interaction.md`
- 诊断证据：`diagnostics.md`
- 脚本执行：`code-escape-hatch.md`
- 生命周期：`session.md`

# Code And Escape Hatch Domain

适用：标准命令面不够时，直接用 Playwright-core 现场写脚本、拿事实、做调试。

相关命令：

- `code`

相关辅助命令：

- `read-text`
- `snapshot`
- `page assess`
- `network`
- `diagnostics digest`

参数与输出精确口径见：

- `../references/command-reference-advanced.md`
- `../references/workflows.md`

---

## 1. Purpose

这个 domain 解决的是：

- 标准命令面不够时，如何直接拿 DOM/runtime/network 事实
- 如何现场写脚本、现场跑、现场拿结果
- 如何避免为了少量脚本场景继续发明新产品面

---

## 2. Core Decision

这篇文档最重要的不是命令本身，而是项目决策：

```text
页面采集、页面还原、页面深取，默认主路是 pw code
不是 extract/template/recipe 系统
```

原因：

- 页面形态太多
- 无限滚动、折叠、虚拟列表、runtime cache、network data 都不可能被一个统一模板面自然覆盖
- `pw code` 已经站在 Playwright-core 原语上，表达力更强

这条决策已经固定，不要再重走“产品化 extract”那条路。

---

## 3. What This Domain Owns

负责：

- ad-hoc 页面脚本执行
- DOM facts 深取
- runtime state 深取
- network/data 层辅助读取
- 临时组合动作与读取

不负责：

- 长期模板系统
- recipe 驱动提取器
- userscript 平台
- 站点 pack

---

## 4. When To Use `pw code`

以下情况直接用 `pw code`：

1. 当前命令面拿不到你要的事实
2. 你要读的东西在 runtime state 里
3. 你要结合 DOM + network + state
4. 你要临时试一种页面采集思路
5. 你要现场验证一个假设

不要为了这种需求先发明新命令。

---

## 5. Standard Workflow

默认流程：

1. 先看页面
2. 判断内容在 DOM / runtime / network 哪层
3. 用 `pw code`
4. 让 Agent 还原、总结、生成结果

常见前置命令：

```bash
pw observe status -s bug-a
pw read-text -s bug-a
pw snapshot -i -s bug-a
pw diagnostics digest -s bug-a
pw network -s bug-a --limit 20
```

然后再：

```bash
pw code -s bug-a --file ./script.js
```

---

## 6. What `pw code` Is

它本质上是：

```text
直接跑 Playwright 脚本
```

你可以：

- `page.evaluate(...)`
- 读 DOM
- 读图片/链接/表格
- 进 same-origin iframe
- 读 `window.*`
- 结合网络与页面状态

它就是当前最强的 escape hatch。

---

## 7. What `pw code` Is Not

不是：

- 生命周期命令
- auth provider
- extract 产品面
- userscript 安装器
- 脚本市场

---

## 8. Why No Productized Extract

这个决策必须写清楚：

### 错误方向

- recipe
- template
- 预定义字段规则
- 站点模板
- 先猜结构再抽

这会变成：

```text
新的抽象负担
而不是减少脚本劳动
```

### 正确方向

- 先看页面
- 再写脚本
- 直接拿事实

只有未来真的出现大量重复、稳定、同构的页面采集脚本，并且能证明薄封装比 `pw code` 更省成本时，才考虑薄封装。  
否则默认不重启 extract 产品化。

---

## 9. Primary Use Cases

### 9.1 拿页面可见结构

- heading
- paragraph
- link
- image
- table

### 9.2 拿 runtime 数据

- `window.__INITIAL_STATE__`
- 前端 store
- cache 痕迹

### 9.3 看 network / DOM 怎么关联

- 页面有数据，但 DOM 只是部分可见
- 真正业务数据在 response 或 runtime state

### 9.4 临时验证复杂页面

- 折叠区
- 虚拟列表
- 多层 iframe

---

## 10. Boundaries

### Code vs Workspace/Observe

- Workspace/Observe：先拿低噪声事实
- Code：深入取事实

### Code vs Diagnostics

- Diagnostics：看已有证据
- Code：主动采更多事实

### Code vs Mock

- Mock：控制输入
- Code：读取和实验

---

## 11. Common Misuse

### 11.1 还想重建 extract/template 系统

不要。  
这条路已经被否掉。

### 11.2 一上来就 `pw code`

也不对。  
先 `observe status` / `read-text` / `snapshot` / `network`，再写脚本。

### 11.3 把 `pw code` 当长期模板库

不对。  
它是 escape hatch，不是产品模板中心。

---

## 12. Failure And Recovery

常见恢复：

- 脚本报错：保留 Playwright 原始错误，按报错改脚本
- modal 阻塞：先 `page dialogs` / `dialog accept|dismiss`
- 目标页结构复杂：先退回 `snapshot -i` 或 `page frames`

---

## 13. Real Examples

### 跑本地脚本

```bash
pw code -s bug-a --file ./script.js
```

### 先看页面，再决定写什么脚本

```bash
pw observe status -s bug-a
pw read-text -s bug-a
pw snapshot -i -s bug-a
pw code -s bug-a --file ./script.js
```

### 先看网络再写脚本

```bash
pw network -s bug-a --limit 20
pw code -s bug-a --file ./script.js
```

---

## 14. Related Domains

- 页面事实层：`workspace-observe.md`
- 动作命令：`interaction.md`
- 诊断：`diagnostics.md`
- 环境与 mock：`environment-bootstrap.md`、`mock-controlled-testing.md`

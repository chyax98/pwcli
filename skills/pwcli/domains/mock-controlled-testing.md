# Mock And Controlled Testing Domain

适用：受控复现、请求拦截、patch upstream response、固定测试场景。

相关命令：

- `route list|add|load|remove`

参数与输出精确口径见：

- `../references/command-reference-diagnostics.md`
- `../workflows/controlled-testing.md`

---

## 1. Purpose

这个 domain 解决的是：

- 如何让页面在可控网络条件下复现
- 如何 mock 成功/失败响应
- 如何 patch upstream response
- 如何为 diagnostics 或页面行为建立可重复输入

---

## 2. Mental Model

`route` 不是“为了完整而完整”的功能面。  
它的存在理由只有一个：

```text
为了 controlled testing 和问题复现
```

如果某个增强不能对应真实复现场景，就不该加。

---

## 3. What This Domain Owns

负责：

- request matching
- fulfill / abort
- upstream response patch
- route specs 批量加载

不负责：

- scenario 平台
- GraphQL DSL 平台
- 测试 runner
- benchmark 平台

---

## 4. Command Set

### 4.1 `route list`

看当前 session 下 active routes。

### 4.2 `route add`

单条 route rule。

支持：

- abort
- fulfill
- inject headers
- patch json
- patch text
- patch status
- query/header/json matching

### 4.3 `route load`

从 JSON 文件批量加载 route specs。

### 4.4 `route remove`

删一条或清空全部。

---

## 5. Matching Model

当前 matcher 已覆盖：

- URL pattern
- method
- body substring
- query exact match
- request header exact match
- JSON body subset match

这已经足够服务绝大多数 controlled-testing 场景。

不应继续走向：

- schema-level matcher 平台
- 复杂规则语言

---

## 6. Response Control Model

当前两种路径：

### A. Fulfill

自己给 body/status/content-type/headers。

### B. Patch upstream

先拿 upstream response，再做：

- JSON merge patch
- text patch
- status override
- response header merge

这个模式已经足够强。  
不要再把它做成第二套场景平台。

---

## 7. Primary Workflows

### 7.1 模拟 API 500

```bash
pw route add '**/api/items' -s bug-a --status 500 --body '{"error":"boom"}' --content-type application/json
```

### 7.2 让 upstream JSON 改一部分

```bash
pw route add '**/api/items' -s bug-a --patch-json '{"items":[]}'
```

### 7.3 只在 query 命中时 patch

```bash
pw route add '**/search' -s bug-a --match-query q=test --patch-status 503
```

### 7.4 批量加载 route

```bash
pw route load ./routes.json -s bug-a
```

---

## 8. Boundaries

### Mock vs Diagnostics

- Mock：控制输入
- Diagnostics：观察输出

### Mock vs Environment

- Mock：网络请求/响应层
- Environment：浏览器环境层

### Mock vs Code

- Mock：稳定可复用命令面
- Code：更自由但更临时的现场手段

---

## 9. Limitations

当前故意不做：

- scenario 平台
- GraphQL 专用 planner
- 更复杂 patch DSL
- benchmark 平台级集成

规则很简单：

```text
只按真实 controlled-testing / diagnostics / 复现场景补能力
```

---

## 10. Common Misuse

### 10.1 为了“能力完整”继续扩 route

错。  
必须有真实场景。

### 10.2 用 route 代替 diagnostics

错。  
route 只能控制输入，不能解释发生了什么。

### 10.3 把 route 当测试框架

错。  
它只是网络控制能力。

---

## 11. Failure And Recovery

常见恢复：

- 路由没命中：先 `route list`，再检查 pattern / query / header / body matcher
- patch 失败：先确认 upstream response 类型
- 页面行为异常：route + `diagnostics digest` 一起看

---

## 12. Real Examples

### 清空全部 route

```bash
pw route remove -s bug-a
```

### 看当前 route

```bash
pw route list -s bug-a
```

### 直接 abort

```bash
pw route add '**/api/items' -s bug-a --abort
```

### 注入 headers

```bash
pw route add '**/api/items' -s bug-a --inject-headers-file ./headers.json
```

---

## 13. Related Domains

- 诊断：`diagnostics.md`
- 环境控制：`environment-bootstrap.md`
- 现场脚本：`code-escape-hatch.md`

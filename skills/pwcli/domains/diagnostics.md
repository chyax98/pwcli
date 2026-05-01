# Diagnostics Domain

适用：console/network/error 查询、run evidence、证据导出、trace/HAR 边界、故障定位。

相关命令：

- `console`
- `network`
- `errors recent|clear`
- `diagnostics digest|bundle|export|runs|show|grep`
- `trace start|stop|inspect`
- `har start|stop`
- `doctor`

参数与输出精确口径见：

- `../references/command-reference-diagnostics.md`
- `../references/failure-recovery.md`

---

## 1. Purpose

Diagnostics domain 解决的是：

- 页面失败后怎么拿证据
- 动作后到底发生了什么
- network / console / page errors 怎么查
- run artifact 在哪
- trace / HAR 在 `pwcli` 里边界是什么

---

## 2. Mental Model

Diagnostics 不是“另一个浏览器”。  
它是围绕浏览器执行产生的**证据层**。

你应该把它理解成三层：

1. **live session facts**
   - 当前 session 的 console/network/errors/digest
2. **run evidence**
   - 某次动作或等待产生的 run 事件与 artifacts
3. **offline artifacts**
   - trace zip
   - diagnostics bundle
   - exported JSON/text

它不是：

- 数据库
- stream 平台
- 报表系统

---

## 3. What This Domain Owns

负责：

- live diagnostics 查询
- run evidence 列举和过滤
- diagnostics bundle / export
- trace inspect
- doctor probe

不负责：

- 页面动作
- 生命周期
- auth/state
- 页面完整抓取

---

## 4. Command Groups

### 4.1 Live query

- `console`
- `network`
- `errors recent`
- `diagnostics digest --session`

### 4.2 Baseline/reset

- `errors clear`

### 4.3 Run evidence

- `diagnostics runs`
- `diagnostics show`
- `diagnostics grep`
- `diagnostics digest --run`

### 4.4 Evidence export

- `diagnostics export`
- `diagnostics bundle`

### 4.5 Trace / HAR

- `trace start|stop|inspect`
- `har start|stop`

### 4.6 Health probe

- `doctor`

---

## 5. Live Query Semantics

### 5.1 `console`

看当前 session 的 console 记录。

常用过滤：

- `--level`
- `--source`
- `--text`
- `--since`
- `--limit`

### 5.2 `network`

看当前 session 的 network 记录。

常用过滤：

- `--url`
- `--kind`
- `--method`
- `--status`
- `--resource-type`
- `--text`
- `--since`
- `--limit`

它是 network evidence 入口，不是抓包平台。

### 5.3 `errors recent`

看当前 session 最近的 page errors。

### 5.4 `errors clear`

在复现前清掉错误基线。  
这很重要，不然你会把旧错误混进新问题。

### 5.5 `diagnostics digest --session`

当前 session 的第一层证据摘要。

通常是进入 diagnostics 的第一条命令。

---

## 6. Run Evidence

### 6.1 什么是 run

大多数动作/等待命令都会产出 run evidence。

你可以把 run 理解成：

```text
一次可追踪的动作/等待执行记录
```

包含：

- command
- timestamps
- target
- diagnosticsDelta
- failure / dialog-pending 等状态

### 6.2 `diagnostics runs`

列出 `.pwcli/runs/` 下的 run 摘要。

常用过滤：

- `--session`
- `--since`
- `--limit`

### 6.3 `diagnostics show`

看某个 `runId` 的详细事件。

### 6.4 `diagnostics grep`

对某个 `runId` 的事件做文本 grep。

### 6.5 `diagnostics digest --run`

对单个 run 做 compact 摘要。

---

## 7. Export And Bundle

### 7.1 `diagnostics export`

导出某个 session 的 diagnostics 片段。

支持：

- section
- limit
- since
- text
- fields

用于：

- 离线分析
- 附证据给 Agent 或人类

### 7.2 `diagnostics bundle`

导出失败现场最小证据包。

它比 `export` 更偏“交付给另一个分析者继续看”。

会包含：

- session digest
- filtered diagnostics
- latest run events（如果存在）
- `auditConclusion`

这是当前最像“失败闭环包”的命令。

---

## 8. Trace And HAR Boundaries

### 8.1 `trace start|stop`

管理 trace recording。

### 8.2 `trace inspect`

对 trace zip 做薄封装查询。

支持 section：

- actions
- requests
- console
- errors

关键边界：

- `pwcli` 不自己解析 trace artifact 全量结构
- 它只是薄封装 Playwright bundled trace CLI

### 8.3 `har start|stop`

当前只是 substrate 边界暴露。  
不是稳定诊断主路。

稳定诊断主路仍是：

- `network`
- `diagnostics export`

---

## 9. `doctor`

`doctor` 是健康探针，不是简单状态查看。

适合：

- 页面断连
- endpoint 可达性怀疑
- auth provider / profile / state 文件有疑点

不要把 `session status` 当成 `doctor`。

---

## 10. Primary Workflows

### 10.1 动作失败后最短闭环

```bash
pw diagnostics digest -s bug-a
pw diagnostics runs --session bug-a
pw diagnostics show --run <runId>
```

### 10.2 复现前清基线

```bash
pw errors clear -s bug-a
pw click -s bug-a --selector '#submit'
pw diagnostics digest -s bug-a
```

### 10.3 导出证据

```bash
pw diagnostics bundle -s bug-a --out ./evidence
```

### 10.4 查接口异常

```bash
pw network -s bug-a --status 500 --limit 20
```

### 10.5 离线看 trace

```bash
pw trace inspect ./trace.zip --section actions
```

---

## 11. Boundaries

### Diagnostics vs Workspace

- Workspace：当前页面和页签事实
- Diagnostics：执行后的证据和事件

### Diagnostics vs Interaction

- Interaction：触发动作
- Diagnostics：解释动作后果

### Diagnostics vs Mock

- Diagnostics：观察真实发生了什么
- Mock：控制网络输入以复现/测试

---

## 12. Limitations

### No event stream

当前没有 streaming 诊断面。

### Not a database

run evidence 是 run artifact，不是持久化诊断数据库。

### `har`

不是主诊断路径。

### `trace inspect --level`

受 Playwright trace CLI console 过滤能力限制，目前只稳定映射 `error` / `warning`。

---

## 13. Common Misuse

### 13.1 动作失败后只重试，不看 diagnostics

错。  
先看 digest / run。

### 13.2 把 `network` 当抓包平台

错。  
它是 diagnostics query。

### 13.3 把 trace/HAR 当默认入口

错。  
先用 digest / network / console / runs。

---

## 14. Failure And Recovery

常见恢复思路：

- 失败但原因不明：`diagnostics digest`
- 需要动作细节：`diagnostics runs/show`
- 需要离线交接：`diagnostics bundle`
- endpoint 疑似坏掉：`doctor`
- trace zip 不可读：看 `TRACE_*` 错误码

---

## 15. Real Examples

### 先看摘要

```bash
pw diagnostics digest -s bug-a
```

### 查 500

```bash
pw network -s bug-a --status 500
```

### 看某次动作的 run

```bash
pw diagnostics runs --session bug-a
pw diagnostics show --run <runId>
```

### 导出证据包

```bash
pw diagnostics bundle -s bug-a --out ./evidence
```

### 健康探针

```bash
pw doctor -s bug-a --verbose
```

---

## 16. Related Domains

- 页面动作：`interaction.md`
- 页面事实：`workspace-observe.md`
- 环境与 bootstrap：`environment-bootstrap.md`
- 受控测试与 mock：`mock-controlled-testing.md`

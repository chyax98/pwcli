# pw <command>

<!--
  这是命令设计决策文档（ADR）模板。
  每个命令族（一级命令 + 其子命令）对应一个文件。
  docs/commands/ 是命令的设计真相，skills/pwcli/ 是使用教程真相，两者不重复。
-->

## 是什么

一句话：这个命令做什么。

## 为什么存在

Agent 在什么场景下需要它？解决什么问题？
不是"因为 Playwright 有这个 API"，而是 Agent 的真实任务需求。

## 子命令

| 子命令 | 作用 |
|---|---|
| `pw <command> <sub>` | ... |

## 技术原理

背后的机制是什么？
- 调用哪个 Playwright/engine 层函数？
- 关键的实现决策？
- 和 Playwright 公开 API 的关系？

## 已知限制

- 什么情况下不工作？
- 有哪些错误码（从 failure-recovery.md 对应）？
- 什么场景应该用其他命令代替？

## 使用证据

- [ ] benchmark 验证（哪个 T0x 场景用过）
- [ ] dogfood / skill 引用（skill.md 中出现几次）
- [ ] 真实 Agent 任务链路（有没有端到端跑通过）

**状态：** `proven` / `documented` / `experimental`
- `proven` = benchmark 或 dogfood 端到端验证过
- `documented` = skill 有记录但没有 benchmark 证据
- `experimental` = 代码存在，skill 和 benchmark 均无记录

## 设计决策

记录关键的设计选择和被否决的方案，解释"为什么这样而不是那样"。

---

*最后更新：YYYY-MM-DD*
*对应实现：`src/engine/` + `src/cli/commands/<command>.ts`*

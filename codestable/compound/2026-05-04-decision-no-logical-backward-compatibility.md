---
doc_type: decision
category: constraint
date: 2026-05-04
slug: no-logical-backward-compatibility
status: active
area: command-contract
summary: "内部实现不写逻辑向后兼容分支；只允许命令名称层面的 Agent 友好别名。"
tags:
  - command-contract
  - architecture
  - constraint
  - agent-product
---

# 不写逻辑向后兼容实现

## 背景

`pwcli` 是 Agent-first CLI，产品面是 `CLI + skills/pwcli/`。Agent 需要稳定、清晰、唯一的命令 contract。为了旧参数、旧行为或历史实现继续堆逻辑分支，会让内部路径变复杂，形成难以验证和维护的实现债。

## 决定

永远不要写逻辑上的向后兼容代码。内部实现必须唯一、清晰、直接，不为了旧参数形态、旧行为或旧文档残留增加兼容分支。

唯一允许的兼容是**命令名称层面的兼容**：例如为了帮助 Agent 更自然操作，可以保留清晰的命令别名或入口别名。但别名进入系统后必须收敛到同一条内部实现路径，不能分叉出第二套语义。

## 理由

- Agent 需要读到一个明确 contract，而不是在多个历史形态之间猜。
- 逻辑兼容分支会扩大测试矩阵，让每个能力都更难深度验证。
- 旧参数/旧行为如果继续可用，会和 skill、architecture、command docs 的当前真相互相污染。
- 命令名称别名可以降低 Agent 操作成本；内部逻辑兼容只会提高维护成本。

## 后果

- 修 bug 或调整 contract 时，应选择一个最佳实践形态作为唯一实现。
- 发现旧参数形态时，不保留 fallback；应更新 skill/docs，并让旧形态明确失败或退出。
- review 时要把“为旧逻辑留兼容路径”视为 P1 风险，除非用户明确把它限定为命令名称别名。
- CodeStable command docs 只记录当前唯一 contract；历史漂移写 issue/fix-note，不写成 active usage。

## 相关文档

- `AGENTS.md`
- `.claude/rules/03-architecture-boundaries.md`
- `.claude/rules/10-review-guidelines.md`

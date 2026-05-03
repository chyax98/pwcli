---
doc_type: decision
category: tech-stack
status: active
summary: "项目运行和验证基线是 Node 24 与 pnpm 10+。"
tags:
  - environment
  - toolchain
  - verification
---

# Node 24 与 pnpm 10+ 环境基线

## 决定

`pwcli` 的本地开发、构建、验证和发布基线是 Node 24 与 pnpm 10+。具体版本以 `package.json` 为准：

- Node.js：`>=24.12.0 <26`
- pnpm：`10.x`

## 背景

项目依赖现代 Node 运行时和 pnpm 10 锁文件。开发环境可能通过 Volta、proto 或其他版本管理器切换 Node / pnpm，因此验证时遇到环境预检差异，不能直接用临时兼容补丁掩盖。

## 理由

- 版本基线已经在 `package.json` 中声明，工具链和 CI/发布验证应向该基线收敛。
- 环境管理器导致的 Node / pnpm 解析差异属于开发环境问题，不能为了让单次 smoke 通过而修改产品代码。
- `doctor` 是健康检查和恢复建议入口，不是版本管理器或环境修复器。

## 影响

- 执行验证前先确认当前 shell 使用 Node 24 与 pnpm 10+。
- 如果 `doctor` 或 smoke 的环境项暴露版本管理差异，优先记录为环境观察项或修正验证前提，不直接改产品行为。
- 不新增 Node 18/20 兼容补丁，除非后续明确变更项目支持矩阵并 supersede 本决策。

## 相关文档

- `package.json`
- `AGENTS.md`
- `skills/pwcli/references/command-reference-diagnostics.md`

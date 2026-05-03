---
doc_type: decision
category: convention
date: 2026-05-04
slug: agent-driven-validation-strategy
status: active
area: validation
summary: "pwcli 的深度验证以 Agent 按 skill 真实使用为主，脚本只承担基础回归和契约兜底。"
tags:
  - validation
  - dogfood
  - skill
  - agent-product
---

# Agent 驱动验证策略

## 背景

`pwcli` 的核心产品面是 `CLI + skills/pwcli/`。它主要服务 Agent，让 Agent 把浏览器当作可观察、可操作、可诊断的手和眼。只维护一条越来越长的 shell E2E 脚本，容易把工作重心变成修脚本和日志，而不是验证 Agent 是否真的能拿着 skill 完成任务。

## 决定

深度验证以 Agent 按 `skills/pwcli/` 执行真实任务为主。基础能力、稳定 contract 和低层回归用集成测试、契约测试或小型自动化兜底；shell E2E 可以保留为夹具和回归入口，但不能成为唯一或主要的产品深测方式。

验证分层如下：

- **基础能力层**：用 Vitest、集成测试、contract check 或小型 fixture 验证命令解析、JSON envelope、错误码、route/batch/environment 等稳定行为。
- **Agent dogfood 层**：Agent 按中文优先的 `skills/pwcli/` 执行浏览器自动化、自动化测试、表单填写、简单爬取、Deep Bug 复现与诊断、证据交接等真实场景。
- **证据沉淀层**：把通过/失败结论写回 CodeStable，P0/P1 进入 issue/fix-note，稳定经验进入 architecture、decision、learning 或 command doc。

## 理由

- Agent 才是 `pwcli` 的主要用户，真正的可用性问题经常出现在"读 skill 后如何选择命令、如何恢复失败、如何形成证据链"这一层。
- 基础自动化测试适合守住稳定 contract，但不适合替代真实任务判断。
- 脚本可以证明某条路径可运行，但不能充分证明 skill 是否清晰、命令组合是否顺手、失败恢复是否可理解。
- 中文优先 skill 是产品面的一部分，深测必须把 skill 本身纳入验证对象。

## 考虑过的替代方案

- **把大型 shell E2E 作为主要深测入口**：保留作为可选回归手段，但不作为主要策略。它维护成本高，且容易把产品验证缩窄成脚本断言。
- **只靠人工/Agent dogfood，不写基础测试**：不采用。命令契约、错误码、输出结构和基础能力仍需要稳定、可重复的测试兜底。

## 后果

- roadmap 和 release gate 不能把 `pnpm test:dogfood:e2e` 写成默认深度验证的唯一入口。
- command doc 的 `proven` 状态应接受真实 Agent dogfood 证据，不局限于脚本覆盖。
- 新能力必须同时考虑两类证据：基础 contract 是否被测试覆盖，Agent 是否能按 skill 完成真实任务。
- 如果 shell E2E 失败，先判断它是产品 P0/P1、contract 漂移，还是脚本维护成本问题；不能默认把修脚本当作最高优先级。

## 相关文档

- `skills/pwcli/`
- `codestable/roadmap/project-completion/project-completion-roadmap.md`
- `codestable/architecture/e2e-dogfood-test-plan.md`

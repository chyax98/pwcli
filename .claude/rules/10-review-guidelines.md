---
paths:
  - "src/**/*.ts"
  - "skills/pwcli/**/*.md"
  - "docs/architecture/**/*.md"
  - "AGENTS.md"
  - "README.md"
---

# pwcli Review Guidelines

状态：active

这份文档定义 `pwcli` 仓库里的项目特化审查规则。

代码审查只报告可验证的 P0/P1 问题。不要把拼写、表达风格、普通文档润色升级成阻塞问题，除非它改变 active contract、隐藏 limitation、或破坏未来 Agent 的入口。

## 1. 审查优先级

按下面顺序检查。

### P0 / P1：Workspace Mutation Contract

重点路径：

- `src/app/commands/tab.ts`
- `src/domain/workspace/`
- `src/infra/playwright/runtime/workspace.ts`
- `docs/architecture/workspace-mutation-contract.md`

必须检查：

- workspace 写操作必须接受 stable identity，例如 `pageId`
- index / title / URL substring 只能做读侧辅助，不能作为 mutation 主键
- 不允许先 projection 再用 stale index 执行破坏性写操作
- `tab close <pageId>` 不能关闭非目标 page
- fallback page 选择必须和 close 目标来自同一份可信状态

典型 P1：

```text
pageId -> old snapshot index -> close/select live tab by index
```

### P0 / P1：Session Lifecycle Contract

重点路径：

- `src/app/commands/session.ts`
- `src/app/commands/open.ts`
- `src/app/commands/auth.ts`
- `src/infra/playwright/cli-client.ts`
- `docs/architecture/adr-001-agent-first-command-and-lifecycle.md`

必须检查：

- `session create|attach|recreate` 是唯一 lifecycle 主路
- `open` 只做导航，不能创建 session，不能改变 headed/headless/profile/persistent shape
- `auth` 只执行内置 auth provider，不创建 session，不改变 browser shape
- `batch` 只走结构化 `string[][]`，不能包装成全 CLI parity

### P0 / P1：Command Contract Drift

重点路径：

- `src/app/commands/**`
- `src/app/output.ts`
- `src/app/batch/**`
- `src/domain/**`

必须检查：

- 新命令、删除命令、flag 变化是否同步 skill
- 错误码、输出 envelope、默认输出是否符合 Agent-readable contract
- JSON 输出是否仍适合脚本解析
- batch 子集是否保持显式收窄
- action 结果是否保留必要 diagnostics/run evidence

### P0 / P1：Recoverability And Limitation Honesty

重点路径：

- `src/domain/session/routing.ts`
- `src/infra/playwright/runtime/**`
- `skills/pwcli/references/failure-recovery.md`
- `docs/architecture/domain-status.md`

必须检查：

- 新 blocked state 或 limitation 是否有恢复路径
- limitation code 不能包装成已支持
- modal / dialog / attach / HAR / clock 等 substrate 限制不能被文档或输出误导
- recover hint 必须是当前 shipped command

### P0 / P1：Skill And Architecture Sync

同步矩阵：

| 改动 | 必须同步 |
|---|---|
| 命令、flag、错误码、输出变化 | `skills/pwcli/` |
| 新 limitation / recoverability | `skills/pwcli/references/failure-recovery.md` |
| 新工作流 | `skills/pwcli/references/workflows.md` 或 `skills/pwcli/workflows/*.md` |
| 领域边界变化 | `docs/architecture/` |
| review / skill 维护规则变化 | `.claude/` 和 `AGENTS.md` |

文档问题只在下面情况升级：

- 破坏 active contract
- 把 future design 写成当前能力
- 隐藏 limitation
- 给出不存在的命令、flag、错误码或恢复路径
- 产生第二套使用教程

### P1：Verification Coverage

行为变更必须有验证。

优先要求：

```bash
pnpm typecheck
pnpm build
pnpm smoke
```

如果改动影响深链路，检查是否需要：

```bash
pnpm test:dogfood:e2e
```

可以接受等价的更小验证，但 review 必须确认它覆盖了变更风险。

## 2. pwcli 专项风险清单

### 2.1 TOCTOU

重点查：

- projection 后再按 index、current page、old selector 执行写操作
- page list / frame list / dialog event 作为 authoritative live state 使用
- close / select / upload / download / mock mutation 使用过期目标

### 2.2 Run-Code Lane

重点查：

- `managedRunCode` 内部失败是否被解析成稳定错误
- modal blocked 是否会导致恢复路径丢失
- helper code 是否返回可解析 JSON
- 外部脚本是否被误挂到 auth provider 体系

### 2.3 Diagnostics Integrity

重点查：

- action 后 `diagnosticsDelta` 是否丢失
- run event 是否仍能被 `diagnostics runs|show|grep|digest` 消费
- export fields / aliases 是否仍稳定
- console-resource-error / network bridge 是否被破坏

### 2.4 Auth Boundary

重点查：

- auth provider 必须是内置 registry
- `fixture-auth` 只能做 contract 测试，不进入用户主流程
- provider 不能返回 token、cookie 全量、短信码、个人敏感信息
- `dc` provider 不暴露已移除或未支持参数

### 2.5 Docs And Skill Drift

重点查：

- README 不能变成第二套命令教程
- docs/architecture 不能重复 skill 教程
- skill 不能放过程调研、历史迁移、业务账号、内部 token
- `.claude/` 只允许承载 Claude Code 项目指令和 rules；需要保留的项目结论必须进入 skill、ADR 或 architecture docs

## 3. 报告格式

每条 finding 必须包含：

- 严重级别：P0 或 P1
- 文件和行号
- 具体破坏的 contract
- 可复现或可静态证明的证据
- 建议修复方向

不要报告：

- 无法证明的猜测
- 仅风格偏好
- 与本 PR 无关的旧问题
- 已被现有测试/文档明确覆盖且无新增风险的问题

## 4. 典型高价值 finding

高价值：

```text
tab close 接受 pageId，但实现先解析成旧 index 再执行 tab-close，页面列表变化时可能关闭错误 tab。
```

低价值：

```text
建议把这个函数拆小一点。
```

高价值：

```text
新增错误码没有进入 failure-recovery，Agent 遇到失败后没有可执行恢复路径。
```

低价值：

```text
文档措辞可以更清楚。
```

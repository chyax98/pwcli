# Architecture

这套文档只回答 3 件事：

1. 现在的 `pwcli` 是怎么组织的
2. 当前每个领域已经做到什么程度
3. 有哪些明确限制和后续扩展口

它不负责命令教程。  
命令教程只看 [skills/pwcli/SKILL.md](../../skills/pwcli/SKILL.md)。

## 当前结构

```text
src/
  app/
    commands/
    batch/
    output.ts
  domain/
    session/
    workspace/
    interaction/
    identity-state/
    diagnostics/
    bootstrap/
    environment/
  infra/
    playwright/
    fs/
    auth-providers/
```

分层责任：

- `app`
  - commander 命令
  - batch 输入
  - JSON envelope
- `domain`
  - lifecycle 语义
  - workspace / diagnostics / environment / bootstrap 编排
- `infra`
  - Playwright substrate
  - run dir / skill path / 内置 auth provider / 外部脚本执行适配

## 当前核心闭环

### 1. 探索闭环

```text
session create -> observe/page/read-text/snapshot
```

### 2. 执行诊断闭环

```text
click/fill/type/wait -> diagnosticsDelta -> console/network/errors/export
```

### 3. 接管复用闭环

```text
session attach -> state/profile/auth provider -> continue
```

## 核心文档

- 文档规约：[documentation-governance.md](documentation-governance.md)
- 领域现状：[domain-status.md](domain-status.md)
- 决策 1：[adr-001-agent-first-command-and-lifecycle.md](adr-001-agent-first-command-and-lifecycle.md)
- 决策 2：[adr-002-diagnostics-mock-environment.md](adr-002-diagnostics-mock-environment.md)
- Clock survey：[environment-clock-survey.md](environment-clock-survey.md)
- Workspace mutation contract：[workspace-mutation-contract.md](workspace-mutation-contract.md)
- E2E 计划：[e2e-dogfood-test-plan.md](e2e-dogfood-test-plan.md)
- E2E 体验报告：[e2e-dogfood-experience-report.md](e2e-dogfood-experience-report.md)

## 文档边界

- 命令教程只看 `skills/pwcli/`
- `docs/architecture/` 只保留最终架构文档
- planning / survey / review 草案进 `.claude/` 本地归档，不进 git

## 明确边界

- `open` 只做导航
- `auth` 只做内置 auth provider 执行
- `batch` 只承诺稳定子集，不追求全 CLI parity
- diagnostics 优先 query/export，不优先扩新的录制系统
- mock 先做 route 第一层，环境控制先做 public API 直映射
- raw CDP substrate、observe stream、workspace 写操作、HAR 热录制继续后置

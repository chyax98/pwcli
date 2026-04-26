# Architecture

这套文档只回答 3 件事：

1. 现在的 `pwcli` 是怎么组织的
2. 当前每个领域已经做到什么程度
3. 有哪些明确限制和后续扩展口

它不负责命令教程。  
命令教程只看 [skills/pwcli/SKILL.md](/Users/xd/work/tools/pwcli/skills/pwcli/SKILL.md)。

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
    plugins/
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
  - run dir / skill path / plugin 解析

## 当前核心闭环

### 1. 探索闭环

```text
session create -> snapshot/page/read-text/observe
```

### 2. 执行诊断闭环

```text
click/fill/type/wait -> diagnosticsDelta -> console/network/errors/export
```

### 3. 接管复用闭环

```text
session attach -> state/profile/auth/plugin -> continue
```

## 核心文档

- 领域现状：[domain-status.md](/Users/xd/work/tools/pwcli/docs/architecture/domain-status.md)
- 决策 1：[adr-001-agent-first-command-and-lifecycle.md](/Users/xd/work/tools/pwcli/docs/architecture/adr-001-agent-first-command-and-lifecycle.md)
- 决策 2：[adr-002-diagnostics-mock-environment.md](/Users/xd/work/tools/pwcli/docs/architecture/adr-002-diagnostics-mock-environment.md)
- E2E 计划：[e2e-dogfood-test-plan.md](/Users/xd/work/tools/pwcli/docs/architecture/e2e-dogfood-test-plan.md)
- E2E 体验报告：[e2e-dogfood-experience-report.md](/Users/xd/work/tools/pwcli/docs/architecture/e2e-dogfood-experience-report.md)

## 明确边界

- `open` 只做导航
- `auth` 只做 plugin 执行
- `batch` 只承诺稳定子集，不追求全 CLI parity
- diagnostics 优先 query/export，不优先扩新的录制系统
- mock 先做 route 第一层，环境控制先做 public API 直映射
- raw CDP substrate、observe stream、workspace 写操作、HAR 热录制继续后置

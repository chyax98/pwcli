# Architecture

`docs/architecture/` 只维护 `pwcli` 的架构事实、领域状态、限制和扩展方向。

命令教程只看 [`skills/pwcli/SKILL.md`](../../skills/pwcli/SKILL.md)。Codex 项目维护规则看 [`.codex/`](../../.codex/README.md)。

## 先读顺序

| 顺序 | 文件 | 用途 |
|---|---|---|
| 1 | [documentation-governance.md](documentation-governance.md) | 文档边界、真相优先级、归档规则 |
| 2 | [domain-status.md](domain-status.md) | 当前各领域实现、限制、扩展口 |
| 3 | [adr-001-agent-first-command-and-lifecycle.md](adr-001-agent-first-command-and-lifecycle.md) | lifecycle 和命令边界 |
| 4 | [adr-002-diagnostics-mock-environment.md](adr-002-diagnostics-mock-environment.md) | diagnostics、mock、environment 取舍 |

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

## 分层责任

- `app`
  - commander 命令
  - batch 输入
  - text / JSON 输出渲染
- `domain`
  - lifecycle 语义
  - workspace / diagnostics / environment / bootstrap 编排
- `infra`
  - Playwright substrate
  - run dir / skill path / 内置 auth provider / 外部脚本执行适配

## 核心闭环

探索：

```text
session create -> observe/page/read-text/snapshot
```

执行诊断：

```text
click/fill/type/wait -> diagnosticsDelta -> console/network/errors/export
```

接管复用：

```text
session attach -> state/profile/auth provider -> continue
```

## 文档地图

| 类别 | 文件 |
|---|---|
| 治理 | [documentation-governance.md](documentation-governance.md) |
| 现状 | [domain-status.md](domain-status.md) |
| ADR | [adr-001-agent-first-command-and-lifecycle.md](adr-001-agent-first-command-and-lifecycle.md)、[adr-002-diagnostics-mock-environment.md](adr-002-diagnostics-mock-environment.md) |
| Contract | [workspace-mutation-contract.md](workspace-mutation-contract.md) |
| 验证 | [e2e-dogfood-test-plan.md](e2e-dogfood-test-plan.md)、[e2e-dogfood-experience-report.md](e2e-dogfood-experience-report.md) |
| 技术结论 | [environment-clock-survey.md](environment-clock-survey.md) |

## 明确边界

- `open` 只做导航
- `auth` 只做内置 auth provider 执行
- `batch` 只承诺稳定子集，不追求全 CLI parity
- diagnostics 优先 query/export，不优先扩新的录制系统
- mock 已覆盖当前需要的第二层能力，环境控制优先走 Playwright Core 公开能力
- raw CDP substrate、observe stream、workspace 写操作、HAR 热录制继续后置

## 维护规则

- 新命令、flag、错误码、输出变化：先同步 `skills/pwcli/`。
- 领域边界变化：同步 `domain-status.md` 或新增 ADR。
- 新 limitation 或 recoverability：同步 `skills/pwcli/references/failure-recovery.md`。
- 过程计划、survey 原稿、迁移记录、review 笔记：放 `.claude/` 本地归档，不进入 docs 展示面。

# Architecture

`docs/architecture/` 只维护 `pwcli` 的架构事实、领域状态、限制和扩展方向。

命令教程只看 [`skills/pwcli/SKILL.md`](../../skills/pwcli/SKILL.md)。Agent 项目规则看 [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md) 和 [`.claude/rules/`](../../.claude/rules/)。

## 先读顺序

| 顺序 | 文件 | 用途 |
|---|---|---|
| 1 | [documentation-governance.md](documentation-governance.md) | 文档边界、真相优先级、归档规则 |
| 2 | [domain-status.md](domain-status.md) | 当前各领域实现、限制、扩展口 |
| 3 | [command-surface.md](command-surface.md) | 当前命令能力面和源码入口 |
| 4 | [adr-001-agent-first-command-and-lifecycle.md](adr-001-agent-first-command-and-lifecycle.md) | lifecycle 和命令边界 |
| 5 | [adr-002-diagnostics-mock-environment.md](adr-002-diagnostics-mock-environment.md) | diagnostics、mock、environment 取舍 |

## 当前结构

```text
src/
  app/
    commands/
    batch/
    output.ts
  domain/
    session/
    interaction/
    diagnostics/
  infra/
    playwright/
      runtime/
    auth-providers/
    fs/
    system-chrome/
```

## 分层责任

- `app`
  - commander 命令
  - batch 输入
  - text / JSON 输出渲染
- `domain`
  - lifecycle、interaction、diagnostics 的纯语义和结果模型
  - 不承载 Playwright substrate 细节
- `infra`
  - Playwright daemon / runtime substrate
  - run dir / skill path / 内置 auth provider / system Chrome / 外部脚本执行适配

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
| 命令面 | [command-surface.md](command-surface.md) |
| ADR | [adr-001-agent-first-command-and-lifecycle.md](adr-001-agent-first-command-and-lifecycle.md)、[adr-002-diagnostics-mock-environment.md](adr-002-diagnostics-mock-environment.md)、[adr-003-environment-clock-boundary.md](adr-003-environment-clock-boundary.md) |
| Contract | [workspace-mutation-contract.md](workspace-mutation-contract.md) |
| Analysis | [browser-task-state-model.md](browser-task-state-model.md) |
| 验证 | [e2e-dogfood-test-plan.md](e2e-dogfood-test-plan.md)、[e2e-dogfood-experience-report.md](e2e-dogfood-experience-report.md) |
| 技术结论 | 已吸收到 ADR / domain-status |
| 外部基准调研 | 历史调研不作为当前架构入口；稳定结论应吸收到 ADR / domain-status |
| 发布 | [release-v0.1.0.md](release-v0.1.0.md) |

## 明确边界

- `open` 只做导航
- `auth` 只做内置 auth provider 执行
- auth provider 是内置 registry，不是外部 plugin 系统
- `batch` 只承诺稳定子集，不追求全 CLI parity
- diagnostics 优先 query/export，不优先扩新的录制系统
- mock 已覆盖当前需要的第二层能力，环境控制优先走 Playwright Core 公开能力
- raw CDP substrate、observe stream、workspace 写操作、HAR 热录制继续后置

## 维护规则

- 新命令、flag、错误码、输出变化：先同步 `skills/pwcli/`。
- 领域边界变化：同步 `domain-status.md` 或新增 ADR。
- 新 limitation 或 recoverability：同步 `skills/pwcli/references/failure-recovery.md`。
- 过程计划、survey 原稿、迁移记录、review 笔记不进入 docs 展示面；`.claude/` 只允许 Claude Code 项目指令和 rules，项目过程记录应放 GitHub issues / PR，稳定结论回写 ADR 或 `domain-status.md`。

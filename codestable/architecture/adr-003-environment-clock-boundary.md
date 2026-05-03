# ADR-003: Environment Clock Boundary

状态：accepted  
更新时间：2026-05-02

## Context

`pw environment clock` 需要提供足够稳定的时间控制能力，用于受控测试和复现时间相关页面行为。该能力必须复用 Playwright Core 已有 API，不引入 raw CDP substrate 或第二套 environment runtime。

## Decision

当前命令面只承诺：

- `pw environment clock install`
- `pw environment clock set <iso>`
- `pw environment clock resume`

语义：

1. `install`：安装 fake timers。
2. `set <iso>`：把页面上下文当前时间设到目标 ISO 时间。
3. `resume`：恢复时间继续流动。

`clock set` 要求先 `clock install`。实现优先使用 Playwright Core 的 stable clock API；如果底层只有等价 fallback，则保持同一 CLI contract。

## Consequences

- 当前 `clock set` 是 shipped capability，不再作为 limitation 暴露。
- 命令心智保持简单：install → set → resume。
- 不把 clock 扩成完整时间编排平台。
- 复杂时间推进能力只在真实高频场景出现后再评估。

## Deferred

以下能力不进入当前主线：

- `fastForward`
- `runFor`
- explicit pause / freeze / advance command split
- 时间编排 DSL
- raw CDP based time substrate

## Documentation Sync

- 使用路径：`skills/pwcli/SKILL.md`
- 精确参数：`skills/pwcli/references/command-reference-advanced.md`
- 领域现状：`docs/architecture/domain-status.md`

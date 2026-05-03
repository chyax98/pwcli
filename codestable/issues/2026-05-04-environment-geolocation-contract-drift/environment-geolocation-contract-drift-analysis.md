---
doc_type: issue-analysis
issue: 2026-05-04-environment-geolocation-contract-drift
status: confirmed
root_cause_type: data-format
related:
  - environment-geolocation-contract-drift-report.md
tags:
  - environment
  - command-contract
  - skill-drift
---

# environment geolocation set 参数 Contract 漂移根因分析

## 1. 问题定位

| 关键位置 | 说明 |
|---|---|
| `src/cli/commands/environment.ts:7` | `geolocation set` 只声明 `sharedArgs` 和 `accuracy`，没有声明 `lat` / `lng` flag；实际读取 `positionals(a)[0]` 和 `positionals(a)[1]`。 |
| `src/cli/commands/_helpers.ts:13` | `positionals()` 只读取 citty 的 `args._` 数组；未声明的 `--lat/--lng` 不会进入 latitude/longitude。 |
| `src/engine/environment.ts:133` | engine 层需要明确的 `latitude` / `longitude` number，并把它们传给 `context.setGeolocation()`。 |
| `skills/pwcli/SKILL.md:363` | 主 skill 示例写成 `--lat 37.7749 --lng -122.4194`，与 CLI 实现不一致。 |
| `skills/pwcli/references/command-reference-advanced.md:284` | command reference 也写成 `--lat <lat> --lng <lng>`。 |
| `codestable/architecture/commands/tools.md:94` | command architecture 记录的是 positional latitude/longitude，与 skill 说法冲突。 |

## 2. 失败路径还原

**正常路径**：用户执行 `pw environment geolocation set -s agdog1 37.7749 -- -122.4194` → citty 把两个数放进 `args._` → `environment.ts` 从 `positionals(a)` 读到 latitude/longitude → `managedEnvironmentGeolocationSet()` 调用 Playwright `context.setGeolocation()` → 返回 geolocation state。

**失败路径 A（按 skill 执行）**：用户执行 `pw environment geolocation set -s agdog1 --lat 37.7749 --lng -122.4194` → CLI 没有声明 `lat` / `lng` 参数 → `positionals(a)` 没有拿到 longitude → engine 收到 `longitude: undefined` → Playwright 报 `geolocation.longitude: expected float, got undefined`。

**失败路径 B（按直觉 positional 执行）**：用户执行 `pw environment geolocation set -s agdog1 37.7749 -122.4194` → 负数 longitude 被 CLI parser 当作 option-like token 处理，未进入第二个 positional → engine 仍收到 `longitude: undefined` → 同样失败。

**分叉点**：`src/cli/commands/environment.ts:7` — CLI contract 与 skill contract 不一致，且 positional 方案没有处理负数 longitude 的可用性陷阱。

## 3. 根因

**根因类型**：data-format

**根因描述**：`environment geolocation set` 的源码实际 contract 是 positional latitude/longitude，但中文 skill 和 command reference 写成 `--lat/--lng` flag。由于 CLI 没有声明这两个 flag，Agent 按 skill 执行时不会把经纬度传入 `managedEnvironmentGeolocationSet()`。即使 Agent 猜到 positional，西经/南纬这类负数也需要 `--` 分隔，否则第二个 positional 仍可能丢失。最终 Playwright 接收到 `longitude: undefined` 并失败。

**是否有多个根因**：是。

- 主根因：CLI 实现和 skill/reference 的参数形态不一致。
- 次根因：当前 positional 参数形态对负数 longitude 不友好，help 也没有提示。

## 4. 影响面

- **影响范围**：影响所有按 skill/reference 设置 geolocation 的 Agent；也影响使用负数 longitude 的 positional 用户。
- **潜在受害模块**：`environment geolocation set`、controlled-testing workflow、任何依赖地理位置复现的 Agent dogfood 场景。
- **数据完整性风险**：无持久数据损坏风险；失败发生在 BrowserContext mutation 前。
- **严重程度复核**：维持 P1。核心主链不受影响，但它破坏了 documented command contract，并会阻断 controlled testing/environment 场景。

## 5. 修复方案

### 方案 A：支持 `--lat/--lng`，保留 positional 兼容

- **做什么**：在 `src/cli/commands/environment.ts` 为 `geoSet` 增加 `lat` / `lng` 参数定义；读取时优先 `args.lat` / `args.lng`，没有则 fallback 到 positionals；补缺参 guard，给稳定错误码和恢复建议；同步 skill、command reference、command architecture；补一个聚焦 CLI/integration 测试。
- **优点**：与当前中文 skill 对齐，负数 longitude 不再需要 `--`，Agent 可用性最好；保留 positional 不破坏已有用户。
- **缺点 / 风险**：需要小幅改代码、输出错误处理和测试；要确认 `lng` 命名是否接受 `--longitude` alias。
- **影响面**：`src/cli/commands/environment.ts`、skill/reference/command docs、测试。

### 方案 B：不改代码，只把 skill/docs 改成 positional + `--` 分隔

- **做什么**：把 skill/reference 示例改为 `pw environment geolocation set -s test-a 37.7749 -- -122.4194`，help 无法展示 positional 的限制写进 failure recovery 或 gotchas。
- **优点**：不碰代码，最快消除 skill 错误示例。
- **缺点 / 风险**：Agent 可用性差；help 仍然不教人传 latitude/longitude；负数分隔是隐性陷阱，后续还会反复踩。
- **影响面**：只改文档。

### 方案 C：改成只接受 positional，并在 CLI 层做强校验和错误提示

- **做什么**：保留 positional contract，但在 `environment.ts` 对缺失/非法经纬度做显式校验，错误提示写出 `pw environment geolocation set -s <name> <lat> -- <lng>`；同步 docs。
- **优点**：比方案 B 更诚实，错误恢复明确；代码改动小于方案 A。
- **缺点 / 风险**：仍不如 `--lat/--lng` 适合 Agent；负数 longitude 的 `--` 规则仍然存在。
- **影响面**：`src/cli/commands/environment.ts`、skill/reference/command docs、测试。

### 推荐方案

**推荐方案 A**。理由：用户刚明确产品核心用户是 Agent，skill 是产品面的一部分。`--lat/--lng` 对 Agent 更稳定、可读、可由 help 明确展示，也避开负数 longitude 的 positional parser 陷阱；保留 positional fallback 可以降低兼容风险。

## 6. 方案确认

本轮 goal-driven 执行按推荐方案 A 进入修复：支持 `--lat/--lng`，保留 positional fallback，并补聚焦 contract 验证。

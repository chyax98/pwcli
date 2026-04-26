# E2E Dogfood Experience Report

更新时间：2026-04-26  
状态：active

## 1. 执行范围

本轮完成了 3 件事：

1. 落地真实 dogfood fixture app  
   - [scripts/e2e/dogfood-server.js](../../scripts/e2e/dogfood-server.js)
2. 落地完整系统验证脚本  
   - [scripts/e2e/pwcli-dogfood-e2e.sh](../../scripts/e2e/pwcli-dogfood-e2e.sh)
3. 做一轮独立 agent 体验反馈  
   - 使用现有 `Godel` agent
   - 基于 [skills/pwcli/SKILL.md](../../skills/pwcli/SKILL.md) 真实 dogfood

## 2. fixture app 覆盖

当前 dogfood app 覆盖了这些能力面：

- 深路径导航
- 登录与认证 cookie / localStorage / sessionStorage
- 深层 reproduce 页面
- diagnostics 请求链
- route mock
- offline / geolocation / permissions / clock
- upload / download / drag
- modal blockage
- bootstrap
- batch

入口：

- `http://127.0.0.1:43279/login`
- `http://127.0.0.1:43279/app/projects/alpha/incidents/checkout-timeout/reproduce`

## 3. 我们真实跑过的系统验证

已跑通：

- `pnpm smoke`
- `pnpm test:dogfood:e2e`

其中 `test:dogfood:e2e` 真实覆盖了：

1. login -> deep path exploration
2. reproduce bug -> diagnostics digest / network / errors
3. route add -> route load -> route remove
4. offline / geolocation / permissions / clock
5. upload / download / drag
6. bootstrap + `pw code --file`
7. modal blockage -> `doctor` -> `session recreate`
8. state save/load reuse
9. batch file execution
10. diagnostics digest / export / runs / show / grep

## 4. 过程中修掉的真实问题

这轮 dogfood 不只是验证，也直接抓出了并修掉了几个真实问题。

### 4.1 `state save/load` 实质不可用

原始症状：

- `state save` 返回成功，但不落盘
- `state load` 返回成功，但新 session 拿不到 auth cookie

处理：

- 把实现从 daemon 文件结果链切走
- 直接在项目层走 Playwright Core `storageState()` / `setStorageState(...)`

当前落点：

- [src/infra/playwright/runtime/identity-state.ts](../../src/infra/playwright/runtime/identity-state.ts)

### 4.2 `session recreate` 仍走旧 state-save 路径

原始症状：

- modal recoverability 场景下，`session recreate` 因临时 `state.json` 丢失而失败

处理：

- 改成直接调用项目层 `managedStateSave`

当前落点：

- [src/app/commands/session.ts](../../src/app/commands/session.ts)

### 4.3 `route load` 返回 envelope 不完整

原始症状：

- `route load` 成功，但缺少常规 session envelope 信息

处理：

- 补齐 `session` 返回

当前落点：

- [src/app/commands/route.ts](../../src/app/commands/route.ts)

## 5. 当前已确认的优点

### 5.1 session-first 心智是对的

`session create|attach|recreate` 收口以后，主路非常清楚。  
对 agent 来说，这条 contract 很稳。

### 5.2 `diagnostics digest` 非常值钱

这是当前最好用的第一层诊断入口。

真实价值：

- 动作后快速看最相关信号
- 不需要先手动拼 `console + network + errors`
- run 级 digest 也适合交接

### 5.3 route / environment 已经进入可用阶段

不是 demo 能力了。  
在 dogfood app 里已经可以稳定复现：

- mock 接管
- offline
- geolocation
- permissions

### 5.4 batch 收窄是对的

当前 `string[][]` 子集虽然窄，但稳定。  
对 agent 来说，这比“看起来支持一切，实际上会碎”的 contract 更好。

## 6. 当前主要问题

这是本轮独立 agent 体验反馈和我自己的系统验证合并后的结果。

### P1-1 依赖步骤必须串行，但引导还不够硬

问题：

- 同一个 session 里的依赖步骤如果并行，容易触发 `SESSION_NOT_FOUND` 或读到旧页面状态

影响：

- 对多 agent / 自动编排尤其危险

处理建议：

- skill 里继续强化“依赖步骤必须串行”
- 后续如果需要，再考虑更明确的 batch / flow guidance

### P1-2 modal recovery contract 仍然需要继续收紧

当前真实行为：

- 触发 modal 的 `click` 自己就可能直接返回 `MODAL_STATE_BLOCKED`
- 后续读命令现在稳定返回 `MODAL_STATE_BLOCKED`
- `doctor` 默认会返回 compact recovery summary
- `dialog accept|dismiss` 已经成为当前原地恢复主路

问题：

- 目前只覆盖 browser dialog handle
- 仍然没有更复杂页面阻断控件的统一恢复 contract

处理建议：

- 保持当前 blocked contract
- 后续如果要继续扩，只往 dialog 恢复的边界上做深，不再扩旁路

### P1-3 `observe status` 默认输出过大

问题：

- 旧输出存在明显重复。

影响：

- 已在 follow-up 修复：
  - 默认 compact
  - `--verbose` 再展开

处理建议：

- 继续把 compact 视为唯一默认主路

### P1-4 `doctor` 默认输出过大

问题：

- 旧输出对恢复场景来说偏大

处理建议：

- 已在 follow-up 修复：
  - 默认 compact
  - `--verbose` 才给完整 probe 细节

### P1-5 `page dialogs` 还是投影

这个不是 bug，是明确边界。  
但在真实使用里，这条限制很容易被误解成“当前 dialog 真相”。

处理建议：

- skill 和命令参考继续强调

## 7. Token / round-trip 观察

### 7.1 当前最省的主路

这条最好：

```bash
pw click ...
pw diagnostics digest --session ...
```

原因：

- `click` 自带 `diagnosticsDelta`
- `digest` 再补高信号摘要

这两条组合的成本低于：

- `console`
- `network`
- `errors recent`
- `diagnostics show`

全都先跑一遍。

### 7.2 当前偏贵的命令

- `observe status`
- `doctor`

原因：

- 默认输出过大
- 重复字段多

## 8. 对 skill 的结论

当前 skill 整体方向是对的。

这轮已经继续补强：

- 串行依赖规则
- `diagnostics digest` 作为第一诊断入口
- modal recoverability 的后续 `state load + open` 提示

仍需持续维护的点：

1. 所有高频主链都要落进 workflows
2. 所有限制都要落进 failure-recovery
3. 不再让 README 抢走教程职责

## 9. 当前建议的后续优先级

1. **Compact diagnostics / doctor**
2. **modal recovery contract 继续统一**
3. **mock 第二层**
   - richer matching
   - inject
   - response patch helper
4. **environment deepening**
   - 如有真实场景，再补 `fastForward` / `runFor` / explicit pause

## 10. 当前结论

`pwcli` 已经从“命令集合”进入“能真实 dogfood 的内部工具”阶段了。

当前最强的部分：

- session-first
- diagnostics digest
- mock 第一层
- environment 第一层
- real e2e dogfood coverage

当前最该继续打磨的部分：

- blocked/recovery 语义
- 大输出命令的 compact 设计
- 让 skill 更强硬地约束 agent 串行执行

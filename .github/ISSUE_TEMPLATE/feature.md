---
name: Feature / Enhancement
about: 新能力、命令扩展、输出改进
title: "[domain]: [verb] [what] — [one-line agent value]"
labels: enhancement
assignees: ''
---

<!-- 
  填写前请通读所有必填项。
  空着必填项 = 这个 issue 没想清楚，不应该进入 backlog。
  如果某项真的不适用，写 "N/A + 原因"，不能留空。
-->

## 🎯 Agent 任务场景（必填）

> 描述一个真实的 Agent 执行任务的链路，说明这个能力在链路的哪一步缺失。
> 格式：**"Agent 正在做 X，它需要 Y，但目前 Y 不存在/不够用，导致 Z。"**

<!--
示例：Agent 正在执行登录后跳转到首页的流程。它调用 `pw click "Sign in"` 后，
页面在新 tab 里打开了 dashboard，但 click 的返回结果里没有任何关于新 tab 的信息，
导致 Agent 认为导航失败，开始无效重试。
-->

**任务链路**（写出完整的 pw 命令序列）：
```
pw session create ...
pw ...
pw ...   ← 此处缺失/不足
pw ...
```

**Agent 的实际输出/错误**（粘贴真实 CLI 输出，不是假设）：
```
（粘贴实际输出）
```

**Agent 被迫做的 workaround**（如果有）：
```
（描述 workaround 或写 "无可用 workaround，直接卡住"）
```

---

## 📋 产品理念合规检查（必填，逐项打勾或说明不适用）

> pwcli 是 Agent 操作浏览器的眼和手，基于 playwright-core，最小化手搓代码。
> 下面每一项必须明确回答。

- [ ] **Agent-first**：这个能力的主要消费者是 Agent 程序，不是人类用户。
  - 说明：`____`

- [ ] **playwright-core 优先**：先确认 playwright-core 是否已原生支持此能力。
  - Playwright API：`page.xxx()` / `context.xxx()` / `____`（如没有写 "无原生 API"）
  - 实现方式：直接暴露现有 API / 需要新 substrate / 需要手搓逻辑

- [ ] **最小接口**：这个命令的 flag 数量 ≤ 必要数量，没有"以后可能用到"的 flag。
  - 拟增加的 flag 列表：`____`
  - 每个 flag 的必要性说明：`____`

- [ ] **输出 compact**：默认输出是 agent-readable text，不是 JSON dump。
  - 默认输出包含哪些字段：`____`
  - 需要 `--verbose` / `--output json` 才能看到的字段：`____`

- [ ] **stable identity**：输出中涉及的对象有 stable id（pageId / runId / sessionName / pattern...）。
  - 输出的 stable id：`____`

- [ ] **失败可恢复**：命令失败时有明确错误码 + 具体下一步命令。
  - 拟定错误码：`____`
  - 恢复建议命令：`____`

- [ ] **不创建第二产品面**：这个能力不绕开现有 session / domain / infra 边界重新建一套。
  - 说明是否复用现有 session lifecycle / managed* 函数：`____`

- [ ] **文档只在 skill 里**：使用说明只进 `skills/pwcli/`，不新建 README / 独立文档。

---

## 🔍 证据（必填，至少一项）

> 只有真实证据才能证明这个问题存在。"我觉得会有用"不是证据。

- [ ] **dogfood 复现**：我在真实任务中遇到了这个问题
  - 描述：`____`
- [ ] **issue / bug report**：有 issue 或 user 报告
  - 链接：`____`
- [ ] **CLI 命令输出**：贴出能证明缺口的实际命令输出
  - 输出：（见上方"Agent 的实际输出"）
- [ ] **竞品/参考实现**：有参考实现证明这个能力的价值
  - 参考：`____`

---

## 📁 代码位置（必填）

> 列出需要新增或修改的文件，说明每个文件的改动性质。

| 文件路径 | 改动类型 | 改动摘要 | 预计行数 |
|---|---|---|---|
| `src/cli/commands/xxx.ts` | 新增 / 修改 | `____` | ~N 行 |
| `src/infra/playwright/runtime/xxx.ts` | 新增 / 修改 | `____` | ~N 行 |
| `src/domain/xxx/xxx.ts` | 新增 / 修改 | `____` | ~N 行 |
| `skills/pwcli/references/xxx.md` | 必须同步 | `____` | — |

**涉及的层**（app / domain / infra，跨层改动需要额外说明）：`____`

**是否需要修改 `src/cli/commands/index.ts`（命令注册）**：是 / 否

---

## ⚠️ 风险评估（必填）

### 破坏性风险

- [ ] **输出 envelope 变化**：修改了现有命令的 JSON 输出结构
  - 受影响的命令：`____`
  - 向后兼容方案：`____`

- [ ] **错误码变化**：删除或重命名了现有错误码
  - 受影响的错误码：`____`

- [ ] **session lifecycle 影响**：修改了 session create / recreate / close 的行为
  - 影响说明：`____`

- [ ] **batch 兼容性**：如果修改了命令参数，是否影响现有 batch 脚本
  - 影响说明：`____`

- [ ] **diagnostics 完整性**：action 结果里的 diagnosticsDelta / run event 是否仍然完整
  - 确认方式：`____`

### 依赖风险

- [ ] **Playwright 内部 API**：是否依赖 Playwright 的 internal / hidden surface（有版本风险）
  - 依赖点：`____`
  - 降级方案：`____`

- [ ] **Node.js 版本**：是否依赖特定 Node.js 版本的 API
  - 依赖点：`____`

---

## 🔧 是否需要重构（必填）

> 不是每个 feature 都需要重构。但如果实现会造成重复代码 / 违反层边界 / 让 god file 更肥，必须说明。

- [ ] **不需要重构**：改动可以干净地插入现有结构
- [ ] **需要小重构**：需要提取公共函数 / 移动代码位置
  - 说明：`____`
- [ ] **需要大重构**：需要新模块 / 改变层边界
  - 说明：`____`
  - 是否应该单独建重构 issue：是 / 否

**删除测试**（对修改的模块做 deletion test）：
> 如果删掉这个新增的模块/函数，复杂度是消失还是转移到 N 个调用方？
- 答：`____`

---

## ✅ 验收标准（必填）

> 必须是可机器验证或可明确人工复现的条件，不能是模糊描述。

### 功能验收
- [ ] `____`（写出具体的 pw 命令 + 期望输出）
- [ ] `____`
- [ ] `____`

### 回归验收
- [ ] `pnpm build` 通过
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm smoke` 通过（如果涉及命令行为变化）
- [ ] 影响到的现有命令的 `--help` 输出未改变（如果不应该改变）

### 文档同步验收
- [ ] `skills/pwcli/` 已更新（哪个文件：`____`）
- [ ] `AGENTS.md` 和 `CLAUDE.md` 已同步更新（如果产品边界、开发、测试或发布规则变化）
- [ ] `.claude/rules/` 已更新（如果 Claude Code 细分规则变化）
- [ ] `skills/pwcli/references/failure-recovery.md` 已更新（如果新增错误码）

---

## 🚫 明确不做的（必填）

> 说明这个 issue 的边界，防止 scope creep。
> "这个 issue 不包含 X，因为 Y。"

- 不包含：`____`，因为 `____`
- 不包含：`____`，因为 `____`

---

## 📊 优先级自评（必填）

> 根据 Agent 主链价值自评。

| 维度 | 评分（高/中/低） | 说明 |
|---|---|---|
| 阻断 Agent 主链 | | |
| 影响高频任务（observe/action/wait/verify/diagnostics/auth） | | |
| 降低恢复成本 | | |
| 降低 token/context 成本 | | |
| 防止 skill 漂移 | | |

**自评优先级**：P1 / P2 / P3

**P1 判断依据**（如果自评 P1，必须满足至少两条）：
- [ ] 有 dogfood / issue / regression 证据证明它阻断 Agent 主链
- [ ] 影响高频 Agent 任务
- [ ] 能显著降低恢复成本
- [ ] 能降低 token / context 成本
- [ ] 能防止 skill 与 CLI 漂移

---

## 📎 参考资料

- 相关代码：`____`
- 相关 issue：`____`
- Playwright 文档：`____`
- 竞品参考：`____`

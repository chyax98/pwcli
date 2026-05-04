# Agent Usability Prioritization

状态：active

这条规则用于评估 pwcli 增强是否值得做、是否进入 P1，以及如何避免凭感觉扩 scope。

核心定义：**pwcli 产品 = CLI substrate + `skills/pwcli/` instructions + Agent workflow regression**。不要只按命令数量或代码完整度判断产品成熟度。

## 1. 评估对象

评估增强时，不问“还能加什么命令”，优先问：

1. Agent 按 skill 能否完成真实任务？
2. Agent 是否能看懂当前页面/状态？
3. Agent 是否能安全行动？
4. 动作后是否有证据确认结果？
5. 失败后是否能恢复，而不是猜？
6. 输出是否节省上下文并保留 stable identity？

## 2. P1 判断标准

一个增强进入 P1，至少满足下面任意两项：

- 有 dogfood / issue / regression 证据证明它阻断 Agent 主链。
- 影响高频 Agent 任务：observe、action、wait、verify、diagnostics、auth/state、batch。
- 能显著降低恢复成本：少猜测、少重复命令、下一步明确。
- 能降低 token / context 成本：默认输出更 compact，完整载荷按需启用。
- 能防止 skill 与 CLI 漂移导致 Agent 按错误教程行动。

只满足“实现上更完整”“命令面更统一”“未来可能用到”的增强，默认不是 P1。

## 3. 增强评估表

提出增强前先写清楚：

| 问题 | 必答 |
|---|---|
| 真实任务是什么？ | 给出 Agent 会执行的任务链路 |
| 现有失败证据是什么？ | issue、dogfood 输出、命令输出、代码路径 |
| 卡在哪一层？ | eyes / hands / evidence / recovery / skill drift / auth-state |
| 预期改善是什么？ | 成功率、恢复步数、输出大小、稳定 ID、错误分支 |
| 验证方式是什么？ | targeted real `pw` command 或 product regression case |
| 增加了什么复杂度？ | 新状态、新 contract、新 docs 维护面 |

没有证据时，先做 audit / dogfood，不直接扩功能。

## 4. Agent 可用性优先级

优先级从高到低：

1. **Recovery**：失败分类、恢复命令、可重试边界、limitation honesty。
2. **Output contract**：compact text、stable ids、非重复 JSON、按需 verbose/full payload。
3. **Evidence**：action target、pageId/navigationId、runId、diagnosticsDelta、artifact path。
4. **Skill alignment**：skill 与 CLI 命令/flag/error/recovery 不漂移。
5. **Regression**：真实 CLI + skill 链路覆盖 Agent 高频路径。
6. **New capability**：只有真实任务卡住时才加新命令或新 substrate。

## 5. 后置默认项

以下能力默认后置，除非有真实高频任务证据：

- raw CDP named-session substrate
- external auth plugin lifecycle
- event stream / persistent diagnostics database
- HAR 热录制；`har start|stop` 只保留为 `UNSUPPORTED_HAR_CAPTURE` 失败 guard
- batch 全命令 parity
- route/mock 通用 DSL 或 GraphQL planner
- clock fastForward/runFor/复杂时间编排
- 页面智能 planner 或站点特化 auth intelligence

## 6. Output / Recovery 红线

如果改动影响输出或错误，必须检查：

- list 类输出是否包含 stable id：session name、pageId、runId、artifact path、route pattern。
- 默认 text 是否给 Agent 读，而不是倾倒 JSON。
- JSON 是否避免无意义重复；完整结果应由 `--verbose` / `--include-results` / `--output json` 明确承担。
- 错误是否给当前 shipped command 作为下一步；不能给 future command。
- limitation code 不能包装成已支持。

## 7. Product Regression 规则

长链路测试的价值在于验证产品，而不是覆盖每个 helper。

可以加入 product regression 的 case：

- 高频 Agent 链路。
- 真实 `pw` 命令 + real session。
- 失败会破坏 eyes / hands / evidence / recovery / skill alignment。
- 有明确成功判据和可读失败输出。

不应加入：

- 内部实现细节。
- 一次性调查脚本。
- 无 Agent 任务语义的边角组合。
- 只为了提高命令面覆盖率的 case。

## 8. Review 应用

review 增强 PR 时，除了 P0/P1 bug，也要判断：

- 是否解决真实 Agent 痛点。
- 是否能用更小的 docs/recovery/output 改动解决，而不是加新能力。
- 是否扩大了 product surface 却没有 skill/regression 同步。
- 是否把 P2/P3 后置项伪装成正式版 blocker。

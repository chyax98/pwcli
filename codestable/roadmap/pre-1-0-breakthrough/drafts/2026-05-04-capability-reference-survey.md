---
doc_type: roadmap-draft
slug: capability-reference-survey
status: draft
created: 2026-05-04
tags: [pre-1-0, capability-survey, command-evaluation]
related_roadmap: pre-1-0-breakthrough
---

# 竞品能力参考与本地边界

## 目标

本轮 1.0 不是只把已有命令跑通，而是对每个 command 做深度评估、评测和 workflow 串联。外部工具只作为能力参照，不直接复制产品边界。

## 参考对象

| 参考对象 | 参考点 | pwcli 取舍 |
|---|---|---|
| Playwright CLI | 本地测试运行、codegen、trace、report、截图/PDF 等成熟 CLI 体验 | 吸收本地验证、证据、trace/report 可复查能力；不把 pwcli 改成 Playwright Test 的替代品 |
| browser-use | Agent 驱动浏览器任务、任务级执行、可观测步骤和 browser control | 吸收 Agent 可执行任务链、step evidence 和任务复盘；不做云端托管执行 |
| Agent Browser / Stagehand 类工具 | observe/act/extract 这类 Agent 友好的浏览器抽象 | 吸收 Agent-first 的观察/动作/提取 ergonomics；但内部仍保持唯一清晰命令实现 |
| cla / Claude Code 类 CLI | 本地 Agent CLI 的会话、命令、文档和工具协作体验 | 吸收本地开发工具的可脚本化、可审计、可恢复体验；不做账号托管或云端 worker |

## 本地边界

必须做：

- 本地浏览器自动化。
- 本地测试/RND/Forge/DC 验证。
- 本地 fixture、mock、environment、trace、diagnostics、evidence bundle。
- Agent 按中文优先 `skills/pwcli/` 能完成真实任务。
- 每个 command 有深评记录和 proven / documented / blocked 状态。

明确不做：

- 云端部署。
- 托管浏览器 fleet。
- 账号、cookie、验证码、session state 托管。
- 无边界平台化 recipe / MCP / userscript 系统。
- 为 Node/Volta/proto 漂移写产品补丁。

## 能力吸收规则

每个外部能力进入 `pwcli` 前必须回答：

1. 是否服务本地 Agent-first 浏览器任务？
2. 是否能用当前命令面表达，还是需要新 command / flag / output contract？
3. 是否能被单 command 深评和 workflow 串联证明？
4. 是否能写入中文优先 skill SOP？
5. 是否违反“不写逻辑向后兼容、不恢复兼容命令、内部实现唯一清晰”的铁律？

不能回答清楚的能力只进入观察项，不进入 1.0 contract。

## 来源

- Playwright CLI docs: `https://playwright.dev/docs/test-cli`
- Playwright command line tools: `https://playwright.dev/docs/cli`
- browser-use docs: `https://docs.browser-use.com/`
- browser-use CLI docs: `https://docs.browser-use.com/open-source/browser-use-cli`
- Claude Code CLI reference: `https://code.claude.com/docs/en/cli-reference`
- Stagehand docs: `https://docs.stagehand.dev/`

---
doc_type: roadmap-draft
slug: capability-reference-survey
status: completed
created: 2026-05-04
last_verified: 2026-05-04
tags: [pre-1-0, capability-survey, command-evaluation]
related_roadmap: pre-1-0-breakthrough
---

# 竞品能力参考与本地边界

## 目标

本轮 1.0 不是只把已有命令跑通，而是对每个 command 做深度评估、评测和 workflow 串联。外部工具只作为能力参照，不直接复制产品边界。

## 参考对象

| 参考对象 | 参考点 | pwcli 取舍 |
|---|---|---|
| Playwright Test CLI | 本地测试运行、codegen、trace viewer、report merge、browser install 等成熟 CLI 体验 | 吸收本地验证、证据、trace/report 可复查能力；不把 pwcli 改成 Playwright Test 的替代品 |
| Playwright Agent CLI | 官方按 Core / Network / Storage / Vision / DevTools / PDF / Testing 分能力组，覆盖 snapshot、interaction、route、state、console、trace、video、dashboard、verify 等 | 吸收 capability group 思路和可监控 session 体验；保持 pwcli 的 session-first lifecycle、中文 SOP 和本地证据链 |
| browser-use CLI | persistent browser automation、多 session daemon、state/click/input/tabs/cookies/wait/get/eval/profile/session 等本地命令面，同时带 cloud/tunnel/API 能力 | 吸收本地 persistent automation、多 session ergonomics、profile/state 经验；cloud/tunnel/API endpoint/托管 profile 明确不做 |
| Agent Browser / Stagehand 类工具 | `observe` / `act` / `extract`：先发现可行动作，再执行或抽取结构化数据；observe 结果可直接复用以减少 token | 吸收 Agent-first 的观察、计划、动作、提取 ergonomics；但内部仍保持唯一清晰命令实现，不引入无边界自然语言 recipe 平台 |
| cla / Claude Code 类 CLI | 本地 Agent CLI 的 pipe、continue/resume、skills/plugins、Chrome integration、tool allowlist、debug/logging、项目本地状态管理 | 吸收本地 CLI 的会话恢复、可脚本化、skill 分发、权限和日志经验；不做 remote-control / 云端 worker |

## 能力候选池

| 能力 | 来源启发 | 1.0 处理 |
|---|---|---|
| command capability groups | Playwright Agent CLI / browser-use CLI | 纳入每命令深评矩阵，按 lifecycle / observe / interaction / diagnostics / storage / environment / artifacts 分组 |
| token-efficient first read | Playwright Agent CLI snapshot / Stagehand observe | 强化 `status`、`read-text`、`snapshot -i` 的 Agent 首读证据；不默认输出超大树 |
| action planning before acting | Stagehand observe | 评估是否需要 `page assess` / `snapshot -i` / `locate` 的 SOP 强化；不直接引入 LLM observe API |
| structured extraction | Stagehand extract / browser-use get | 进入 workflow 深评；先评估现有 `read-text`、`get`、`diagnostics export` 是否足够，不恢复旧 extract recipe |
| trace / video / dashboard | Playwright CLI / Agent CLI | trace/video/dashboard 必须有可复查证据和本地路径；不做云端 viewer |
| state/profile/session reuse | Playwright Agent CLI / browser-use CLI | 加强 auth/state/storage/profile 深评；真实 Forge/DC 进入测试/RND 验证 |
| local scripted escape hatch | browser-use JS/Python / Claude CLI pipe | 保留 `pw code` 作为 escape hatch，但不扩大为长流程 runner |
| permissions/logging/debug | Claude Code CLI | 纳入 evidence bundle / diagnostics 设计；不引入复杂权限系统 |

## 2026-05-04 官方来源核对结论

- Playwright Agent CLI 官方文档把能力分成 Core、Network、Storage、Vision、DevTools、PDF、Testing；这确认了本 roadmap 的 command evaluation matrix 分组是合理方向。
- browser-use CLI 官方文档同时覆盖本地 persistent browser automation 和 cloud/API/tunnel/profile sync；pwcli 只吸收本地浏览器命令面和 daemon/session ergonomics，不吸收云端托管能力。
- Stagehand 官方文档强调 `observe()` 用于发现、计划、缓存和验证动作，并可把 observe result 交给 `act()` / `extract()` 减少 token；pwcli 后续 workflow 可强化 `snapshot -i`、`locate`、`page assess` 的 SOP，但不引入 LLM act/extract 平台。
- Claude Code CLI 官方文档确认本地 Agent CLI 关键能力包括 pipe、continue/resume、auth status、agents/plugins、Chrome integration、permission/tool flags；pwcli 只吸收 skill 分发、可脚本化、日志/证据和本地浏览器接管经验，不做远程控制服务。

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
- Playwright Agent CLI capabilities: `https://playwright.dev/agent-cli/capabilities`
- Playwright Agent CLI getting started: `https://playwright.dev/docs/next/getting-started-cli`
- Playwright command line tools: `https://playwright.dev/docs/cli`
- browser-use docs: `https://docs.browser-use.com/`
- browser-use CLI docs: `https://docs.browser-use.com/open-source/browser-use-cli`
- Claude Code CLI reference: `https://code.claude.com/docs/en/cli-usage`
- Stagehand docs: `https://docs.stagehand.dev/`

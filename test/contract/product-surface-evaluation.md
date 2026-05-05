# pwcli Product Surface Evaluation Contract

本文定义 `pwcli` 当前健康度评测契约。

它不是用户教程。

它不是 roadmap。

它不是命令手册。

它是后续逐项评测 `pwcli` 产品面的执行框架。

目标是回答一个问题：

> 当前仓库是否已经从多轮重构后的复杂状态，收敛成健康、可维护、可验证的产品面？

## 1. 评测原则

### 1.1 不按命令数量判断健康

`pwcli` 的顶层命令很多。

但命令多本身不是问题。

真正的问题是：

- 命令是否服务同一个用户旅程。
- 命令是否共享同一套状态模型。
- 命令是否输出同一种可恢复信封。
- 命令是否有稳定 help。
- 命令是否有真实 fixture 或 contract 证明。
- 命令是否没有越界变成另一种产品。

### 1.2 采用混合评测模式

本项目不能只用单命令测试。

也不能只用端到端场景测试。

评测采用三层混合模型：

| 层级 | 目标 | 例子 |
|---|---|---|
| Journey | 验证一个真实用户旅程是否顺畅 | 登录、复现 bug、抽取列表、诊断失败 |
| Surface | 验证一组命令是否服务同一产品面 | session lifecycle、page reading、diagnostics |
| Command | 验证单命令是否达到当前项目最佳状态 | `click`、`verify`、`har`、`extract` |

### 1.3 只评估当前承诺

不评估已经决定不做的方向。

例如：

- 不评估自研浏览器。
- 不评估系统 Chrome profile 登录态复用。
- 不评估外部 auth plugin。
- 不评估 recipe extraction 平台。
- 不评估 Playwright API 全量包装。
- 不评估云端 workbench。

这些方向如果再次出现，应先走产品边界决策，不进入健康度评测。

## 2. 评分模型

每个产品面按 6 个维度评分。

每项 0 到 5 分。

满分 30 分。

| 分数 | 含义 |
|---:|---|
| 0 | 不存在或方向错误 |
| 1 | 有实现但不可依赖 |
| 2 | 可跑 demo，但 contract 不稳 |
| 3 | 基本可用，有明显风险 |
| 4 | 健康，可维护，有验证 |
| 5 | 非常健康，边界清楚，证据充分 |

### 2.1 评分维度

| 维度 | 问题 |
|---|---|
| Product Fit | 这个产品面是否服务 `Agent-first browser task CLI` 主链？ |
| Journey Completeness | 是否能完成真实用户旅程，而不是只跑单点 demo？ |
| Contract Stability | help、JSON envelope、错误码、exit code 是否稳定？ |
| Evidence & Recovery | 是否提供证据、diagnostics、恢复建议或失败截图？ |
| Test Realism | 是否有真实 CLI integration、contract、smoke 或 e2e 覆盖？ |
| Boundary Hygiene | 是否没有越界变成 planner、IDE、browser、plugin、crawler 或测试框架？ |

### 2.2 健康等级

| 总分 | 等级 | 处理 |
|---:|---|---|
| 27-30 | A | 健康，后续只回归保护 |
| 23-26 | B | 可用，有小缺口 |
| 18-22 | C | 勉强健康，需要补 contract 或 fixture |
| 12-17 | D | 有明显产品风险，需要修 |
| 0-11 | F | 不应继续承诺，考虑砍掉或降级 |

### 2.3 单命令评分补充

单命令不单独看功能是否存在。

单命令至少评估：

- 是否有 `Purpose`、`Examples`、`Notes`。
- 是否支持 `--output json`，或明确说明不支持。
- 成功时是否返回稳定 `data`。
- 失败时是否返回稳定 `error.code`。
- 是否有最小 recovery suggestion。
- 是否受 session/control/action policy 约束。
- 是否有 integration 或 contract 覆盖。
- 是否同步到 `skills/pwcli/`。

## 3. 全局健康 Gate

每次产品面评测前先跑全局 gate。

```bash
git status --short
pnpm check
node dist/cli.js --help
node test/contract/run-all.js core
```

发布级评测再跑：

```bash
pnpm smoke
git diff --check
pnpm pack:check
```

如果全局 gate 不通过，不进入产品面评分。

## 4. 现有评测资产

### 4.1 Fixture

| 资产 | 用途 |
|---|---|
| `test/fixtures/servers/realistic-app.mjs` | 登录、表单、auth state、真实 app 行为 |
| `test/fixtures/servers/dogfood-server.js` | 系统级 dogfood、多页面、多交互、多诊断 |
| `test/fixtures/servers/deterministic-server.js` | 稳定网络、route、batch、环境控制 |
| `test/fixtures/targets/attach-target.js` | attach/connect 目标进程 |
| `test/fixtures/code/*.js` | bootstrap、diagnostics、clock、route verify 代码片段 |
| `test/fixtures/data/*.json` | route、batch、dogfood 数据 |

### 4.2 Test Suites

| 套件 | 用途 |
|---|---|
| `test/unit/` | 纯函数、诊断评分、doctor health |
| `test/integration/` | 真实 CLI 行为 |
| `test/contract/` | help、skill、batch、recovery、HAR、trace 等契约 |
| `test/smoke/pwcli-smoke.sh` | 发布前主链回归 |
| `test/e2e/pwcli-dogfood-e2e.sh` | 系统级 dogfood |
| `test/e2e/pwcli-agent-task-eval.sh` | 外部 Agent runner 评测入口 |

## 5. 产品面清单

### 5.1 Surface A: Session Lifecycle

用户旅程：

Agent 创建一个 named session，打开目标页面，查询状态，复用或重建 session，最后关闭并清理运行态。

关联命令：

- `session`
- `open`
- `status`
- `observe`

核心承诺：

- `session create|attach|recreate` 是唯一 lifecycle 主路。
- `open` 只在已有 session 内导航。
- session name、startup lock、stale cleanup 行为稳定。
- session 状态可读，page URL/title 可读。

现有测试入口：

- `test/integration/session.test.ts`
- `test/integration/session-startup-lock-race.test.ts`
- `test/integration/session-attachable-id.test.ts`
- `test/integration/run-core.js`

评测项：

- [ ] `session create -> status -> close` happy path。
- [ ] duplicate create 行为符合当前 contract。
- [ ] `session recreate` 后 page/session 可用。
- [ ] `session close --all` 清理 live session。
- [ ] startup lock 不产生竞态假失败。
- [ ] attachable id 可用于定位外部 browser server。
- [ ] `open` 不创建 session。
- [ ] `status/observe` text 与 JSON 都能表达 page + stream 状态。

评分：

| 维度 | 分数 | 证据 |
|---|---:|---|
| Product Fit |  |  |
| Journey Completeness |  |  |
| Contract Stability |  |  |
| Evidence & Recovery |  |  |
| Test Realism |  |  |
| Boundary Hygiene |  |  |
| Total |  |  |

### 5.2 Surface B: Page Reading and Workspace Facts

用户旅程：

Agent 在不改变页面的前提下理解当前页面、找到可交互元素、读取文本、查看 tab/frame/dialog/page assessment。

关联命令：

- `read-text`
- `text`
- `snapshot`
- `accessibility`
- `page`
- `tab`
- `screenshot`
- `pdf`

核心承诺：

- read-only 命令不改变页面状态。
- `snapshot -i` 返回可操作 refs。
- refs 可能 stale，必须被清楚说明。
- `page dialogs` 是事件投影，不是 authoritative live set。
- 截图和 PDF 是证据，不是行为断言。

现有测试入口：

- `test/integration/page-reading.test.ts`
- `test/integration/accessibility.test.ts`
- `test/integration/page-assess.test.ts`
- `test/integration/popup.test.ts`
- `test/contract/check-content-boundaries-contract.js`

评测项：

- [ ] `read-text` 返回可见文本，不返回 style/script/svg 噪音。
- [ ] `read-text --selector` 成功和失败都有稳定 contract。
- [ ] `snapshot -i` 返回 refs，且 refs 可被后续 action 使用。
- [ ] stale ref 失败返回可恢复信封。
- [ ] `accessibility` 在常规页面成功。
- [ ] `page list/current/assess/dialogs` 表达当前 workspace facts。
- [ ] `tab select/close` 使用 pageId，不依赖 index。
- [ ] `screenshot` 和 `pdf` 写出 artifact 并返回路径。

评分：

| 维度 | 分数 | 证据 |
|---|---:|---|
| Product Fit |  |  |
| Journey Completeness |  |  |
| Contract Stability |  |  |
| Evidence & Recovery |  |  |
| Test Realism |  |  |
| Boundary Hygiene |  |  |
| Total |  |  |

### 5.3 Surface C: Element and Page Actions

用户旅程：

Agent 根据 ref、selector 或 semantic locator 执行页面动作，并在失败时获得可恢复信号。

关联命令：

- `click`
- `fill`
- `type`
- `press`
- `hover`
- `check`
- `uncheck`
- `select`
- `drag`
- `upload`
- `download`
- `scroll`
- `resize`
- `mouse`
- `dialog`

核心承诺：

- action 成功只证明动作执行，不证明任务成功。
- action 后必须 `wait` 或 read-only 验证。
- 失败要结构化，且有 recovery。
- 常见写操作受 takeover 和 action policy 控制。
- 坐标鼠标是 fallback，不是首选。

现有测试入口：

- `test/integration/interaction.test.ts`
- `test/integration/mouse.test.ts`
- `test/integration/popup.test.ts`
- `test/integration/control-state.test.ts`
- `test/integration/action-policy.test.ts`
- `test/integration/error-messages.test.ts`
- `test/contract/check-recovery-envelope-contract.js`

评测项：

- [ ] `click` 支持 ref、selector、semantic target。
- [ ] `click` 对 popup/new-tab 返回 openedPage。
- [ ] `fill/type/press` 行为区分清楚。
- [ ] `hover/check/uncheck/select` semantic not found 错误码稳定。
- [ ] `drag/upload/download` 有证据路径或明确行为结果。
- [ ] `scroll/resize/mouse` mutation 后可用 read-only 命令验证。
- [ ] native `dialog` 与 HTML modal 边界清楚。
- [ ] takeover 状态阻断写操作。
- [ ] action policy deny 返回稳定 `ACTION_POLICY_DENY`。

评分：

| 维度 | 分数 | 证据 |
|---|---:|---|
| Product Fit |  |  |
| Journey Completeness |  |  |
| Contract Stability |  |  |
| Evidence & Recovery |  |  |
| Test Realism |  |  |
| Boundary Hygiene |  |  |
| Total |  |  |

### 5.4 Surface D: State Checks, Waits, and Assertions

用户旅程：

Agent 在动作前定位目标，在动作后等待状态变化，并用 read-only assertion 判断任务是否成功。

关联命令：

- `locate`
- `get`
- `is`
- `verify`
- `wait`

核心承诺：

- 这组命令 read-only。
- 不做 action planner。
- `verify` 失败必须失败退出。
- `wait` 只证明条件可达，不等于业务成功。
- locator ambiguity 要可见。

现有测试入口：

- `test/integration/verify-failure-run.test.ts`
- `test/integration/error-messages.test.ts`
- `test/integration/interaction.test.ts`
- `test/contract/check-batch-verify-contract.js`
- `test/contract/check-recovery-envelope-contract.js`

评测项：

- [ ] `locate` 返回候选列表，不因默认 nth 制造假唯一。
- [ ] `locate/get --return-ref` 可跨命令使用。
- [ ] `get text/value/attr` 对 target 不存在有清晰错误。
- [ ] `is visible/enabled/checked` 返回稳定 state facts。
- [ ] `verify` success 和 failure exit code 正确。
- [ ] `verify text-absent` 等负向断言稳定。
- [ ] `wait network-idle` 和 `networkidle` 别名收敛。
- [ ] `wait --request/--response` 可用于网络状态。

评分：

| 维度 | 分数 | 证据 |
|---|---:|---|
| Product Fit |  |  |
| Journey Completeness |  |  |
| Contract Stability |  |  |
| Evidence & Recovery |  |  |
| Test Realism |  |  |
| Boundary Hygiene |  |  |
| Total |  |  |

### 5.5 Surface E: Diagnostics and Evidence

用户旅程：

Agent 在复现 bug 或任务失败后，读取 console/network/errors/run events，生成 digest、timeline、bundle，并能交接给人类或下一轮 Agent。

关联命令：

- `console`
- `network`
- `errors`
- `diagnostics`
- `trace`
- `har`
- `sse`
- `doctor`
- `screenshot`
- `pdf`

核心承诺：

- diagnostics 是恢复链路，不是普通日志。
- 高信号错误要优先展示。
- 第三方追踪/遥测噪音只能降权，不能吞掉。
- trace/HAR/video 等 artifact 生命周期要诚实。
- bundle next steps 必须可执行。

现有测试入口：

- `test/integration/diagnostics.test.ts`
- `test/integration/network-body.test.ts`
- `test/integration/sse-observation.test.ts`
- `test/integration/har.test.ts`
- `test/integration/video.test.ts`
- `test/unit/diagnostics-run-digest.test.ts`
- `test/unit/diagnostics-signal-scoring.test.ts`
- `test/contract/check-trace-inspect-contract.js`
- `test/contract/check-har-contract.js`
- `test/contract/check-doctor-modal-contract.js`

评测项：

- [ ] `console` 可按 level/text/current 过滤。
- [ ] `network` 可按 status/url/request-id/body 读取。
- [ ] `errors clear/recent` 支持干净复现窗口。
- [ ] `diagnostics digest` compact 输出高信号摘要。
- [ ] `diagnostics bundle` 写出 artifact 和 next steps。
- [ ] `trace inspect` 对 unsupported filter 明确失败。
- [ ] HAR recording 只能通过 session lifecycle 承诺。
- [ ] HAR replay stop 不清除无关 route。
- [ ] SSE records 可被 `sse` 读取。
- [ ] `doctor` 对 modal/environment 问题给出恢复建议。

评分：

| 维度 | 分数 | 证据 |
|---|---:|---|
| Product Fit |  |  |
| Journey Completeness |  |  |
| Contract Stability |  |  |
| Evidence & Recovery |  |  |
| Test Realism |  |  |
| Boundary Hygiene |  |  |
| Total |  |  |

### 5.6 Surface F: Environment, Bootstrap, Route, and State Mutation

用户旅程：

Agent 为可复现测试控制环境、mock 网络、注入初始化脚本、保存和恢复浏览器状态。

关联命令：

- `environment`
- `bootstrap`
- `route`
- `state`
- `storage`
- `cookies`

核心承诺：

- mutation 命令必须受 takeover/action policy 约束。
- route/mock 要能证明命中。
- allowed-domains 只 guard `pw open`。
- bootstrap 是 setup，不是 userscript 平台。
- state/storage/cookies 操作只作用于明确目标。

现有测试入口：

- `test/integration/bootstrap-persistence.test.ts`
- `test/integration/route-query-header-match.test.ts`
- `test/integration/allowed-domains.test.ts`
- `test/integration/storage-indexeddb-export.test.ts`
- `test/integration/state-diff.test.ts`
- `test/contract/check-environment-geolocation-contract.js`

评测项：

- [ ] `bootstrap` 可持久化到 recreate。
- [ ] missing init script 有清楚 recovery。
- [ ] `route add/list/remove` 模式与输出一致。
- [ ] route patch text/json/body/status 可证明命中。
- [ ] `environment offline/geolocation/permissions/clock` 可验证。
- [ ] `allowed-domains set/status/clear` scope 清楚。
- [ ] `state save/load/diff` 能表达状态变化。
- [ ] `storage` 对 local/session/indexeddb 行为边界清楚。
- [ ] `cookies` 读写删除符合当前 origin/context 预期。

评分：

| 维度 | 分数 | 证据 |
|---|---:|---|
| Product Fit |  |  |
| Journey Completeness |  |  |
| Contract Stability |  |  |
| Evidence & Recovery |  |  |
| Test Realism |  |  |
| Boundary Hygiene |  |  |
| Total |  |  |

### 5.7 Surface G: Auth and Reusable Profiles

用户旅程：

Agent 使用内置 auth provider 或可复用 state/auth profile 完成登录复用，而不依赖用户系统 Chrome profile 登录态。

关联命令：

- `auth`
- `profile`
- `state`

核心承诺：

- `auth` 只执行内置 provider。
- `auth` 不创建 session。
- `profile save-state/load-state` 是可复用登录态主路。
- `profile save-auth/login-auth` 依赖 `PWCLI_VAULT_KEY`。
- 不承诺复用系统 Chrome profile 登录态。

现有测试入口：

- `test/integration/auth-probe.test.ts`
- `test/integration/profile-auth.test.ts`
- `test/integration/profile-state.test.ts`
- `test/integration/profile-capability-probe.test.ts`

评测项：

- [ ] `auth list/info` 对 provider 能力描述准确。
- [ ] `auth <provider>` 不创建 session。
- [ ] provider args 被 redaction 或不泄漏敏感信息。
- [ ] `profile save-state/load-state` 可完成登录态复用。
- [ ] `profile save-auth/login-auth/list-auth/remove-auth` 加密 key contract 清楚。
- [ ] 缺少 `PWCLI_VAULT_KEY` 时失败明确。
- [x] README/skill 不误导系统 Chrome profile 登录态复用。
- [ ] `auth probe` 能输出可行动的 auth state signals。

评分：

| 维度 | 分数 | 证据 |
|---|---:|---|
| Product Fit |  |  |
| Journey Completeness |  |  |
| Contract Stability |  |  |
| Evidence & Recovery |  |  |
| Test Realism |  |  |
| Boundary Hygiene |  |  |
| Total |  |  |

### 5.8 Surface H: Agent Shortcuts and Structured Extraction

用户旅程：

Agent 在常见任务中使用语义捷径、表单分析、批量填表、结构化抽取和 prompt injection 扫描降低命令成本。

关联命令：

- `find-best`
- `act`
- `analyze-form`
- `fill-form`
- `extract`
- `check-injection`

核心承诺：

- `find-best` 只排名候选，不判断任务成功。
- `act` 只做 click-style shortcut，不做 planner。
- `fill-form` 不替代所有复杂表单流程。
- `extract` 是最小 selector schema，不是 recipe 平台。
- `check-injection` 是启发式扫描，不是安全证明。

现有测试入口：

- `test/integration/intent-actions.test.ts`
- `test/integration/form-analysis.test.ts`
- `test/integration/extract.test.ts`
- `test/integration/check-injection.test.ts`
- `test/contract/check-help-contract.js`

评测项：

- [ ] `find-best` 对所有支持 intent 有稳定候选输出。
- [ ] `act` 执行动作后仍提示 wait/verify。
- [ ] unsupported intent 清楚失败。
- [ ] `analyze-form` 返回 label/name/placeholder/id/type/required/options。
- [ ] `fill-form` 按 label/name/placeholder/id 优先级填充。
- [ ] `fill-form` 对不支持字段类型不假成功。
- [ ] `extract` 支持 text/html/attr 和 multiple root。
- [ ] `check-injection` visible/hidden 扫描边界清楚。

评分：

| 维度 | 分数 | 证据 |
|---|---:|---|
| Product Fit |  |  |
| Journey Completeness |  |  |
| Contract Stability |  |  |
| Evidence & Recovery |  |  |
| Test Realism |  |  |
| Boundary Hygiene |  |  |
| Total |  |  |

### 5.9 Surface I: Batch and Escape Hatch

用户旅程：

Agent 对单 session 的依赖步骤做结构化串行执行；必要时使用 `code` 作为 escape hatch，但不把它当长流程 runner。

关联命令：

- `batch`
- `code`

核心承诺：

- `batch` 只接收结构化 `string[][]`。
- `batch` 只承诺稳定子集。
- 不支持命令或参数必须明确失败。
- `code` 是 escape hatch，不是常规主链。
- 两者都受 policy/control gate 约束。

现有测试入口：

- `test/integration/batch.test.ts`
- `test/integration/action-policy.test.ts`
- `test/contract/check-batch-allowlist-contract.js`
- `test/contract/check-batch-verify-contract.js`
- `test/contract/check-run-code-timeout-recovery.js`

评测项：

- [ ] batch allowlist 与代码、help、skill 一致。
- [ ] batch 支持稳定子集的常见 read/action/wait/verify。
- [ ] batch 不静默忽略 unsupported 参数。
- [ ] batch 子步骤失败时返回 `BATCH_STEP_FAILED`。
- [ ] batch verify failure 可向上传播失败。
- [ ] `code` timeout 有恢复信封。
- [ ] `code` 不绕过 action policy。
- [ ] `code` 不被文档包装成长流程 runner。

评分：

| 维度 | 分数 | 证据 |
|---|---:|---|
| Product Fit |  |  |
| Journey Completeness |  |  |
| Contract Stability |  |  |
| Evidence & Recovery |  |  |
| Test Realism |  |  |
| Boundary Hygiene |  |  |
| Total |  |  |

### 5.10 Surface J: Preview, Human Control, and Handoff

用户旅程：

人类可以旁观 Agent session，必要时声明 human takeover，使 CLI 写操作停止；Agent 后续通过 release-control 恢复自动化。

关联命令：

- `stream`
- `view`
- `control-state`
- `takeover`
- `release-control`
- `dashboard`

核心承诺：

- `stream/view` 是本地只读 preview。
- `takeover` 是 hard control gate。
- 不承诺完整人类输入注入。
- 不承诺云端 workbench。
- `dashboard` 是辅助观察，不是主链。

现有测试入口：

- `test/integration/stream-preview.test.ts`
- `test/integration/view-open.test.ts`
- `test/integration/control-state.test.ts`
- `test/integration/diagnostics.test.ts`

评测项：

- [ ] `stream start/status/stop` 本地可用。
- [ ] stream `/status.json` 暴露 page 和 recent events。
- [ ] stream `/frame.jpg` 返回当前页面帧。
- [ ] `view open/status/close` 是 stream alias，语义清楚。
- [ ] `control-state` 默认为 CLI。
- [ ] `takeover` 后 open/action/code/route/bootstrap 等写操作阻断。
- [ ] `release-control` 后自动化恢复。
- [ ] dashboard failure 不假成功。

评分：

| 维度 | 分数 | 证据 |
|---|---:|---|
| Product Fit |  |  |
| Journey Completeness |  |  |
| Contract Stability |  |  |
| Evidence & Recovery |  |  |
| Test Realism |  |  |
| Boundary Hygiene |  |  |
| Total |  |  |

### 5.11 Surface K: Skill, Help, and Release Contract

用户旅程：

Agent 和维护者能从当前 CLI 版本获得准确 help、skill SOP 和 packaged release contract。

关联命令：

- `skill`
- `doctor`
- all command `--help`

核心承诺：

- help 是命令参数真相。
- skill 是 Agent SOP。
- README 是人类入口。
- packaged skill 跟随 CLI 版本。
- package contract 不发布 npm registry，以 GitHub tag 为锚点。

现有测试入口：

- `test/contract/check-help-contract.js`
- `test/contract/check-skill-contract.js`
- `test/contract/check-skill-show-contract.js`
- `test/contract/check-skill-install-contract.js`
- `package.json` scripts

评测项：

- [ ] 顶层 help 列出所有命令。
- [ ] 每个命令 help 有 Purpose/Examples/Notes。
- [ ] `skill refs` 列出 main 和 references。
- [ ] `skill show` 返回 packaged main skill。
- [ ] `skill show --full` 返回 main + references。
- [ ] `skill install` 安装当前 packaged skill。
- [ ] skill 不引用不存在命令。
- [x] README/AGENTS/CLAUDE/skill 分工清楚。
- [ ] `package.json` `bin.pw`、`files`、`scripts` 与发布规则一致。

评分：

| 维度 | 分数 | 证据 |
|---|---:|---|
| Product Fit |  |  |
| Journey Completeness |  |  |
| Contract Stability |  |  |
| Evidence & Recovery |  |  |
| Test Realism |  |  |
| Boundary Hygiene |  |  |
| Total |  |  |

## 6. Cross-surface Journeys

这些旅程用于判断产品面组合是否健康。

### 6.1 Journey 1: Cold-start Page Exploration

目标：

Agent 第一次打开未知页面，快速理解当前状态并选出下一步。

命令链：

```bash
pw session create explore-a --headed --open <url>
pw status -s explore-a
pw read-text -s explore-a --max-chars 2000
pw snapshot -i -s explore-a
pw locate -s explore-a --text <target>
```

覆盖产品面：

- Session Lifecycle。
- Page Reading。
- State Checks。

评测项：

- [ ] 5 条命令都能在 realistic app 或 dogfood app 跑通。
- [ ] Agent 能从输出里知道 URL、title、文本、可交互元素。
- [ ] 输出没有无关长噪音。
- [ ] 下一步 action target 清楚。

### 6.2 Journey 2: Login and State Reuse

目标：

Agent 完成登录，并用 state/auth profile 复用登录态。

命令链：

```bash
pw session create auth-a --headed --open <login-url>
pw analyze-form -s auth-a
pw fill-form -s auth-a '{"Username":"demo","Password":"demo123"}'
pw act -s auth-a submit_form
pw wait -s auth-a network-idle
pw verify -s auth-a text --text Dashboard
pw profile save-state main-auth -s auth-a
pw session create reuse-a --headed
pw profile load-state main-auth -s reuse-a
```

覆盖产品面：

- Auth and Profiles。
- Agent Shortcuts。
- State Checks。
- Session Lifecycle。

评测项：

- [ ] 表单分析准确。
- [ ] 填表成功。
- [ ] submit intent 成功。
- [ ] 登录状态可验证。
- [ ] state profile 可复用。
- [ ] 文档不暗示系统 Chrome profile 是可靠主路。

### 6.3 Journey 3: Bug Reproduction and Diagnostics

目标：

Agent 复现一个失败动作，并生成可交接诊断。

命令链：

```bash
pw session create bug-a --headed --open <url>
pw errors clear -s bug-a
pw click -s bug-a --text <action>
pw wait -s bug-a network-idle
pw diagnostics digest -s bug-a
pw console -s bug-a --level error --limit 20
pw network -s bug-a --status 500 --limit 20
pw diagnostics bundle -s bug-a --out .pwcli/bundles/<task> --task <task>
```

覆盖产品面：

- Actions。
- Diagnostics。
- Evidence。
- State Checks。

评测项：

- [ ] 失败动作被记录到 runs。
- [ ] console/network/errors 能定位高信号问题。
- [ ] diagnostics bundle 写出 artifact。
- [ ] third-party noise 不盖过业务错误。
- [ ] next steps 可执行。

### 6.4 Journey 4: Controlled Mock and Environment Repro

目标：

Agent 控制网络、route、clock 或 geolocation，复现确定性状态。

命令链：

```bash
pw session create repro-a --headed --open <url>
pw environment clock install -s repro-a
pw environment clock set -s repro-a 2026-01-01T00:00:00.000Z
pw route add -s repro-a '**/api/products' --body '{"ok":true}' --content-type application/json
pw open -s repro-a <url>
pw network -s repro-a --url /api/products --limit 10
pw verify -s repro-a text --text <expected>
```

覆盖产品面：

- Environment。
- Route。
- Diagnostics。
- Verify。

评测项：

- [ ] environment mutation 可验证。
- [ ] route 命中可证明。
- [ ] mock 不污染无关 route。
- [ ] verify 判断业务结果。

### 6.5 Journey 5: Human Preview and Takeover

目标：

人类旁观 Agent session，并在需要时阻断自动化写操作。

命令链：

```bash
pw session create handoff-a --headed --open <url>
pw stream start -s handoff-a
pw view open -s handoff-a
pw takeover -s handoff-a --actor tester --reason 'manual inspection'
pw open -s handoff-a <other-url>
pw release-control -s handoff-a
pw open -s handoff-a <other-url>
```

覆盖产品面：

- Preview。
- Control State。
- Session Lifecycle。
- Actions。

评测项：

- [ ] stream/view 可读。
- [ ] takeover 后写操作失败。
- [ ] 错误码是 `SESSION_HUMAN_CONTROLLED`。
- [ ] release 后写操作恢复。
- [ ] 文档没有承诺完整人类输入注入。

### 6.6 Journey 6: Structured Extraction

目标：

Agent 从页面列表中提取结构化数据，而不是写站点 recipe。

命令链：

```bash
pw session create extract-a --headed --open <url>
pw read-text -s extract-a --max-chars 2000
pw extract -s extract-a --selector '.card' '{"multiple":true,"fields":[{"key":"title","selector":"h2"}]}'
```

覆盖产品面：

- Page Reading。
- Structured Extraction。

评测项：

- [ ] selector schema 简洁。
- [ ] multiple root 输出稳定。
- [ ] attr/html/text 类型可验证。
- [ ] 不需要 recipe。
- [ ] 不暗示通用网页理解。

## 7. 单命令评测表

后续逐项评测时，每个命令复制此表。

```md
### Command: pw <command>

Product surface:

Primary journey:

Expected role:

Not responsible for:

Manual command:

JSON command:

Happy path evidence:

Failure path evidence:

Existing test:

Required new test:

Score:

| Dimension | Score | Evidence |
|---|---:|---|
| Purpose/help clarity |  |  |
| JSON contract |  |  |
| Error contract |  |  |
| Recovery/evidence |  |  |
| Policy/control integration |  |  |
| Test coverage |  |  |
| Boundary hygiene |  |  |

Verdict:

- [ ] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Notes:
```

## 8. Evaluation Board

### 8.1 Surface Board

| Surface | Status | Score | Owner | Evidence |
|---|---|---:|---|---|
| A Session Lifecycle | [x] Healthy | 27 | Codex | `product-surface-evaluation-results.md#surface-a-session-lifecycle` |
| B Page Reading and Workspace Facts | [x] Healthy | 27 | Codex | `product-surface-evaluation-results.md#surface-b-page-reading-and-workspace-facts` |
| C Element and Page Actions | [x] Healthy | 27 | Codex | `product-surface-evaluation-results.md#surface-c-element-and-page-actions` |
| D State Checks, Waits, and Assertions | [x] Healthy | 29 | Codex | `product-surface-evaluation-results.md#surface-d-state-checks-waits-and-assertions` |
| E Diagnostics and Evidence | [x] Healthy | 28 | Codex | `product-surface-evaluation-results.md#surface-e-diagnostics-and-evidence` |
| F Environment, Bootstrap, Route, and State Mutation | [x] Healthy | 29 | Codex | `product-surface-evaluation-results.md#surface-f-environment-bootstrap-route-and-state-mutation` |
| G Auth and Reusable Profiles | [x] Healthy | 27 | Codex | `product-surface-evaluation-results.md#surface-g-auth-and-reusable-profiles` |
| H Agent Shortcuts and Structured Extraction | [x] Healthy | 26 | Codex | `product-surface-evaluation-results.md#surface-h-agent-shortcuts-and-structured-extraction` |
| I Batch and Escape Hatch | [x] Healthy | 28 | Codex | `product-surface-evaluation-results.md#surface-i-batch-and-escape-hatch` |
| J Preview, Human Control, and Handoff | [x] Healthy | 28 | Codex | `product-surface-evaluation-results.md#surface-j-preview-human-control-and-handoff` |
| K Skill, Help, and Release Contract | [x] Healthy | 29 | Codex | `product-surface-evaluation-results.md#surface-k-skill-help-and-release-contract` |

### 8.2 Journey Board

| Journey | Status | Evidence |
|---|---|---|
| Cold-start Page Exploration | [x] Healthy | `pnpm test:e2e` dogfood login inspection: `session create` -> `snapshot` -> `read-text` -> refs |
| Login and State Reuse | [x] Healthy | `pnpm test:e2e` state save/load reuse; `test/integration/profile-state.test.ts`; README system Chrome limitation corrected |
| Bug Reproduction and Diagnostics | [x] Healthy | `pnpm test:e2e` failing reproduce, console/network/errors, diagnostics digest/export/show/grep |
| Controlled Mock and Environment Repro | [x] Healthy | `pnpm test:e2e` route add/load/match/patch, offline/geolocation/clock, bootstrap |
| Human Preview and Takeover | [x] Healthy | `test/integration/stream-preview.test.ts`, `view-open.test.ts`, `control-state.test.ts` |
| Structured Extraction | [x] Healthy | `test/integration/extract.test.ts`, Surface H evaluator |

### 8.3 Command Inventory

| Command | Surface | Status | Notes |
|---|---|---|---|
| `session` | A | [x] Healthy | lifecycle 主路 |
| `open` | A | [x] Healthy | 只导航已有 session；missing session 回归已修 |
| `status` | A/B | [x] Healthy | current facts |
| `observe` | A/B | [x] Healthy | `status` alias |
| `read-text` | B | [x] Healthy | visible text |
| `text` | B | [x] Healthy | `read-text` alias |
| `snapshot` | B | [x] Healthy | refs + stale risk |
| `accessibility` | B | [x] Healthy | ARIA tree |
| `page` | B | [x] Healthy | page/frame/dialog facts |
| `tab` | B | [x] Healthy | pageId tab controls |
| `screenshot` | B/E | [x] Healthy | visual evidence |
| `pdf` | B/E | [x] Healthy | document evidence |
| `click` | C | [x] Healthy | action evidence |
| `fill` | C | [x] Healthy | single field |
| `type` | C | [x] Healthy | key events |
| `press` | C | [x] Healthy | keyboard |
| `hover` | C | [x] Healthy | reveal content |
| `check` | C | [x] Healthy | checkbox/radio |
| `uncheck` | C | [x] Healthy | checkbox |
| `select` | C | [x] Healthy | select option |
| `drag` | C | [x] Healthy | gesture |
| `upload` | C | [x] Healthy | file input |
| `download` | C/E | [x] Healthy | download artifact |
| `scroll` | C | [x] Healthy | viewport/list |
| `resize` | C | [x] Healthy | viewport |
| `mouse` | C | [x] Healthy | coordinate fallback |
| `dialog` | C | [x] Healthy | native dialogs |
| `locate` | D | [x] Healthy | candidates |
| `get` | D | [x] Healthy | element fact |
| `is` | D | [x] Healthy | state fact |
| `verify` | D | [x] Healthy | assertion |
| `wait` | D | [x] Healthy | condition wait |
| `console` | E | [x] Healthy | console records |
| `network` | E | [x] Healthy | network records |
| `errors` | E | [x] Healthy | page errors |
| `diagnostics` | E | [x] Healthy | digest/export/bundle |
| `trace` | E | [x] Healthy | trace artifact |
| `har` | E/F | [x] Healthy | replay/inspect; record via session |
| `sse` | E | [x] Healthy | EventSource records |
| `doctor` | E/K | [x] Healthy | health/recovery |
| `environment` | F | [x] Healthy | offline/geo/permissions/clock/domains |
| `bootstrap` | F | [x] Healthy | init script setup |
| `route` | F | [x] Healthy | mock/patch/abort |
| `state` | F/G | [x] Healthy | storage state |
| `storage` | F | [x] Healthy | origin storage |
| `cookies` | F | [x] Healthy | list/set/delete cookies |
| `auth` | G | [x] Healthy | built-in provider |
| `profile` | G | [x] Healthy | state/auth profiles; system Chrome migration is best-effort |
| `find-best` | H | [x] Healthy | intent ranking |
| `act` | H | [x] Healthy | click-style shortcut |
| `analyze-form` | H | [x] Healthy | form metadata |
| `fill-form` | H | [x] Healthy | form JSON fill |
| `extract` | H | [x] Healthy | selector schema extraction |
| `check-injection` | H | [x] Healthy | heuristic scan |
| `batch` | I | [x] Healthy | structured subset |
| `code` | I | [x] Healthy | escape hatch |
| `stream` | J | [x] Healthy | read-only preview |
| `view` | J | [x] Healthy | stream alias |
| `control-state` | J | [x] Healthy | control facts |
| `takeover` | J | [x] Healthy | human gate |
| `release-control` | J | [x] Healthy | release gate |
| `dashboard` | J | [x] Healthy | Playwright dashboard helper |
| `skill` | K | [x] Healthy | packaged SOP |

## 9. Bug and Gap Recording Template

每次评测发现问题，直接在对应 surface 下记录。

```md
#### Finding: <short title>

Surface:

Command:

Severity:

Repro:

Expected:

Actual:

Evidence:

Suggested fix:

Needs issue:

- [ ] Yes
- [ ] No
```

Severity 使用：

| Severity | 含义 |
|---|---|
| P0 | 数据损坏、安全风险、阻断所有主链 |
| P1 | 假成功、错误 exit code、核心旅程失败 |
| P2 | 恢复建议差、输出漂移、重要边界不清 |
| P3 | 文档/help 小问题、低频 UX |

## 10. Execution Order

建议按以下顺序评测。

顺序按依赖关系排列。

| Step | Scope |
|---:|---|
| 1 | Global gate |
| 2 | Session Lifecycle |
| 3 | Page Reading |
| 4 | State Checks |
| 5 | Element Actions |
| 6 | Diagnostics |
| 7 | Environment/Route/Bootstrap |
| 8 | Auth/Profile |
| 9 | Agent Shortcuts/Extraction |
| 10 | Batch/Code |
| 11 | Preview/Takeover |
| 12 | Skill/Help/Release |
| 13 | Cross-surface journeys |

## 11. Done Criteria

本轮健康度评测完成的标准：

- [x] 所有 surface 都有分数。
- [x] 所有 journey 都跑过一次。
- [x] 所有顶层命令都有单命令 verdict。
- [x] P0/P1 finding 全部修复或降级为明确产品边界。
- [x] P2 finding 已修复或降级为明确产品边界。
- [x] README/skill/help 没有明显互相矛盾。
- [x] `pnpm check` 通过。
- [x] 如果改了运行态或发布面，`pnpm smoke` 通过。

## 12. Expected Outcome

评测完成后，项目应该得到三个结果。

第一，当前健康等级。

第二，必须修的 bug 列表。

第三，不应该继续扩张的产品边界列表。

最终输出建议格式：

```md
# pwcli Product Surface Health Report

Overall grade:

Surfaces:

Critical findings:

Boundary decisions:

Recommended next actions:

Verification:
```

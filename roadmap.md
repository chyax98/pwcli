# pwcli 项目历史 Roadmap 与决策复盘

> 本文是项目历史复盘，不是当前产品使用教程。
>
> 当前使用入口仍然是 `README.md`、`skills/pwcli/SKILL.md` 和 `pw --help`。
>
> 当前维护规则仍然是 `AGENTS.md`、`CLAUDE.md` 和 `.claude/rules/`。
>
> 本文用于解释项目为什么走到 `v1.0.0`，中间做过什么，砍掉什么，以及哪些复杂性是必要的、哪些复杂性是历史代价。

## 0. 摘要

`pwcli` 最终形成的是一个 Agent-first Playwright CLI。

它不是 Playwright 的薄包装。

它不是测试框架。

它不是浏览器 IDE。

它不是自研浏览器。

它也不是网页抽取平台。

它的最终定位是：把浏览器任务拆成 Agent 能稳定消费的命令链。

这条命令链包括：

- 创建 named session。
- 观察页面事实。
- 执行动作。
- 等待变化。
- 验证结果。
- 收集诊断。
- 恢复失败。
- 保留证据。

项目在很短时间里经历了多个方向拉扯。

早期目标是“让 Agent 能操作浏览器”。

中期目标变成“补齐所有 Agent 可能需要的浏览器能力”。

随后又尝试过 benchmark、recipe extraction、MCP、真实页面 dogfood、竞品能力对齐。

最后才重新收敛到 `session-first`、`engine-first`、`skill-as-SOP`、`contract-as-truth`。

从 git 历史看，项目不是正常线性演进。

它更像是压缩到十天左右的一轮产品探索、两轮能力扩张、三轮架构收口和一轮发布清理。

截至 `v1.0.0`：

- 本地 commit 数：394。
- 远程 issue 数：114。
- 远程 open issue 数：0。
- merged PR 数：28。
- tag：`v0.1.0`、`v0.2.0`、`v1.0.0`。
- 默认 gate：`pnpm check`。
- 发布锚点：GitHub tag，不发布 npm registry。

这份文档的核心结论是：

- 项目复杂不是因为 Playwright 必然复杂。
- 项目复杂主要来自早期边界没有足够早收紧。
- Agent coding 会天然把“能做”推成“应该做”。
- 一旦没有强产品边界，功能、文档、测试、评测、架构会一起膨胀。
- `v1.0.0` 的价值不只是能力齐，而是重新写下了边界。

## 1. 当前最终状态

当前 `pwcli` 的最终主线很清楚。

### 1.1 产品一句话

`pwcli` 是 Agent-first Playwright CLI。

它把浏览器任务变成 Agent 可稳定消费的命令链。

### 1.2 当前主链

典型任务从 named session 开始。

```bash
pw session create task-a --headed --open 'https://example.com'
pw status -s task-a
pw read-text -s task-a --max-chars 2000
pw snapshot -i -s task-a
pw click -s task-a --text Submit
pw wait network-idle -s task-a
pw verify text -s task-a --text Saved
pw diagnostics digest -s task-a
```

这条链路是项目最终收敛出来的产品骨架。

它背后的原则是：

- 先建立 session。
- 再观察事实。
- 再执行动作。
- 动作后必须等待。
- 等待后必须验证。
- 失败后先读 diagnostics。
- 不把动作成功误判为任务成功。

### 1.3 当前源码边界

当前代码分成四个主要层：

```text
src/cli/     命令解析、参数定义、输出格式化
src/engine/  Playwright runtime、session、workspace、actions、diagnostics
src/store/   文件系统 I/O、artifacts、health、skill path
src/auth/    内置 auth provider registry 和实现
```

这些边界是后期重构得到的结果，不是项目一开始就稳定存在的。

最终约束是：

- `engine/` 不能 import `cli/`。
- `store/` 不能 import `engine/` 或 `cli/`。
- `auth/` 不能 import `cli/`。
- 跨层 import 使用 `#engine/*`、`#cli/*`、`#store/*`、`#auth/*`。
- 不建空 re-export 层。
- 不只按行数拆文件。
- 不为了统一性重写 Playwright 已覆盖的 primitive。

### 1.4 当前文档边界

当前文档也被强行收口。

三类读者被分开：

- 使用工具的 Agent：读 `skills/pwcli/`。
- 维护仓库的 Code Agent：读 `AGENTS.md`、`CLAUDE.md`、`.claude/rules/`。
- 人类维护者：读 `README.md`。

这个分工很重要。

早期文档混在一起时，工具使用教程、架构说明、维护规则、未来计划、过程日志互相污染。

最后的结论是：

- `README.md` 不承载完整 SOP。
- `skills/pwcli/` 是唯一工具使用教程。
- `.claude/rules/` 只放 Claude Code 细分规则。
- `AGENTS.md` 和 `CLAUDE.md` 是维护真相。
- 命令参数真相永远是 `pw --help` 和 `pw <command> --help`。

### 1.5 当前测试边界

测试分层最终收敛为：

```text
test/
  unit/          纯函数和轻量内部 contract
  integration/   真实 CLI 集成测试
  contract/      command/help/skill/专项能力契约
  smoke/         发布前本地主链回归入口脚本
  e2e/           Agent dogfood 入口脚本
  fixtures/      可维护夹具
```

默认 gate 是：

```bash
pnpm check
```

发布或总验收才跑更重的：

```bash
pnpm check
pnpm smoke
git diff --check
pnpm pack:check
```

这个分层来自后期痛点。

早期有很多一次性 probe、benchmark、临时应用和旧测试资产。

它们证明过某些想法，但不适合作为长期仓库资产。

最终原则是：

- `test/` 只保留后续会维护、能证明产品 contract 的资产。
- `smoke/` 和 `e2e/` 只放 runner。
- 夹具统一放 `fixtures/`。
- 文档清理不默认跑全量测试。
- 改运行态、session、命令注册、batch、action evidence、diagnostics 时，再跑真实命令或完整 smoke。

## 2. 数据视角

### 2.1 Commit 规模

本地 `HEAD` 一共有 394 个 commit。

按日期聚合：

| 日期 | commit 数 |
|---|---:|
| 2026-04-25 | 7 |
| 2026-04-26 | 28 |
| 2026-04-27 | 19 |
| 2026-04-28 | 15 |
| 2026-04-29 | 42 |
| 2026-04-30 | 18 |
| 2026-05-01 | 22 |
| 2026-05-02 | 73 |
| 2026-05-03 | 82 |
| 2026-05-04 | 70 |
| 2026-05-05 | 18 |

这说明最激烈的阶段不是项目创建第一天。

真正的复杂度峰值在 `2026-05-02` 到 `2026-05-04`。

这三天发生了：

- 大量 issue 驱动修复。
- 多轮架构重构。
- 测试体系改造。
- 文档真相收口。
- 发布准备。
- 竞品能力对齐。
- 1.0 前最终验收。

按 commit 类型粗略聚合：

| 类型 | 数量 |
|---|---:|
| fix | 106 |
| feat | 89 |
| docs | 86 |
| refactor | 39 |
| test | 12 |
| chore | 11 |
| benchmark | 1 |
| perf | 1 |
| improve | 1 |
| simplify | 1 |
| other | 47 |

这个比例也说明了项目的真实性质。

它不是单纯 feature sprint。

`fix` 比 `feat` 多。

`docs` 和 `feat` 接近。

这意味着产品不断在补能力、修假成功、重写边界、同步使用说明之间切换。

### 2.2 Issue 规模

远程 issue 实际数量是 114 个。

GitHub 编号到 `#142`，是因为 issue 和 PR 共用编号。

当前 open issue 数是 0。

标签分布：

| 标签 | 数量 |
|---|---:|
| bug | 26 |
| enhancement | 41 |
| documentation | 7 |
| codex | 12 |
| unlabeled | 45 |

按创建日期聚合：

| 日期 | issue 数 |
|---|---:|
| 2026-04-26 | 10 |
| 2026-04-27 | 1 |
| 2026-04-28 | 5 |
| 2026-04-29 | 12 |
| 2026-04-30 | 12 |
| 2026-05-01 | 11 |
| 2026-05-02 | 50 |
| 2026-05-03 | 7 |
| 2026-05-04 | 5 |
| 2026-05-05 | 1 |

`2026-05-02` 是 issue 爆炸点。

这一天不是简单“发现很多 bug”。

它代表项目进入了 contract 审计和真实评测阶段。

大量问题来自：

- 命令输出不稳定。
- 错误信封不一致。
- batch 静默忽略参数。
- diagnostics 噪音过多。
- read-text 行为漂移。
- iframe/ref 边界没有写清。
- HAR/video/accessibility 与 Playwright 实际 API 不一致。
- route/mock 的成功语义过宽。
- session recreate 和 startup lock 不稳定。

### 2.3 PR 规模

远程 merged PR 数是 28 个。

重要 PR 包括：

- `#1` 收口 acquisition 主路并补 diagnostics 基座。
- `#2` single truth refactor。
- `#17` pageId tab controls。
- `#24` popup opener fallback。
- `#25` semantic click evidence。
- `#27` batch summary output。
- `#29` managed action errors。
- `#42` action failure contract。
- `#43` action failure coverage。
- `#44` semantic fill/type。
- `#46` dashboard wrapper。
- `#48` remaining backlog primitives。
- `#49` diagnostics bundle。
- `#67` agent recovery and command ergonomics。
- `#68` agent-facing assessment and benchmark primitives。

这些 PR 说明一个趋势。

早期 PR 是补浏览器能力。

中期 PR 是补 Agent 失败恢复。

后期 PR 是补产品 contract。

最后不是继续加大功能，而是收口文档、测试、发布规则。

## 3. 阶段一：原型与 session-first 主路

时间：`2026-04-25` 到 `2026-04-26`。

这一阶段的关键词是：

- default managed browser。
- session-first。
- acquisition 主路。
- diagnostics 基座。
- bootstrap。
- structured batch。
- ddd-lite layers。

项目一开始要解决的问题很直接。

Agent 需要操作浏览器。

浏览器不是一次性命令。

浏览器任务有状态。

页面、上下文、登录态、网络、弹窗、下载、trace 都需要跨命令持续存在。

所以第一轮正确决策是：不要做 stateless wrapper。

`session create` 必须成为主路。

### 3.1 为什么 session-first 是必要的

如果每条命令都重新打开浏览器，Agent 无法完成真实任务。

原因包括：

- 登录态丢失。
- 页面上下文丢失。
- snapshot ref 失效。
- 下载、弹窗、网络事件无法归因。
- diagnostics 无法跨动作聚合。
- 失败恢复没有上下文。

所以早期 commit 很快转向：

- `feat: 收口 pwcli 为严格 session-first 命令面`
- `feat: 支持 session recreate 与 resize`
- `feat: 收口 acquisition 主路并补 diagnostics 基座`
- `feat: 补齐 bootstrap 与结构化 diagnostics 主链`

这个阶段形成了一个基本事实：

Agent browser automation 的最小单位不是 command。

最小单位是 session。

### 3.2 diagnostics 为什么很早进入核心

项目没有等功能完成后再做 diagnostics。

这是正确的。

Agent 操作浏览器时失败非常常见。

失败原因可能来自：

- 元素不存在。
- ref stale。
- 页面导航。
- 网络失败。
- 弹窗阻断。
- iframe。
- 权限。
- 下载。
- JS 异常。
- 第三方资源噪音。

如果没有 diagnostics，Agent 只能猜。

所以 `diagnostics` 从早期就变成核心能力。

它不是附属日志。

它是 Agent 恢复路径的一部分。

### 3.3 第一轮复杂化

第一轮复杂化来自一个合理但危险的想法：

既然 Agent 做任务需要上下文，那么 CLI 应该提供越来越多浏览器 substrate。

于是很快加了：

- bootstrap。
- route mock。
- environment controls。
- diagnostics query。
- digest summaries。
- body snippets。
- compact observe。
- doctor。
- dogfood e2e fixture。

这些东西单独看都合理。

但它们一起出现时，项目已经不再是小 CLI。

这就是复杂性的第一次堆叠。

## 4. 阶段二：Agent 操作面扩张

时间：`2026-04-27` 到 `2026-04-30`。

这一阶段的关键词是：

- auth provider。
- interactive snapshot。
- tab pageId。
- semantic locator。
- action evidence。
- action failure taxonomy。
- dashboard。
- verify。
- hover。
- trace。
- PDF。
- storage。
- attachable browser。

这一阶段项目从“能打开和诊断浏览器”进入“Agent 能真正完成任务”。

### 4.1 auth 的早期方向

浏览器自动化绕不开登录。

项目早期尝试了 DC / developer console 相关登录路径。

后来 `auth` 被收口成内置 provider。

最终边界是：

- `auth` 只执行内置 provider。
- `auth` 不创建 session。
- `auth` 不改变 browser shape。
- 没有外部 plugin 加载机制。

这是一个关键收口。

如果允许外部 auth plugin，项目会立刻变成插件平台。

插件平台意味着：

- provider lifecycle。
- 配置 schema。
- secrets 管理。
- sandbox。
- versioning。
- error contract。
- 安装与分发。

这些都超出 `pwcli` 主目标。

所以内置 provider 是正确边界。

### 4.2 interactive snapshot 和 ref

Agent 需要从页面里拿到可操作目标。

`snapshot -i` 提供 interactive refs。

这解决了“看见元素”和“操作元素”之间的桥接。

但它也引入了一个核心风险：

ref 会 stale。

页面导航、DOM 更新、弹窗、tab 切换都可能让旧 ref 失效。

所以后续出现：

- snapshot epoch。
- stale ref detection。
- REF_STALE recovery envelope。
- action evidence。
- run event recorder。

这说明一个事实：

一旦 CLI 给 Agent 稳定 ref，就必须承担 ref 生命周期。

否则 ref 比 selector 更危险。

### 4.3 action failure contract

动作失败不能只返回 Playwright 原始错误。

Agent 需要知道：

- 失败是否可恢复。
- 下一步建议是什么。
- 是否应该重新 snapshot。
- 是否被 modal 阻断。
- 是否是 locator 不存在。
- 是否是 stale ref。
- 是否是 timeout。
- 是否有 failure screenshot。

所以项目加入了 action failure taxonomy。

这类能力在普通 CLI 里看起来复杂。

但对 Agent-first CLI 是必要的。

因为 Agent 不像人类能读长 stack trace 后自行判断。

Agent 需要结构化恢复信号。

### 4.4 dashboard 与可视化

项目曾加入 Playwright session dashboard。

这个能力有价值。

它帮助人类看当前浏览器状态。

但它没有成为主链。

原因很清楚：

- Agent 主链仍然是 CLI。
- dashboard 只能辅助观察。
- dashboard 不应该替代 read-only facts。
- dashboard 不应该成为控制平面。

这个判断后来延续到 `stream/view/takeover`。

本地 preview 可以做。

完整浏览器 IDE 不做。

### 4.5 第二轮复杂化

第二轮复杂化来自“Agent 需要更多高频动作”。

于是补了：

- click。
- fill。
- type。
- press。
- hover。
- check。
- uncheck。
- select。
- drag。
- upload。
- download。
- scroll。
- resize。
- mouse。

这些是 Playwright primitive。

但 `pwcli` 不能只是转发。

它还要提供：

- session guard。
- target resolution。
- semantic locator。
- output envelope。
- diagnostics delta。
- failure run。
- recovery suggestion。
- text output。
- JSON output。
- help contract。
- skill docs。
- tests。

所以每补一个命令，成本都不只是一个 Playwright call。

这是 Agent-first CLI 和普通 wrapper 的区别。

## 5. 阶段三：评测、benchmark 与 extraction spike

时间：`2026-05-01`。

这一阶段的关键词是：

- agent-facing assessment。
- benchmark primitives。
- extraction workflows。
- recipe pack。
- MCP。
- attachable attach。
- route gaps。
- real-page evidence。

这是一轮非常典型的产品探索。

它的价值不是最终留下多少代码。

它的价值是证明哪些方向不应该继续产品化。

### 5.1 为什么会走向 extraction

Agent 浏览器任务经常需要读页面结构。

读页面结构自然会走向 extraction。

一开始合理的需求包括：

- 提取列表。
- 提取文章。
- 提取 discussion。
- 提取表格。
- 分页。
- raw document。
- companion row。
- exclude selector。

这些能力看起来很诱人。

它们让 CLI 像一个网页抽取平台。

但这条路很快暴露问题。

### 5.2 recipe-driven extraction 为什么被砍

recipe 方案的问题是：

- 它引入第二套 DSL。
- 它需要站点级维护。
- 它让仓库承载具体网站知识。
- 它让 CLI 从 browser task tool 变成 crawler/extractor。
- 它和 Agent 自己读页面、写判断的能力重叠。
- 它很容易变成“每个站点都要补一个 recipe”。

所以后续出现了：

- `refactor: hard-cut and split extraction runtime`
- `refactor: remove low-value recipe and alias surfaces`
- `refactor: remove recipe-driven extraction lane`
- `docs: remove stale benchmark references to deleted assets`

这是项目里最重要的一次砍功能。

留下的是更小的 `extract`。

最终 `extract` 只接受最小 selector schema。

它不承诺理解任意网页。

它只做结构化读取 primitive。

### 5.3 benchmark 的价值与边界

benchmark 也经历了类似过程。

benchmark 有价值，因为它能暴露真实问题。

例如：

- `click --test-id` 的内部错误。
- route remove 双 pattern 残留。
- batch 参数漂移。
- diagnostics 假成功。
- accessibility API 用错。

但 benchmark 不适合作为主产品面。

原因是：

- benchmark 容易变成一次性报告。
- benchmark 资产维护成本高。
- benchmark 会把评测目标误写成产品目标。
- benchmark 如果没有默认 gate，就会漂移。

所以最终保留的是：

- `test:e2e` 系统级 dogfood。
- `test:e2e:agent` 外部 runner harness。
- 可维护 fixtures。

没有保留大型临时 benchmark 文档作为长期真相。

### 5.4 这一阶段的核心教训

这一阶段说明：

不是所有证明过有用的东西都应该留下。

有些东西只适合当探索证据。

有些东西只适合当 issue。

有些东西只适合当 fixture。

有些东西才适合作为 CLI 命令。

判断标准是：

- 是否通用。
- 是否能稳定测试。
- 是否能写进 help contract。
- 是否能写进 skill SOP。
- 是否不需要站点长期维护。
- 是否不把 Agent 的判断能力提前固化成配置。

## 6. 阶段四：回归、issue 爆发与质量门

时间：`2026-05-02` 到 `2026-05-03`。

这一阶段是项目最密集的阶段。

它不是简单加功能。

它是评测后暴露问题、问题进入 issue、issue 驱动修复、修复进入 contract 的循环。

### 6.1 issue 爆发

`2026-05-02` 创建了 50 个 issue。

这些 issue 集中在：

- Agent-facing output contract。
- recovery-oriented error envelope。
- skill contract。
- auth probe/state reuse。
- diagnostics timeline。
- batch stable subset。
- route/mock。
- environment。
- real-time observation。
- bootstrap persistence。
- interaction domain extraction。
- modal blocked。
- read-text。
- page list。
- trace inspect。

这一天的意义是：项目从“功能可用”进入“产品是否可信”。

### 6.2 假成功问题

项目中大量修复都围绕假成功。

典型问题包括：

- `verify` 失败但 exit code 不对。
- `batch press` 接受 target 但静默忽略。
- `har start/stop` 返回成功但没有真实 HAR capture。
- `har replay --update` 语义映射错误。
- `route list` 把 patch-text 错报成 continue。
- `accessibility` 调用了过时或错误 API。
- `tab close` fallback 没验证真的激活。
- `click --test-id` 内部常量未定义。

这些问题对人类 CLI 用户也不好。

但对 Agent 更致命。

Agent 会相信结构化输出。

如果 CLI 返回假成功，Agent 会继续错误路径。

所以后期规则变成：

- limitation code 不能包装成已支持。
- 失败必须结构化。
- 不支持必须明确报错。
- 不允许静默忽略参数。
- action 成功不等于任务成功。

### 6.3 diagnostics 噪音问题

真实页面里有大量噪音。

包括：

- favicon 404。
- Google Ads。
- analytics。
- Sentry。
- DataDog。
- telemetry。
- CSP 违规。
- ERR_ABORTED。
- ERR_NAME_NOT_RESOLVED。
- ERR_CONNECTION_RESET。
- TinyMCE read-only 日志。

项目一度加入 tracking domain 列表做降权。

这个做法不是产品核心。

它只是 diagnostics 排序的噪音控制。

最终判断是：

- 可以保留。
- 不继续产品化。
- 不做动态维护体系。
- 不让这个点扩大成配置平台。

这也是一个典型的小边界决策。

### 6.4 iframe、shadow DOM 与可见性

页面读取和定位不是简单 innerText。

问题包括：

- hidden DOM 干扰。
- overlay 重复文本。
- style/script/svg 非可见内容。
- shadow DOM。
- iframe 内 ref。
- textarea/combobox。
- selector not found。
- nth 默认值误导。

这些都在 issue 和 commit 中逐步修正。

最后形成的原则是：

- read-only 命令必须尽量返回用户可见事实。
- 定位失败要给具体 target 信息。
- selector 错误要有明确错误码。
- iframe 支持与限制必须写清。
- `--nth` 不应默认制造假选择。

### 6.5 batch 的边界

`batch` 是项目复杂来源之一。

它很有用，因为 Agent 可以一次提交命令链。

但它很危险，因为 batch 很容易变成第二套 shell。

最终边界是：

- `batch` 只接收结构化 `string[][]`。
- `batch` 只承诺稳定子集。
- 不支持的命令明确失败。
- 不支持的参数明确失败。
- 同一 session 的依赖步骤顺序执行。
- batch 失败要有 `BATCH_STEP_FAILED` 信封。

这保住了 batch 的价值。

也防止它变成不可测试的 mini runner。

### 6.6 contract 重要性

这一阶段最重要的变化是 contract 思维。

不是“跑通一次”。

而是：

- command help contract。
- skill reference contract。
- recovery envelope contract。
- batch allowlist contract。
- content boundary contract。
- HAR contract。
- trace inspect contract。
- doctor modal contract。

这些 contract 把“Agent 可以依赖什么”固定下来。

这是 `pwcli` 从实验工具变成产品工具的关键。

## 7. 阶段五：架构重构

项目至少经历了三轮明显的重构。

### 7.1 第一轮：ddd-lite layers

早期有一次 `ddd-lite` 分层。

它的目标是把运行时、命令面和领域概念拆开。

这轮重构有价值。

它让项目开始意识到：

- 浏览器 runtime 和 CLI 参数不是一回事。
- diagnostics 是一个领域。
- workspace facts 是一个领域。
- auth provider 是一个领域。
- action failure 是一个领域。

但这轮也有问题。

它容易制造浅层 domain 模块。

如果模块只是 re-export 或薄包装，就只是移动复杂性。

后面才出现：

- `remove hollow domain re-exports`
- `de-hollow diagnostics domain`
- `consolidate workspace facts`
- `consolidate shallow domain modules`

### 7.2 第二轮：interaction / diagnostics / identity 拆分

第二轮重构集中在 `2026-05-02` 到 `2026-05-03`。

它处理的是文件变大和职责混杂。

关键方向包括：

- `stateAccessPrelude` 提取。
- diagnostics 拆成 helpers/signals/query。
- identity-state 拆成 auth-probe/state-diff/storage。
- action orchestration 提取。
- interaction error codes 中央化。
- health-check pure logic 和 I/O 拆分。

这轮重构说明项目已经进入复杂业务代码状态。

不是所有复杂都能靠“拆文件”解决。

最终规则写成：

- 不只按行数拆文件。
- 不建空 re-export 层。
- domain 层不能直接做 I/O。
- 只有能降低耦合的拆分才值得做。

### 7.3 第三轮：engine-first + citty CLI

第三轮是最大的一次结构收口。

commit 里出现：

- `refactor: engine-first 架构重构 + citty CLI 层`
- `fix: citty lazy import .default 解包`
- `fix(smoke): 修复 dashboard import 路径 app/commands → cli/commands`
- `fix(smoke): --output json 移至每条命令末尾`
- `fix(batch): 步骤失败时输出 BATCH_STEP_FAILED`

这轮重构把 CLI 明确降级成表面层。

CLI 负责：

- 参数定义。
- help。
- output。
- error envelope。

Engine 负责：

- Playwright runtime。
- session。
- workspace。
- actions。
- diagnostics。

Store 负责：

- 文件系统 I/O。
- artifacts。
- skill path。
- health。
- profile state。

Auth 负责：

- provider registry。
- 内置 provider 实现。

这轮重构的代价很大。

smoke、import 路径、输出位置、flag 行为都出现迁移问题。

但它奠定了 `v1.0.0` 之后可维护的形状。

### 7.4 重构教训

三轮重构说明一件事：

架构不是一开始设计出来的。

它是被失败、假成功、测试漂移和文档混乱逼出来的。

但也要承认：

如果早期产品边界更早收紧，重构成本会小很多。

真正导致复杂的不是某个文件写得长。

真正导致复杂的是产品面一直在扩张。

当产品面不稳定时，任何架构都会被拖歪。

## 8. 阶段六：1.0 收敛

时间：`2026-05-04` 到 `2026-05-05`。

这一阶段关键词是：

- docs cleanup。
- command evaluation matrix。
- validation evidence。
- skill SOP audit。
- CodeStable truth audit。
- test rewrite。
- version-synced skill。
- semantic/form/extract。
- preview/takeover。
- HAR/video lifecycle。
- help contract。
- v1.0.0。

### 8.1 文档收口

1.0 前大量文档被清理。

最终明确：

- 根目录长期文档只保留 `README.md`、`AGENTS.md`、`CLAUDE.md`。
- `AGENTS.md` 和 `CLAUDE.md` 必须完全一致。
- `.claude/rules/` 只保留 Claude Code 细分规则。
- `skills/pwcli/` 是唯一工具使用教程。
- 不写第二套教程、过程日志、历史 plan、临时调研、迁移记录或 backlog。

这条规则非常硬。

它的背景就是项目曾经被文档噪音拖住。

文档太多时，Agent 会读错入口。

入口一多，命令真相就漂移。

最后只能强行单一真相。

### 8.2 skill 版本同步

`pw skill show`、`pw skill show --full`、`pw skill refs` 解决了一个真实问题。

Agent 不应该依赖仓库静态文件路径猜当前 CLI 版本的 skill。

当前安装版本应该能导出对应 skill。

这让：

- CLI 能力。
- skill SOP。
- 发布包。

三者收敛。

这是 1.0 的关键能力之一。

### 8.3 semantic/form/extract 最小闭环

1.0 补了更高层 agent ergonomics：

- `find-best`。
- `act`。
- `analyze-form`。
- `fill-form`。
- `extract`。
- `check-injection`。

这里做了重要取舍。

`act` 只做 click-style intent。

不做 `fill_email` 和 `fill_password`。

原因是填表已经由 `fill` 和 `fill-form` 承担。

如果把 fill 也塞进 `act`，`act` 会变成第二套 planner。

最终 intent 包括：

- `submit_form`。
- `close_dialog`。
- `auth_action`。
- `accept_cookies`。
- `back_navigation`。
- `pagination_next`。
- `primary_cta`。

这保住了它的定位：

semantic shortcut，不是万能代理。

### 8.4 stream / view / takeover

1.0 补了本地预览和控制状态。

命令包括：

- `pw stream start|status|stop`。
- `pw view open|status|close`。
- `pw control-state`。
- `pw takeover`。
- `pw release-control`。

这里也做了边界收口。

它不是完整浏览器 IDE。

它不是云端 workbench。

它不是人类输入注入。

它只是：

- 本地只读 preview。
- session activity visibility。
- human takeover hard control gate。

`takeover` 的含义是阻止 CLI 写操作。

不是把浏览器控制权完整交给一个协作 UI。

这个边界避免了项目变成 dashboard/workbench 产品。

### 8.5 HAR/video lifecycle

HAR 和 video 最终都挂到 session lifecycle。

规则是：

- HAR 录制只能通过 `session create|recreate --record-har <file>` 开启。
- 视频录制只能通过 `session create|recreate --record-video <dir>` 开启。
- session 关闭后写出文件。

这个决定来自早期 HAR/video 假成功问题。

如果做成 `har start/stop` 或 `video start/stop`，很容易和 Playwright context 生命周期冲突。

最终绑定 session lifecycle 更诚实。

### 8.6 测试体系重写

`2026-05-05` 有 `refactor(test): 重写测试体系`。

这不是简单整理。

它把长期可维护资产和临时探索资产分开。

最终测试目录只保留：

- unit。
- integration。
- contract。
- smoke。
- e2e。
- fixtures。

这是 1.0 的稳定基础。

没有这一步，项目会继续被旧测试靶场和临时 benchmark 拖住。

## 9. 做了什么

这一节按能力域列出最终留下的东西。

### 9.1 Session lifecycle

保留能力：

- `session create`。
- `session attach`。
- `session recreate`。
- `session status`。
- `session list`。
- `session close`。
- `session close --all`。
- startup lock。
- stale workspace 清理。
- attachable browser survey。
- profile state。
- record HAR。
- record video。

核心决策：

- session 是主实体。
- `open` 只做导航。
- lifecycle 只能走 `session create|attach|recreate`。
- 不允许多个 lifecycle 入口分裂。

### 9.2 Page reading

保留能力：

- `status` / `observe`。
- `read-text` / `text`。
- `snapshot`。
- `accessibility`。
- `page`。
- `tab`。
- `screenshot`。
- `pdf`。

核心决策：

- read-only 命令要返回页面事实。
- `snapshot -i` 才提供 actionable refs。
- refs 会 stale，必须有 epoch 和 recovery。
- `read-text` 关注可见文本，不做完整 DOM dump。
- accessibility 使用当前 Playwright 可用 API，不包装不支持能力。

### 9.3 Actions

保留能力：

- `click`。
- `fill`。
- `type`。
- `press`。
- `hover`。
- `check`。
- `uncheck`。
- `select`。
- `drag`。
- `upload`。
- `download`。
- `scroll`。
- `resize`。
- `mouse`。

核心决策：

- 动作命令必须受 session control gate 约束。
- 动作输出必须有 evidence。
- 动作失败必须有 recovery envelope。
- 动作成功不代表任务成功。
- 动作后仍需 `wait` 和 `verify`。

### 9.4 State checks

保留能力：

- `locate`。
- `get`。
- `is`。
- `verify`。
- `wait`。

核心决策：

- 这些命令是 read-only 状态检查。
- 不做 action planner。
- 不替 Agent 判断下一步动作。
- `verify` 失败必须体现为失败信封和 exit code。

### 9.5 Diagnostics

保留能力：

- `console`。
- `network`。
- `errors`。
- `diagnostics digest`。
- `diagnostics export`。
- `diagnostics bundle`。
- `diagnostics timeline`。
- `trace`。
- `har` replay / inspect。
- `sse` observation。
- `doctor`。

核心决策：

- diagnostics 是恢复链路，不是附属日志。
- 输出要降噪。
- 第三方追踪/遥测失败降权，不删除。
- bundle 要给 Agent 可执行 next steps。
- trace zip 是 Playwright replay 证据。
- `.pwcli/runs/` 是轻量动作事件。

### 9.6 Environment and mock

保留能力：

- `route`。
- `bootstrap`。
- `environment offline`。
- `environment geolocation`。
- `environment permissions`。
- `environment clock`。
- `environment allowed-domains`。

核心决策：

- route/mock 必须最小化。
- mock 要证明命中。
- allowed-domains 只 guard `pw open` 导航。
- bootstrap 是 session setup，不是 userscript 平台。
- environment mutation 后要读事实或 diagnostics。

### 9.7 Auth and profile

保留能力：

- `auth list/info/<provider>`。
- 内置 `dc` provider。
- `profile save-state/load-state`。
- `profile save-auth/login-auth`。
- `PWCLI_VAULT_KEY` 加密 auth profile。
- `profile list-chrome`。

核心决策：

- `auth` 不创建 session。
- `auth` 不加载外部 plugin。
- 可复用状态走 `save-state` 和 `save-auth`。
- 不承诺复用用户真实系统 Chrome 登录态。

### 9.8 Agent ergonomics

保留能力：

- `find-best`。
- `act`。
- `analyze-form`。
- `fill-form`。
- `extract`。
- `check-injection`。
- `batch` stable subset。
- `skill show`。
- `skill refs`。

核心决策：

- semantic intent 是捷径，不是 planner。
- form/extract 是最小 schema，不是网页抽取平台。
- check-injection 是启发式扫描，不是安全证明。
- batch 是结构化串行命令，不是 shell。
- skill 内容跟随当前安装版本。

### 9.9 Preview and human control

保留能力：

- `stream`。
- `view`。
- `control-state`。
- `takeover`。
- `release-control`。

核心决策：

- preview 只读。
- takeover 是硬控制闸门。
- 不做完整协作浏览器。
- 不做云 workbench。
- 不做自研浏览器 UI。

## 10. 没做什么

这一节比“做了什么”更重要。

项目最终能收敛，是因为砍掉了很多方向。

### 10.1 不做通用 Playwright wrapper

`pwcli` 不追求覆盖 Playwright 所有 API。

原因：

- Playwright 已经有 API。
- 直接包装会无限膨胀。
- Agent 需要的是稳定任务链，不是完整 API mirror。
- 不稳定能力会污染 help 和 skill。

所以项目只保留 Agent 高频 primitive。

### 10.2 不做外部 auth plugin

外部 auth plugin 看起来灵活。

但它会把项目变成 provider platform。

目前不做。

只保留内置 provider。

### 10.3 不做 recipe-driven extraction

recipe extraction 曾经做过。

后来砍掉。

原因：

- 站点维护成本太高。
- DSL 会膨胀。
- Agent 自身更适合做一次性判断。
- CLI 应保留通用 primitive。

### 10.4 不做 userscript 平台

`bootstrap` 可以注入 init script。

但它不是 userscript 产品。

项目不做：

- 脚本市场。
- 脚本生命周期管理。
- 页面长期 patch。
- 站点级自动增强。

### 10.5 不做自研浏览器

项目不做自研 Chromium。

不做指纹浏览器。

不做 PWA shell browser。

不做 extension/native messaging 主路。

原因：

- 维护成本高。
- 安全更新成本高。
- Playwright 协议兼容成本高。
- 签名、公证、系统 keychain、codec、证书都复杂。
- 和 Agent-first CLI 目标不一致。

### 10.6 不承诺复用系统 Chrome 登录态

这是最近关闭的 `#142`。

系统 Chrome profile 登录态复用看起来很有吸引力。

但实际边界很硬：

- Chrome 对默认 user data dir 的 remote debugging 有安全限制。
- Playwright 不建议 persistent context 指向用户常规 profile。
- macOS Keychain cookie 解密受应用签名、路径和 profile 上下文影响。
- 强行启动可能留下 SingletonLock / SingletonSocket。

最终判断：

- 不把它作为产品承诺。
- 推荐 `profile save-state`。
- 推荐 `profile save-auth`。
- 后续最多做 fail fast 和明确错误提示。

### 10.7 不做完整 Agent benchmark 产品

`test:e2e:agent` 保留为外部 runner harness。

但不把 benchmark 报告当长期产品文档。

原因：

- benchmark 需要持续维护。
- runner 依赖外部 Agent。
- token/cost/路径长度评测会随模型变化漂移。
- 如果没有默认 gate，很容易变成过期宣传。

后续如果做，只能开窄 issue。

### 10.8 不写兼容 fallback

最终规则是：

- 永远不要写逻辑向后兼容实现。
- 旧参数不保留 fallback。
- 旧行为不保留 fallback。
- 旧文档残留不保留 fallback。
- 只允许命令名称层面的 Agent 友好别名。
- 别名必须收敛到同一内部实现路径。

这条规则看起来激进。

但它是项目从复杂度里逃出来的关键。

## 11. 关键设计决策

### 11.1 session 是产品核心，不是实现细节

session 不是为了方便缓存浏览器。

session 是用户任务上下文。

它承载：

- 页面。
- tab。
- storage。
- cookies。
- network。
- console。
- errors。
- routes。
- bootstrap。
- diagnostics。
- artifacts。
- stream。
- control state。

所以 session lifecycle 必须少。

生命周期入口越多，状态就越不可控。

### 11.2 output envelope 比文本漂亮更重要

Agent 依赖结构化输出。

因此 JSON envelope、错误码、details、suggestions、run pointers 都是产品能力。

文本输出可以简洁。

JSON 输出必须稳定。

### 11.3 help 是 contract

`pw --help` 和 `pw <command> --help` 是命令参数真相。

后期加入 help contract，是因为文档很容易漂移。

如果 help 不完整，Agent 会猜参数。

Agent 猜参数会导致错误路径。

所以每个命令需要：

- Purpose。
- Options。
- Examples。
- Notes。
- 当前版本号。

### 11.4 skill 是 SOP，不是手册

`skills/pwcli/` 不是完整命令手册。

它是 Agent 工作流路由。

命令细节由 CLI help 承担。

skill 负责告诉 Agent：

- 什么时候用哪个命令族。
- 动作后要 wait/verify。
- 失败后先 diagnostics。
- 哪些能力只是启发式。
- 哪些限制必须报告。

### 11.5 diagnostics 是恢复，不是日志

普通日志只记录发生过什么。

`pwcli` diagnostics 要回答：

- 为什么失败。
- 失败是否可恢复。
- 下一步做什么。
- 有哪些证据。
- 是否有高信号错误。
- 是否是第三方噪音。
- 是否需要人类接手。

这就是为什么 diagnostics 模块复杂。

它承担了 Agent failure recovery 的核心。

### 11.6 batch 是稳定子集，不是万能 runner

batch 的诱惑是一次跑很多命令。

但 batch 如果支持全部 CLI，就会复制整个命令系统。

最终只承诺稳定子集。

这是正确取舍。

### 11.7 act 是 shortcut，不是 planner

`find-best` 和 `act` 只解决高频 click intent。

它们不做复杂多步计划。

这是为了避免和 Agent 自身 planner 重叠。

CLI 负责可靠 primitive。

Agent 负责任务规划。

### 11.8 preview 是观察，不是控制主路

`stream` 和 `view` 只读。

`takeover` 只是控制状态。

这避免项目变成浏览器 IDE。

### 11.9 route/mock 要有证据

route/mock 很容易让测试看起来通过。

但如果没有命中证据，就是假成功。

所以 route/mock 后要通过 route list、network records 或 page facts 证明。

### 11.10 limitation 不包装成 support

这个原则贯穿后期。

如果 Playwright 不支持，不能包装成“已支持”。

如果只支持部分场景，必须写 limitation。

如果只是事件投影，不能叫 authoritative state。

## 12. 普通项目为什么不应该这么复杂

这个项目确实比普通 CLI 复杂。

复杂度有必要部分。

也有历史代价部分。

### 12.1 必要复杂性

必要复杂性来自 Agent-first。

Agent 使用浏览器和人类不一样。

人类能看页面、理解错误、调整步骤。

Agent 需要：

- 稳定事实。
- 稳定目标。
- 稳定错误码。
- 稳定恢复建议。
- 稳定证据路径。
- 稳定命令 help。

所以一些复杂性不可避免：

- session 管理。
- ref epoch。
- diagnostics envelope。
- action evidence。
- failure screenshot。
- contract tests。
- skill SOP。

这些不是过度设计。

### 12.2 历史代价复杂性

历史代价来自产品边界太晚收紧。

一开始如果只做：

- session。
- observe/read/snapshot。
- click/fill/type/press。
- wait/verify。
- diagnostics。
- skill。

项目会简单很多。

但中途又尝试：

- route/mock 高级能力。
- environment clock/geolocation。
- dashboard。
- attachable browsers。
- extraction recipes。
- benchmark pipeline。
- MCP。
- workbench。
- system Chrome profile。
- accessibility/HAR/video。

这些有些留下了。

有些砍掉了。

但每一次尝试都会留下架构痕迹和测试债务。

### 12.3 Agent coding 的风险

Agent coding 最大风险不是写不出代码。

最大风险是写太多代码。

它会很快补齐一个方向。

也会很快把方向扩成平台。

如果没有硬边界，Agent 会不断回答：

“可以做。”

但产品管理要问：

“应该做吗？”

`pwcli` 的复杂性，很大一部分就是“可以做”压过了“应该做”。

### 12.4 Web Code 使用教训

如果用 Web Code 或 Agent 写浏览器工具，必须先写反需求。

例如：

- 不做自研浏览器。
- 不做站点 recipe 平台。
- 不做插件系统。
- 不做完整测试框架。
- 不做兼容 fallback。
- 不做云端 workbench。
- 不做所有 Playwright API wrapper。

如果只写需求，不写反需求，Agent 会把所有相邻能力都补上。

这就是项目早期膨胀的根因之一。

## 13. 远程 issue 管理复盘

### 13.1 Issue 管理最终状态

当前远程 issue 全部关闭。

最后处理的是：

- `#137` 竞品对齐路线图。
- `#138` semantic intent。
- `#139` structured extract/form。
- `#140` local workbench/stream/takeover。
- `#141` version-synced skill。
- `#142` system Chrome profile 登录态。

其中：

- `#138` 到 `#141` 是已实现后补关闭。
- `#137` 是阶段性路线图完成后关闭。
- `#142` 是按产品边界关闭。

### 13.2 Issue 作为质量门

issue 在这个项目中有两种角色。

第一种是需求拆分。

例如：

- 添加 state checks。
- 添加 hover。
- 添加 verify。
- 添加 PDF。
- 添加 trace。

第二种是评测暴露问题后的 bug 管理。

例如：

- HAR 假成功。
- accessibility API 错误。
- batch 静默忽略。
- route remove 不完整。
- click test-id 内部错误。

第二种更重要。

它把“跑通 demo”变成“修掉 contract 漏洞”。

### 13.3 Issue 管理的问题

也有明显问题。

很多 issue 没有 label。

`unlabeled` 有 45 个。

这说明 triage 状态机没有一直稳定执行。

有些 issue 是路线图，有些是 bug，有些是决策，有些是 backlog。

它们都进了同一个池子。

后期才补上更清晰的处理：

- 已实现的关闭。
- 边界不做的关闭。
- 大路线图不长期挂着。
- 后续只开窄 issue。

### 13.4 后续 issue 原则

后续 issue 应该只分三类：

- bug：真实命令失败、假成功、contract 漂移。
- enhancement：可测试的窄能力。
- decision：产品边界决策，结论出来后关闭。

不建议再开：

- 大 roadmap issue。
- 竞品全量对标 issue。
- 长期 backlog issue。
- 模糊 benchmark issue。
- “以后可能做” issue。

如果做 benchmark，也要窄：

- 输入任务是什么。
- runner 是什么。
- 输出 schema 是什么。
- gate 是什么。
- 失败如何归因。

## 14. 本地 commit 管理复盘

### 14.1 Commit 太密

394 个 commit 分布在很短时间内。

这对探索很有效。

但对长期维护不友好。

问题是：

- 很难从 git log 看清主线。
- 很多 docs/validation/roadmap commit 后来被清理。
- 一些重复 commit 来自并行分支和 merge。
- 功能和修复交织。
- 重构和迁移修复交织。

### 14.2 Commit 仍有价值

虽然密，但 commit 历史保留了真实决策脉络。

例如：

- 先加 recipe，后砍 recipe。
- 先加 HAR 命令，后定义 lifecycle 边界。
- 先加 dashboard，后收敛 preview/takeover。
- 先支持 system Chrome profile，后关闭产品承诺。
- 先扩 batch，后加 allowlist 和错误信封。

这些历史能解释为什么当前规则这么硬。

### 14.3 后续 commit 原则

后续建议：

- 一个 commit 只做一个 contract 或一个 bug。
- 大重构前先开 issue 写边界。
- 重构 commit 不夹带产品行为变化。
- 行为变化 commit 必须同步 skill/help/test。
- docs commit 不保留临时过程。
- release 前 squash 不是必须，但要保证 tag 可解释。

## 15. 三轮重构的真实意义

### 15.1 第一轮解决“没有形状”

早期从脚本式 CLI 走向分层。

这解决了项目没有形状的问题。

它把 session、diagnostics、auth、workspace 这些概念暴露出来。

### 15.2 第二轮解决“形状太虚”

中期出现 hollow domain。

也就是模块看起来分层了，但只是转发。

第二轮重构开始去掉空 re-export，合并 workspace facts，拆 diagnostics 和 identity。

它解决的是“假架构”问题。

### 15.3 第三轮解决“实现和表面耦合”

engine-first + citty CLI 层解决的是 CLI 和 engine 混杂。

这轮之后才有当前边界：

- CLI 是表面。
- Engine 是能力。
- Store 是 I/O。
- Auth 是 provider。

这让 1.0 之后继续维护成为可能。

## 16. 当前留下的风险

### 16.1 README 曾有一个边界风险

README 曾有“复用本机 Chrome 登录态”的示例。

但 `#142` 已经按不承诺系统 Chrome profile 登录态关闭。

这意味着 README 文案后来必须清理。

建议把该段改成：

- `profile list-chrome` 可用于发现 profile。
- system Chrome profile 复用不是跨平台稳定承诺。
- 推荐 `profile save-state` 和 `profile save-auth`。

这不影响当前复盘文档。

该清理点已经在后续评测中处理为明确边界：系统 Chrome profile 只是 best-effort 辅助迁移入口，不是稳定登录态复用主路。

### 16.2 `test:e2e:agent` 还不是默认真实 benchmark

当前 `test:e2e:agent` 是外部 runner harness。

它要求 `PWCLI_AGENT_EVAL_RUNNER`。

这很好。

但不能把它说成默认真实 benchmark。

如果未来要做，需要另开窄 issue。

### 16.3 Diagnostics 噪音列表是手工维护

tracking domains 当前只是降权。

它不是过滤。

它不需要继续产品化。

但它仍是一个手工列表。

后续如果误伤，处理方式应该是调整 scoring，不要引入大型动态规则系统。

### 16.4 命令面仍然宽

当前 CLI 命令已经很多。

`pw --help` 有 60+ 个命令。

虽然边界已写清，但新人仍会感到复杂。

后续不应该再轻易加顶层命令。

优先考虑：

- 子命令。
- 现有命令参数。
- 文档说明。
- 不做。

### 16.5 Preview/workbench 可能继续诱惑扩张

`stream` 和 `view` 很容易被继续扩成：

- annotations。
- live control。
- shared cursor。
- record/replay。
- cloud session。

这些目前都不应该做。

除非有真实任务证明 CLI 主链无法完成。

## 17. 后续 Roadmap 建议

### 17.1 原则

后续 roadmap 不应该再是“竞品有什么我们补什么”。

后续 roadmap 应该只来自：

- 真实任务失败。
- contract 漂移。
- 用户明确痛点。
- 发布阻断。
- 安全边界。

### 17.2 短期

短期只建议做清理和边界修正。

建议事项：

- 清理 README 中 system Chrome profile 登录态复用的措辞。
- 确认 `#142` 的产品边界同步到 skill。
- 给 `session create --from-system-chrome` 增加 macOS/default profile fail-fast。
- 不再扩展自研浏览器方向。
- 跑一次 `pnpm check` 和 `pnpm smoke` 作为 tag 后确认。

### 17.3 中期

中期只建议做窄能力。

可考虑：

- 更稳定的 `test:e2e:agent` runner contract。
- 真实 Agent task summary 的最小 benchmark。
- `diagnostics bundle` 的高信号排序继续优化。
- `profile save-auth` 的错误提示和 schema 校验。
- action policy 的更清晰文档。

不建议：

- 新增完整 planner。
- 新增 recipe 平台。
- 新增 plugin 平台。
- 新增 browser workbench 产品。
- 新增 Chrome profile 接管方案。

### 17.4 长期

长期方向应该是稳定性，而不是能力数。

好的长期指标：

- Agent 完成任务所需命令数下降。
- 失败后恢复命令数下降。
- 假成功数量下降。
- help/skill 漂移为 0。
- smoke 维护成本不增长。
- 顶层命令数不明显增长。

不好的长期指标：

- 命令数量继续增长。
- benchmark 报告继续增长。
- skill 变成完整手册。
- README 变成 SOP。
- docs 目录重新堆满过程记录。

## 18. 如果重新做一次

如果从零再做一次，建议这样开始。

第一天只做：

- `session create/status/list/close`。
- `open`。
- `read-text`。
- `snapshot -i`。
- `click/fill/type/press`。
- `wait`。
- `verify`。
- `diagnostics digest`。

第二步才做：

- action failure envelope。
- run evidence。
- failure screenshot。
- skill SOP。
- help contract。
- integration core。

第三步才做：

- route/bootstrap/environment。
- state/auth。
- batch stable subset。
- trace/HAR/video。

最后才考虑：

- semantic intent。
- form/extract。
- preview/takeover。
- agent benchmark。

并且一开始就写反需求：

- 不做自研浏览器。
- 不做 recipe extraction。
- 不做 plugin system。
- 不做 browser IDE。
- 不做 Playwright API mirror。
- 不做兼容 fallback。
- 不做长期历史文档。

这样项目会小很多。

## 19. 最终判断

`pwcli` 现在不是屎山。

但它经历过屎山风险最高的阶段。

风险来自：

- 功能冲刺太快。
- 需求边界太晚。
- 文档太多。
- 临时 benchmark 太多。
- 抽取平台诱惑。
- 竞品对齐诱惑。
- 浏览器 profile 复用诱惑。
- Agent 可以快速实现太多相邻能力。

`v1.0.0` 的意义是：

- 把主链写清。
- 把命令边界写清。
- 把测试分层写清。
- 把文档入口写清。
- 把不做什么写清。

后续维护的关键不是继续证明能做更多。

关键是守住现在这些边界。

如果未来某个能力不能回答下面四个问题，就不要做：

- 它服务哪条 Agent 主链？
- 它是否能用 contract 测试证明？
- 它是否能写进 `pw --help` 而不误导？
- 它是否不会把项目推向另一个平台？

只要这四个问题守住，`pwcli` 就还能保持工具形态。

守不住，它会再次变成平台化泥潭。

## 20. 附录：关键时间线

### 2026-04-25

- 初始化 `pwcli`。
- 落地 default managed browser 主链。
- 补齐登录复用直达目标页能力。
- 接入 DC 登录入口。
- 收口为严格 session-first 命令面。
- 支持 session recreate 与 resize。

### 2026-04-26

- 收口 acquisition 主路。
- 补 diagnostics 基座。
- 补 bootstrap。
- 补结构化 diagnostics。
- 建立 attach 和 diagnostics verification spine。
- 尝试 ddd-lite layers。
- 暴露 modal blocked sessions。
- 加 structured batch。
- 加 diagnostics digest。
- 加 dogfood e2e fixture。
- 加 dialog recovery。

### 2026-04-27

- 扩展 route matching。
- 加 route response patch。
- 收紧 batch serial guardrails。
- 支持 session close all。
- auth 迁移到内置 provider。
- 补 auth session 和 clock gaps。
- refine DC auth workflows。
- 加 interactive snapshot。
- 改进 overlay reads 和 code diagnostics。
- 按 skill-creator 重构 skill。

### 2026-04-28

- 初始化 Codex project maintenance。
- 稳定 session trace 和 output。
- 澄清 auth registry。
- 加 pageId tab controls。
- 定义 browser task state model。
- 修 tab close fallback。
- 加 review guidelines。
- 修 popup opener fallback。
- 记录 semantic click evidence。

### 2026-04-29

- issue candidates 进入 domain status。
- batch 默认 summary-only。
- 恢复 batch results。
- managed action errors。
- action failure contract。
- action failure classifier。
- stale ref failure。
- action run evidence。
- modal blockage recovery docs。
- dashboard。
- semantic fill/type。
- storage/control primitives。
- semantic click in batch。
- snapshot ref epochs。
- PDF。
- trace inspect。
- state check primitives。
- attachable browser servers。

### 2026-04-30

- diagnostics bundle audit。
- verify assertions。
- hover primitive。
- locate nth。
- core convergence contract fixes。
- agent recovery and ergonomics。
- managed session lifecycle locking。
- system Chrome profile session support。
- managed session startup serialization。
- v0.1.0 release docs。

### 2026-05-01

- agent-facing assessment。
- benchmark primitives。
- extraction benchmark closure。
- MCP / attachable attach / recipe pack。
- paginated extraction。
- raw document extraction。
- hard-cut extraction runtime。
- add/remove recipe lane。
- remove hollow re-exports。
- consolidate workspace facts。
- remove stale benchmark references。

### 2026-05-02

- normalize networkidle。
- split diagnostics。
- split identity-state。
- failure screenshot。
- REF_STALE recovery。
- diagnostics timeline。
- batch stable subset。
- semantic locators。
- read-text defaults。
- current page noise filters。
- modal detection。
- iframe/ref fixes。
- tracking/noise filtering。
- shadow DOM。
- selector error handling。
- dashboard/session cleanup。
- v0.1.0 package prep。
- recovery envelope。
- skill contract。
- SSE observation。
- interaction domain extraction。

### 2026-05-03

- architecture issue batch。
- action orchestration extraction。
- health-check I/O split。
- batch stable subset expansion。
- mouse/video。
- popup openedPage。
- accessibility。
- HAR replay。
- doctor precheck。
- state diff values。
- e2e/unit tests。
- v0.2.0。
- Agent Browser 竞品分析。
- P1/P2 bug fixes。
- snapshot compact。
- screenshot annotate。
- realistic fixture。
- benchmark pipeline。
- engine-first + citty CLI 重构。
- smoke 修复。
- verify/error envelope 回归修复。

### 2026-05-04

- 项目完成 roadmap。
- 中文优先文档约束。
- Node 24 + pnpm 10 基线。
- diagnostics export/bundle 写出。
- command family coverage。
- Agent-driven validation。
- geolocation contract。
- 禁止逻辑兼容铁律。
- batch verify failures。
- trace path。
- skill path。
- release blocker scan。
- pre-1.0 command evaluation sprint。
- lifecycle/interaction/network/artifact/environment/state/tool boundary validation。
- real env blocker。
- HAR replay boundary。
- skill SOP audit。
- CodeStable truth audit。
- help contract。
- docs cleanup。

### 2026-05-05

- 重写测试体系。
- version-synced skill content。
- semantic/form/extract/safety primitives。
- session safety and preview primitives。
- action policy centralization。
- HAR lifecycle recording。
- video lifecycle recording。
- preview stream status。
- accessibility success test。
- trace unsupported filters。
- takeover blocks session mutations。
- allowed-domain scope docs。
- help usage docs。
- README takeover scope。
- `v1.0.0` tag。

## 21. 附录：远程 issue 分段

### `#3-#20`

这一段主要是早期能力补齐和设计探索。

主题包括：

- modal blocked recovery。
- diagnostics query。
- route mock。
- batch serial。
- environment clock。
- workspace mutation contract。
- cold-start Agent DX。
- auth provider help。
- user-browser relay。
- tab controls。
- popup fallback。

### `#21-#40`

这一段是 Agent primitives。

主题包括：

- stale snapshot refs。
- semantic locator evidence。
- locate/get/is/verify。
- dashboard。
- trace。
- attachable servers。
- storage。
- semantic fill/type。
- interaction primitives。
- video。
- PDF。
- batch semantic click。

### `#41-#60`

这一段是 action failure 和 ergonomics。

主题包括：

- semantic locator failure taxonomy。
- managed action failure。
- dashboard launch。
- diagnostics bundle。
- verify。
- hover。
- locate nth。
- same-session serialization。
- DC auth target。
- dialog-triggering action。
- failed action records。

### `#61-#80`

这一段是真实使用暴露的 DX 和 recovery。

主题包括：

- large real-page snapshots。
- search challenge fallback。
- upload verification。
- trace artifact path。
- download dir alias。
- route/mock gating。
- extraction evidence。
- script/injection 不产品化。
- ref staleness。
- failure screenshot。
- diagnostics runs。
- click navigation timeout。

### `#81-#100`

这一段是 v0.1 到 v0.2 的产品硬化。

主题包括：

- session recreate timeout。
- get value semantic timeout。
- page list pageId。
- diagnostics output length。
- trace limit。
- batch JSON redundancy。
- Agent output contract。
- recovery envelope。
- action evidence。
- skill contract。
- auth probe。
- PRD v0.2。
- SSE。
- WebSocket。
- batch stable subset。

### `#101-#120`

这一段是高价值能力和错误提示。

主题包括：

- diagnostics timeline noise。
- return ref。
- network full body。
- modal recovery hints。
- recreate timeout hints。
- tab/page list suggestions。
- read-text iframe hints。
- RUN_CODE_TIMEOUT。
- doctor precheck。
- state diff values。
- bootstrap failure suggestions。
- trace limited message。
- popup detection。
- accessibility。
- HAR replay。
- mouse。
- video。
- screenshot annotate。
- snapshot compact。

### `#121-#136`

这一段是评测暴露的 P1/P2 bug。

主题包括：

- batch wait `network-idle`。
- Node/statfs baseline。
- action failure classifier missing codes。
- batch press 静默忽略。
- video path parsing。
- route list mode。
- route suggestions。
- health-check I/O 分层。
- accessibility API。
- HAR capture 假成功。
- HAR update。
- HAR replay cleanup。
- tab close fallback。
- DIAGNOSTICS_STATE_KEY。
- route remove 双 pattern。

### `#137-#142`

这一段是最终路线图和边界收口。

主题包括：

- competitive parity。
- semantic intent。
- structured extract/form。
- local workbench/stream/takeover。
- version-synced skill。
- system Chrome profile 登录态。

最终处理：

- `#138-#141` 按已实现关闭。
- `#137` 按阶段性路线图完成关闭。
- `#142` 按产品边界 `not planned` 关闭。

## 22. 结语

这份历史最重要的不是证明项目做了很多。

做了很多本身不是优点。

真正重要的是：

- 哪些能力留下了。
- 哪些能力被砍掉了。
- 哪些能力被降级成边界说明。
- 哪些探索只作为证据存在。
- 哪些规则是被失败逼出来的。

`pwcli` 的下一阶段不应该追求更复杂。

它应该追求更少假成功、更少漂移、更少命令、更强恢复。

如果未来继续由 Agent 写代码，维护者最重要的工作不是催它多做。

而是不断问：

- 这是不是主链需要？
- 这是不是当前命令边界能承载？
- 这是不是能被默认 gate 证明？
- 这是不是会诱导项目变成另一个平台？

只有这些问题持续存在，项目才不会再次走回复杂度泥潭。

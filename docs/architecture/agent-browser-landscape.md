# Agent-Browser 生态分析与 pwcli 战略参考

> 基于 playwright-core 做 Agent 的眼和手，尽量少手搓代码。

## 竞品分析

| 产品 | 眼（如何看） | 手（如何操作） | 证据/归因 | pwcli 最值得借鉴 |
|---|---|---|---|---|
| **browser-use** | Screenshot + DOM + a11y tree，双通道输入 | Playwright 执行点击/输入/滚动，Agent loop 决策 | Tracing、截图回溯、self-correcting retry | Agent loop 架构；DOM+视觉双通道作为上下文 |
| **Stagehand** | DOM chunking + ranking（非纯视觉），聚焦可交互元素 | `act/extract/observe/agent` 四个原语，Playwright 兜底 | Action caching、session replay、确定性 fallback | **Hybrid 模式**：确定性 Playwright + AI 原语；`extract` 的 Zod schema 结构化输出 |
| **Skyvern** | CV 识别截图元素 + DOM 文本， Planner-Actor-Validator 分工 | 多 Agent 协作执行（规划/执行/验证） | 视频回放、viewport streaming、workflow history | 视觉抗布局变化思路；Plan-Act-Validate 分离 |
| **Playwright MCP** | a11y tree + screenshot + DOM，通过 MCP tools 暴露 | 标准 Playwright 操作（goto/click/fill 等） | Trace、screenshot、结构化 tool response | MCP 作为标准接口层；**CLI companion**（比 MCP 少 4x token） |
| **Playwright Codegen** | 无 AI，纯录制 DOM 事件 | 生成确定性 Playwright 代码 | 无 | 不直接相关，但 Codegen + Healer 是互补方向 |
| **OpenAI Computer Use** | 纯 screenshot（像素级视觉） | 返回坐标级鼠标/键盘动作 | Screenshot 循环、action trace；takeover mode 安全护栏 | 视觉-first 通用性；**安全接管模式**（敏感操作交还用户） |

## 方向分类

### 高价值且 playwright-core 已原生支持（只需暴露接口）

- **a11y tree 快照格式化**：`page.accessibility.snapshot()` 已存在，缺的是裁剪、标注、LLM-friendly 输出。
- **Screenshot + 元素高亮**：`page.screenshot()` + `page.evaluate()` 画 bounding box 即可实现视觉标注。
- **Tracing / Screencast 证据链**：Playwright 1.59+ 的 `page.screencast` 和已有 tracing 非常成熟，缺的是面向 Agent 的"证据报告"格式化输出。
- **browser.bind() 多客户端共享**：1.59+ 支持 MCP/CLI/人共用一个浏览器实例，pwcli 可作为统一入口。

### 高价值但需要新 substrate

- **DOM 语义压缩 / Token 裁剪**：a11y tree 动辄数万 token，需要可逆的压缩策略（如只保留交互元素、按 viewport 裁剪）。
- **自然语言 → 确定性操作缓存**：Stagehand 3.0 的 action caching（AI 动作 → 确定性 locator 缓存），需要 pwcli 层维护映射层。
- **视觉坐标 → Playwright locator 映射**：纯视觉模型返回 (x,y)，需映射回 playwright 的元素句柄才能利用其原生能力。

### 不适合 pwcli 定位的方向

- **内嵌 LLM / Agent 推理框架**（如 browser-use 的完整 agent loop）—— pwcli 是工具层，不是 agent 层。
- **云端浏览器基础设施**（如 Browserbase）—— 与 pwcli CLI 工具定位不符。
- **No-code UI / workflow builder**—— 超出 scope。
- **自研 CV 模型**—— 应复用现有 VLM，不做模型训练。

## pwcli 最值得做的 3 个战略方向

1. **结构化页面感知（The Eye）**
   把 playwright-core 的 a11y tree + DOM + screenshot 整合成统一的"页面快照"，支持 token 预算裁剪和元素坐标标注。让任何 LLM/Agent 接上 pwcli 就能拥有高质量的眼，而不是每个 Agent 自己重复实现 DOM 解析。

2. **自然语言操作原语 + Hybrid Fallback（The Hand）**
   提供 `act("click the submit button")` 这类高级原语：优先用 playwright-core 原生 locator（确定性、快、无 LLM 成本），失败时 fallback 到 AI 解析。不替代 Playwright，而是让 Playwright 获得自然语言弹性。

3. **可审计的证据链输出（The Receipt）**
   统一 tracing + screencast + action log，输出 Agent 可消费的 JSON/视频证据。失败时 Agent 能直接读取结构化证据做 self-healing，人类也能秒级定位问题。让 pwcli 成为 Agent 浏览器操作的可信执行层。

# 竞品分析：Agent Browser 生态 vs pwcli

## 1. 竞品速览

| 产品 | 本质 | 眼 | 手 | 定价 |
|------|------|-----|-----|------|
| **Agent Browser** | Rust CLI，CDP 直连 | snapshot + `@e1` refs，annotated screenshot | click/fill/find/wait | 开源免费 |
| **browser-use** | Python Agent 框架 | DOM + screenshot 双通道 | Playwright 执行 + LLM 决策 | 开源 / Cloud $0.06/hr |
| **Stagehand** | TS SDK，Playwright 增强 | DOM chunking + ranking | `act/extract/observe` + caching | 开源 / Browserbase 云 |
| **Playwright MCP** | MCP 工具层 | a11y tree + screenshot | 标准 Playwright 操作 | 完全免费 |

---

## 2. pwcli vs Agent Browser 六维对比

| 维度 | 赢家 | 核心差距 |
|------|------|----------|
| **眼** | Agent Browser | annotated screenshot + 语义压缩（~10% token），pwcli 缺视觉标注 |
| **手** | 平手 | 命令集高度重叠；pwcli `wait` 条件更丰富 |
| **证据链** | **pwcli** | diagnostics bundle/timeline/grep + trace inspect 体系化程度远超 |
| **Agent 集成** | Agent Browser | `chat` NL→命令 + Dashboard 实时观察 + Skills 分发 |
| **托管/云端** | 各有场景 | Agent Browser 整合 Vercel 生态；pwcli 纯本地无 vendor lock-in |
| **Playwright 兼容** | **pwcli** | 三浏览器（Chromium/Firefox/WebKit）；Agent Browser 仅 Chromium/CDP |

---

## 3. pwcli 绝对优势（现在就能做）

1. **跨浏览器**：Agent Browser 只支持 Chromium，pwcli 原生三浏览器。
2. **诊断深度**：`diagnostics bundle/export/timeline/grep` + `trace inspect` 是完整证据链，Agent Browser 只有基础 trace/console。
3. **Controlled Testing**：`route mock` + `environment clock` + `bootstrap` 是确定性复现基础设施，竞品无此概念。
4. **错误码体系**：20+ 结构化错误码（`REF_STALE`、`MODAL_STATE_BLOCKED` 等）+ 恢复文档，Agent Browser 恢复路径较薄。
5. **Session 严格性**：`create|attach|recreate` 分离 + per-session lock，避免并发状态漂移。

---

## 4. 需补差距（按优先级）

| 优先级 | 项 | 难度 |
|--------|-----|------|
| **P0** | **Annotated Screenshot**（截图叠元素编号，视觉+文本双通道） | 中 |
| **P0** | **Snapshot 语义压缩**（viewport 裁剪 + 去空节点，降 token） | 中 |
| **P1** | **Diff 能力**（snapshot/screenshot/URL 对比，回归测试） | 低-中 |
| **P1** | **Dashboard 增强**（live viewport + activity feed） | 中 |
| **P2** | **NL→命令原语 `act`**（自然语言转操作，失败 fallback） | 高 |
| **P2** | **自动 State 持久化**（session 自动 save/load） | 低 |
| **P3** | **安全护栏**（domain allowlist、action policy） | 中 |

---

## 5. 战略建议（3 个月方向）

> 不追 Rust 性能、不卷 token 压缩率。pwcli 的护城河是 **Playwright 完整兼容 + 诊断证据链 + 测试确定性**。

最值得投入：

1. **The Annotated Eye（6 周）**：`screenshot --annotate` + `snapshot --compact`，让 Agent 拥有视觉+文本双通道感知，替代各 Agent 重复解析 DOM。
2. **The Receipt（4 周）**：把 diagnostics + trace 统一为 Agent 可消费的 `evidence.json`，失败时 Agent 能读取做 self-healing。
3. **Hybrid Hand（8 周）**：`pw act "click submit"` 优先用 Playwright locator（确定性、零 LLM 成本），失败 fallback 语义解析——让 Playwright 获得自然语言弹性，而非替代它。

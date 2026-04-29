# Browserbase `/browser-trace` 与 `browse cdp` 调研（外部基准）

更新时间：2026-04-29  
状态：active（external benchmark）

## 1. 调研目标

- 澄清 Browserbase 社区热议的 `/browser-trace` 在做什么、边界是什么。
- 对比 `pwcli` 当前 diagnostics 能力，识别可借鉴点。
- 给出不破坏现有 lifecycle / workspace contract 的演进方向。

## 2. 对象定义

### Browserbase `/browser-trace`（skill）

- 定位：给“已经在运行的浏览器自动化”外挂一条只读观测链路。
- 核心机制：第二个 CDP 客户端并联接入，不发动作命令，只订阅事件。
- 产物：CDP 原始流、截图时间序列、DOM 快照时间序列、分桶后的 JSONL。

### `browse cdp`（browse CLI 的能力面）

- 定位：把目标浏览器的 CDP 事件流按 NDJSON 持续输出。
- 在 `/browser-trace` 中承担 firehose 入口。
- 本质：是“底层观测管道”，不是任务执行器。

## 3. 关键设计（为什么社区觉得“强”）

1. **并联观测，不接管执行**
   - 主自动化与 trace 客户端职责分离，降低干扰与改写风险。
2. **先 raw，再 bisect**
   - 先完整落盘 `raw.ndjson`，再离线切分 network/console/page/runtime 等桶。
3. **时间轴统一**
   - CDP 事件 + screenshot + DOM 都可按时间戳关联，利于复盘“那一秒发生了什么”。
4. **目录即查询接口**
   - run 目录结构稳定，bash/jq/rg 可直接查询，不依赖重型后端。
5. **可中途挂载**
   - 可在自动化中途 attach 观测，适合定位偶发失败。

## 4. 与 `pwcli` 当前能力对比

| 维度 | Browserbase `/browser-trace` | `pwcli` 当前状态 | 结论 |
|---|---|---|---|
| 角色边界 | 明确“只观测，不驱动” | diagnostics 与执行链路耦合在同一 CLI 中 | 可借鉴“只读附加观测通道” |
| 数据粒度 | CDP 全量 firehose + 轮询截图/DOM | `console/network/errors/diagnostics digest/export` + runs events.jsonl + trace inspect | `pwcli` 更偏“任务级证据”，firehose 粒度偏轻 |
| 数据落盘形态 | `raw.ndjson` + 按域分桶 JSONL + pages 分片 | `.pwcli/runs/<runId>/events.jsonl` + Playwright substrate artifacts | 可补“统一可 grep 的时序目录” |
| 接入时机 | 可 mid-flight attach | 以 session 生命周期内命令查询为主 | 可补“对已存在会话的一键捕获” |
| 查询体验 | 文件系统检索优先（jq/rg） | CLI 查询优先，trace inspect 为离线入口 | 两者可互补，不冲突 |
| 成本/噪声 | 高数据量、高 IO，需域名/频率控制 | 默认更轻量，适合日常 agent 执行 | 不应全量默认开启，宜按需启用 |

## 5. 对 `pwcli` 的启发（不越界版）

### 5.1 可优先尝试（低风险）

1. **`diagnostics capture` 模式（按需）**
   - 为指定 session 增加“只读高保真捕获”开关。
   - 输出统一目录（例如 `.pwcli/o11y/<captureId>/`），含 manifest/index/raw/slices。
2. **离线 bisect 工具**
   - 在现有 `diagnostics export` 之外，增加“按域切片”命令，仍基于文件系统。
3. **时间轴索引**
   - 给 screenshot / network / console 增加统一 timestamp 索引，提升跨证据对齐能力。

### 5.2 中期增强（需谨慎）

1. **增量 CDP 域订阅策略**
   - 默认 minimal（Network/Console/Page）；DOM/Runtime 由 flag 明确开启。
2. **session attach 观测副通道**
   - 仅做 observability attach，不改变 `session create|attach|recreate` 主路语义。
3. **故障包一键导出**
   - 把 run 关键证据 + 分桶摘要打包，降低异地复盘成本。

### 5.3 明确不做（当前阶段）

- 不把 diagnostics 捕获包装成“默认开启全量 trace”。
- 不引入第二套“执行器”语义，避免与现有 commands 边界漂移。
- 不用 index/title/url-substring 做写操作目标，继续遵守 stable identity contract。

## 6. 建议的 issue 候选

1. **P1: o11y capture 最小闭环**
   - 交付：capture start/stop + manifest + raw + summary。
2. **P1: diagnostics timeline index**
   - 交付：跨 console/network/screenshot 的统一时间戳索引。
3. **P2: bisect slices**
   - 交付：network/console/page 分桶 JSONL 与页级切片。
4. **P2: recovery 文档同步**
   - 交付：新增阻断态（高 IO、capture attach 失败、session ended）的恢复路径。

## 7. 与现有架构规则的一致性

- 不改变 lifecycle 主路：仍以 `session create|attach|recreate` 为唯一入口。
- `open` 继续只做导航。
- diagnostics 增强定位为“可选观测层”，不是新执行层。
- 若命令面新增，必须先同步 `skills/pwcli/` 的 command-reference 与 failure-recovery。

## 8. 产品经理视角：一手高频需求清单（先做大家都会用的）

> 目标：不讨论商业化，只讨论“内部 Agent 日常高频场景”里的普适需求。以下按“使用频率 × 价值 × 落地复杂度”排序。

### D1（P0）失败现场一键打包（最先做）

- 真实痛点：失败后上下文分散在 console/network/errors/screenshot/trace，人工拼证据耗时。
- 需求描述：提供单命令把“本次失败最小必要证据集”导出到一个目录或压缩包。
- 建议形态：
  - `diagnostics bundle -s <session> [--since ...] [--out ...]`
  - 默认包含：最后 N 步动作、错误码、关键 console、失败请求、当前页 screenshot、trace 指针。
- 成功标准：
  - 一线同学收到 bundle 后 5 分钟内能复现结论链路；
  - review/交接不再需要手工二次整理证据。

### D2（P0）统一时间轴检索（跨证据对齐）

- 真实痛点：知道“出错了”，但不知道“先发生了什么”。
- 需求描述：提供按时间排序的统一索引，把 action / network / console / error / screenshot 串起来。
- 建议形态：
  - `diagnostics timeline -s <session> [--since ...] [--filter ...]`
  - 可导出 JSONL 供 `jq/rg` 二次分析。
- 成功标准：
  - 能在一次查询里回答“故障前后 10 秒发生了什么”。

### D3（P1）按需高保真 capture（可开可关）

- 真实痛点：低频疑难问题需要更细粒度观测，但不希望默认引入高 IO 成本。
- 需求描述：为指定 session 开启 capture 模式，生成独立 `captureId` 目录。
- 建议形态：
  - `diagnostics capture start|stop -s <session>`
  - `diagnostics capture show <captureId>`
- 成功标准：
  - 不开 capture 时性能与当前一致；
  - 开启后可拿到更完整时序证据。

### D4（P1）中途 attach 观测（不打断执行）

- 真实痛点：很多问题只在长流程中后段出现，重跑成本高。
- 需求描述：允许在流程进行中挂载只读观测，不改变当前执行路径。
- 建议形态：
  - attach 到已有 session 的 observability sidecar。
- 成功标准：
  - 无需重建 session，即可开始记录高价值证据。

### D5（P1）失败恢复建议自动化（从“看见问题”到“下一步怎么做”）

- 真实痛点：新同学看到错误码不知道最短恢复路径。
- 需求描述：将错误码映射到可执行恢复命令建议，直接输出 next actions。
- 建议形态：
  - 在 `diagnostics digest` / `errors recent` 输出中补 recovery hints。
- 成功标准：
  - 常见阻断态可“一屏看到建议命令”，减少来回查文档。

### D6（P2）页面级切片与噪声控制

- 真实痛点：多 tab/多页面时噪声大，定位慢。
- 需求描述：支持按 pageId / domain / resourceType 做分桶与过滤。
- 建议形态：
  - timeline / capture 支持 `--page-id`、`--domain`、`--resource-type`。
- 成功标准：
  - 在复杂页面场景中显著降低无关事件占比。

## 9. 建议排期（可直接拿去排班）

### Sprint 1（1~2 周）：先拿“立刻可用价值”

1. D1 失败现场一键打包（P0）
2. D2 统一时间轴检索（P0）

交付后收益：排障效率立刻提升，跨人协作成本显著下降。

### Sprint 2（2~3 周）：补“疑难问题抓手”

1. D3 按需高保真 capture（P1）
2. D5 恢复建议自动化（P1）

交付后收益：减少疑难问题长尾时间，降低对资深同学依赖。

### Sprint 3（2~3 周）：做“复杂场景提效”

1. D4 中途 attach 观测（P1）
2. D6 页面级切片与噪声控制（P2）

交付后收益：长流程、多页面问题定位更稳定。

## 10. PRD 验收指标建议（内部工具版）

- MTTR（平均修复时长）：目标下降 30%+
- 首次定位成功率：目标提升到 70%+
- 单问题证据整理耗时：目标从“10~20 分钟”降到“<5 分钟”
- 新同学恢复成功率：基于错误建议的自助恢复率达到 60%+

## 11. 关键判断：这些能力对 Agent-first 的 `pwcli` 到底有没有帮助？

结论先行：**有帮助，但不是“全量照搬 Browserbase”。**

`pwcli` 已经具备较强可观测性（console/network/errors/export/trace inspect/runs artifacts）。真正缺口不是“有没有数据”，而是：

1. **跨证据对齐效率**（能否快速回答“先后因果”）
2. **失败交接效率**（能否一键给出最小可用证据包）
3. **疑难问题抓手**（是否支持按需提高采样密度，而非默认高成本）

换句话说，**Playwright Core 已给了我们很多基础能力；还要做的是“产品层编排与检索体验”**，而不是重复造一个底层录制系统。

## 12. 决策表（做/不做/后置）

| 项目 | 对 Agent-first 价值 | 当前缺口 | 成本 | 结论 | 原因 |
|---|---|---|---|---|---|
| D1 失败现场一键打包 | 高 | 高 | 低~中 | **做（P0）** | 直接降低交接与复盘成本，收益立刻可见 |
| D2 统一时间轴检索 | 高 | 中~高 | 中 | **做（P0）** | 解决“知道失败但不知先后关系”的核心痛点 |
| D3 按需高保真 capture | 中~高 | 中 | 中~高 | **做（P1，按需开关）** | 疑难场景价值高，但不应默认开启 |
| D4 中途 attach 观测 | 中 | 中 | 中~高 | **后置（P1）** | 有价值但不如 D1/D2 普适；先拿确定性收益 |
| D5 恢复建议自动化 | 中~高 | 中 | 中 | **做（P1）** | 对新人和跨班次协作帮助明显 |
| D6 页面级切片降噪 | 中 | 中 | 中 | **后置（P2）** | 复杂场景提效项，优先级低于主链排障能力 |
| 默认全量 firehose 录制 | 低~中 | 低 | 高 | **不做** | IO/噪声/成本过高，不符合日常 Agent 执行 |

## 13. 建议你现在就可以拍板的最小范围

如果你希望“少做但有效”，建议只立两个短期目标：

1. **D1 一键失败包**（bundle）
2. **D2 时间轴索引**（timeline）

这两个能力不改变 lifecycle/open/batch 边界，也不依赖重型基础设施改造，却能显著提升 Agent-first 体验。

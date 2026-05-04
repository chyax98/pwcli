# Agent Product Regression / Agent Dogfood Contract

更新时间：2026-05-04
状态：active

这份文档记录当前 Agent Product Regression / Agent dogfood 的稳定 contract。它验证的产品不是单独的二进制，而是 CLI + `skills/pwcli/` + 真实 Agent 工作流。它不是阶段计划、backlog 或 fixture 设计草案。

## 1. 目标

Agent Product Regression 用真实 `pw` 命令验证 Agent 高频链路：

1. 创建和清理 named session
2. 读取页面事实
3. 执行动作并等待结果
4. 收集 diagnostics / network / console / run evidence
5. 验证 route / bootstrap / environment / batch 等第二层能力

`pnpm test` 是当前基础回归入口；`pnpm smoke` 是发布前本地主链回归。深度验证的主入口是 Agent 按 `skills/pwcli/` 执行真实任务并沉淀证据，不是维护一条越来越长的 shell E2E 脚本。

## 2. 执行入口

基础回归入口：

```bash
pnpm test
pnpm smoke
```

高风险行为变化可复用脚本夹具：

```bash
pnpm build
bash test/e2e/pwcli-dogfood-e2e.sh
```

主要 fixture：

```text
test/e2e/
  dogfood-server.js
  dogfood-routes.json
  dogfood-routes-patch.json
  dogfood-bootstrap.js
  dogfood-route-*.json|txt
  pwcli-dogfood-e2e.sh
```

Agent dogfood evidence 不固定为单一脚本命令。执行者必须按 `skills/pwcli/` 选择真实 `pw` 命令完成任务，并在 CodeStable 中记录关键命令、结果、失败恢复和证据位置。

## 3. 当前覆盖矩阵

| 能力 | 基础覆盖 | 深度验证 |
|---|---|---|
| Lifecycle | `session create` / targeted cleanup | Agent 能按 skill 正确选择 `create|attach|recreate|close` |
| Page read | `observe status` / `read-text` / `snapshot` / `page` | Agent 能从页面事实形成下一步计划 |
| Actions | click / fill / type / press / scroll / wait | Agent 能完成表单、导航、交互恢复 |
| State checks | locate / get / is / verify | Agent 能把检查结果转成任务验收结论 |
| Diagnostics | digest / export / runs / show / grep / network / console / errors | Agent 能复现 Deep Bug、定位失败并打包证据 |
| Mock | route add/remove/list、batch route load、fulfill、patch、headers | Agent 能在测试/复现场景按需引入受控网络 |
| Environment | offline / permissions / geolocation / clock | Agent 能区分支持能力、限制和恢复路径 |
| Bootstrap | init script / headers | Agent 能为测试场景准备确定性环境 |
| Batch | single-session structured `string[][]` | Agent 能把稳定短链路批处理化，不扩大为全 CLI parity |
| Evidence | run artifacts and diagnostics deltas | Agent 能完成可交接证据链 |

## 4. 不覆盖项

- 不覆盖外部真实站点稳定性。
- 不覆盖真实 Forge/DC 登录；auth provider contract 由 smoke / provider-specific 验证负责。
- 不覆盖 Playwright Test HTML report / UI mode。
- 不把 HAR 热录制当稳定证据路径；稳定证据仍优先 `network` / `diagnostics export` / trace inspect。
- 不作为 benchmark 或评分平台。
- 不把 shell E2E 维护当作主要产品深测；脚本只作为基础回归、fixture 或特定 contract 复现手段。

## 5. 失败证据

失败时优先保留：

```text
.pwcli/runs/<runId>/events.jsonl
.pwcli/playwright/
CLI stdout/stderr
fixture server log
```

Agent 复查顺序：

```bash
pw session list --with-page
pw diagnostics runs --session <name> --limit 20
pw diagnostics digest --session <name>
pw diagnostics bundle --session <name> --out <dir>
```

## 6. 维护规则

- 命令、flag、错误码、输出变化先同步 `skills/pwcli/`。
- dogfood 只覆盖 shipped contract，不写未来计划。
- 新增场景必须能由 Agent 按 `skills/pwcli/` 用真实 `pw` 命令完成，不能只依赖裸 Playwright 脚本。
- 基础能力用 Vitest、集成测试、contract check 或小型 fixture 兜底；深度可用性用 Agent dogfood 判断。
- `pnpm test:dogfood:e2e` 或 `test/e2e/pwcli-dogfood-e2e.sh` 若失败，先判定是产品 P0/P1、contract 漂移还是脚本维护问题；不默认把修脚本作为最高优先级。
- 若 dogfood 暴露产品限制，稳定结论写回 `domain-status.md` 或 `failure-recovery.md`；具体任务放 GitHub issue。

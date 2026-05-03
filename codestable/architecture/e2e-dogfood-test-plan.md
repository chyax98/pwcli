# Agent Product Regression / E2E Dogfood Contract

更新时间：2026-05-02
状态：active

这份文档记录当前 Agent Product Regression / dogfood E2E 的稳定 contract。它验证的产品不是单独的二进制，而是 CLI + `skills/pwcli/` + 真实 Agent 工作流。它不是阶段计划、backlog 或 fixture 设计草案。

## 1. 目标

Agent Product Regression 用真实 `pw` 命令验证 Agent 高频链路：

1. 创建和清理 named session
2. 读取页面事实
3. 执行动作并等待结果
4. 收集 diagnostics / network / console / run evidence
5. 验证 route / bootstrap / environment / batch 等第二层能力

`pnpm test:regression` 是当前主回归入口；`pnpm smoke` 保留为兼容 alias，不代表 tiny smoke。dogfood E2E 是更慢、更接近真实 Agent 使用的深 gate。

## 2. 执行入口

```bash
pnpm test:dogfood:e2e
```

等价于：

```bash
pnpm build
bash scripts/e2e/pwcli-dogfood-e2e.sh
```

主要 fixture：

```text
scripts/e2e/
  dogfood-server.js
  dogfood-routes.json
  dogfood-routes-patch.json
  dogfood-bootstrap.js
  dogfood-route-*.json|txt
  pwcli-dogfood-e2e.sh
```

## 3. 当前覆盖矩阵

| 能力 | 覆盖方式 |
|---|---|
| Lifecycle | `session create` / targeted cleanup |
| Page read | `observe status` / `read-text` / `snapshot` / `page` |
| Actions | click / fill / type / press / scroll / wait |
| State checks | locate / get / is / verify |
| Diagnostics | digest / export / runs / show / grep / network / console / errors |
| Mock | route add/load/remove、fulfill、patch、headers |
| Environment | offline / permissions / geolocation / clock |
| Bootstrap | init script / headers |
| Batch | single-session structured `string[][]` |
| Evidence | run artifacts and diagnostics deltas |

## 4. 不覆盖项

- 不覆盖外部真实站点稳定性。
- 不覆盖真实 Forge/DC 登录；auth provider contract 由 smoke / provider-specific 验证负责。
- 不覆盖 Playwright Test HTML report / UI mode。
- 不把 HAR 热录制当稳定证据路径；稳定证据仍优先 `network` / `diagnostics export` / trace inspect。
- 不作为 benchmark 或评分平台。

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
- 新增场景必须能用真实 `pw` 命令复现，不能只依赖裸 Playwright 脚本。
- 若 dogfood 暴露产品限制，稳定结论写回 `domain-status.md` 或 `failure-recovery.md`；具体任务放 GitHub issue。

---
doc_type: evaluation
slug: workflow-eval-crawler-extraction
status: completed
created: 2026-05-04
tags: [pre-1-0, workflow-evaluation, crawler, extraction, diagnostics, code-escape-hatch]
related_roadmap: pre-1-0-breakthrough
roadmap_item: workflow-eval-crawler-extraction
---

# Workflow Evaluation: Crawler / Extraction

## 范围

本轮验证简单爬取和信息提取 workflow。边界是 Agent-first 本地浏览器事实提取，不恢复旧 `extract` recipe 平台，也不引入 Stagehand 式无边界 `act/extract` API。

覆盖：

- 登录后读取受保护页面。
- 多页导航：Projects → Project Alpha → Incidents → Incident Detail → Reproduce Workspace。
- 低噪声首读：`read-text`、`page assess`。
- 列表计数：`get count`。
- 结构化提取：小段 `pw code` 汇总 DOM 链接、卡片和 iframe 内容。
- API 证据导出：`diagnostics export --section network`。
- 截图和 diagnostics bundle。

## 评估结论

| workflow step | 状态 | 证据 |
|---|---|---|
| fixture bootstrap | pass | `scripts/e2e/dogfood-server.js` 本地 fixture，入口 `http://127.0.0.1:44584` |
| first read | pass | `read-text --max-chars 500` 返回 Projects 列表；`page assess` 给出 medium density、无 frame/form/table 误判 |
| project list extraction | pass | `get count 'a.item'` 返回 2；`pw code` 提取 alpha/beta 两条链接和 href |
| multi-page crawl | pass | 连续点击 `#project-alpha`、`#alpha-incidents`、`#incident-checkout-timeout`、`#open-reproduce` 并逐页 `wait` |
| incident extraction | pass | incidents 页 `get count '.item'` 返回 1；`pw code` 提取 checkout-timeout 文字和 detail href |
| iframe extraction | pass | `page frames` 返回 main + notes-frame；`pw code` 用 `frameLocator` 读取 `frame ready with nested context` |
| API evidence export | pass | `diagnostics export` 输出 `/api/incidents/alpha/checkout-timeout/summary` 请求和 200 响应 body |
| artifact evidence | pass | `crawler-reproduce-main.png` 非空，109523 bytes；bundle manifest 非空，74064 bytes |
| diagnostics | pass | bundle audit 为 `no_strong_failure_signal`，digest 无 console error、page error、failed request、HTTP error |

## focused workflow

最终证据目录：

```text
/tmp/pwcli-workflow-crawler-extraction-GmnLHg
```

关键命令：

```bash
node scripts/e2e/dogfood-server.js 44584

pw session create wfcrawl1 --no-headed --open http://127.0.0.1:44584/login
pw fill -s wfcrawl1 --selector '#email' crawler@example.com
pw click -s wfcrawl1 --selector '#login-submit'
pw wait -s wfcrawl1 --selector '#project-alpha'
pw read-text -s wfcrawl1 --max-chars 500
pw page assess -s wfcrawl1

pw get count -s wfcrawl1 --selector 'a.item' --output json
pw code -s wfcrawl1 'async page => JSON.stringify(await page.locator("a.item").evaluateAll(nodes => nodes.map(a => ({ text: a.textContent?.trim(), href: a.href }))))' --output json

pw click -s wfcrawl1 --selector '#project-alpha'
pw wait -s wfcrawl1 --selector '#alpha-incidents'
pw read-text -s wfcrawl1 --max-chars 500
pw click -s wfcrawl1 --selector '#alpha-incidents'
pw wait -s wfcrawl1 --selector '#incident-checkout-timeout'
pw read-text -s wfcrawl1 --max-chars 800

pw get count -s wfcrawl1 --selector '.item' --output json
pw code -s wfcrawl1 'async page => JSON.stringify(await page.locator(".item").evaluateAll(nodes => nodes.map(node => ({ text: node.textContent?.replace(/\s+/g, " ").trim(), href: node.querySelector("a")?.href || node.href || null }))))' --output json

pw click -s wfcrawl1 --selector '#incident-checkout-timeout'
pw wait -s wfcrawl1 --selector '#open-reproduce'
pw read-text -s wfcrawl1 --max-chars 900
pw click -s wfcrawl1 --selector '#open-reproduce'
pw wait -s wfcrawl1 --selector '#load-summary'
pw read-text -s wfcrawl1 --max-chars 1200
pw page frames -s wfcrawl1 --output json

pw code -s wfcrawl1 'async page => JSON.stringify({ title: await page.title(), cards: await page.locator(".panel h2, .panel h3, .mono").evaluateAll(nodes => nodes.map(n => n.textContent?.replace(/\s+/g," ").trim()).filter(Boolean)), frameNote: await page.frameLocator("#notes-frame").locator("#embedded-note").textContent() })' --output json
pw click -s wfcrawl1 --selector '#load-summary'
pw wait -s wfcrawl1 --text 'summary-result: checkout-timeout / high'
pw verify text -s wfcrawl1 --text 'summary-result: checkout-timeout / high' --output json
pw diagnostics export -s wfcrawl1 --section network --text '/api/incidents/alpha/checkout-timeout/summary' --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out /tmp/pwcli-workflow-crawler-extraction-GmnLHg/network-summary.json --output json
pw screenshot -s wfcrawl1 --selector 'main' --path /tmp/pwcli-workflow-crawler-extraction-GmnLHg/crawler-reproduce-main.png --output json
pw diagnostics bundle -s wfcrawl1 --out /tmp/pwcli-workflow-crawler-extraction-GmnLHg/bundle --output json
pw session close wfcrawl1
```

最终断言：

```text
projects-count: 2
projects-extracted: alpha / checkout platform, beta / unused fixture row
incidents-count: 1
incident-extracted: checkout-timeout with detail href
page-chain: projects -> alpha -> incidents -> checkout-timeout -> reproduce
frame-count: 2
frame-note: frame ready with nested context
summary-verify: pass
network-export: 3 matching records, API response status=200
screenshot-bytes: 109523
bundle-manifest-bytes: 74064
bundle-audit: no_strong_failure_signal
```

## 关键发现

- 现有一等命令足以覆盖简单爬取：`read-text` 做低噪声理解，`get count` 做数量断言，`click/wait` 串联分页，`diagnostics export` 保存接口证据。
- 结构化 DOM 汇总可以用短小 `pw code` 完成，但它只是 escape hatch。长流程仍应拆成一等命令，避免把 `pw code` 扩成第二套 workflow runner。
- iframe 内容不是 `read-text` 主链覆盖对象；正确路径是先 `page frames` 识别 frame，再用 `pw code` + `frameLocator()` 做小范围读取。
- `diagnostics export --text` 会匹配 URL 和响应片段，因此本轮导出的 3 条记录中包含 reproduce HTML，因为页面源码里出现了目标 API 字符串；Agent 需要用 URL/status/snippet 继续筛选高信号记录。
- `scripts/test/extract-*` 中出现的旧 `extract` 相关测试不是当前 shipped command surface 的 1.0 入口。本轮不恢复该命令，后续仓库清理或 truth audit 应继续判定这些历史资产是否保留。

## 验证

```bash
pnpm build
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-breakthrough-items.yaml
python codestable/tools/validate-yaml.py --file codestable/roadmap/pre-1-0-breakthrough/pre-1-0-command-evaluation-matrix.yaml
pnpm check:skill
git diff --check
```

结果：通过。

## 后续

- `workflow-eval-deep-bug-reproduction` 继续验证失败复现、console/network/errors、failureKind 和 bundle handoff。
- `codestable-truth-1-0-audit` 或仓库清理后续循环需要处理旧 `extract` 测试和 eval 资产是否仍有维护入口。

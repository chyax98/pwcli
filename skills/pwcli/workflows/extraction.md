# Extraction Workflow

目标：把当前页面上的结构化内容导出成稳定 artifact，而不是停留在一次性 `pw code`。

边界：

```text
pwcli 负责采集
Agent 负责理解和还原
```

## 适用场景

- 列表页首屏结构化提取
- 文章/文档容器提取
- 想把提取流程固化成可重复 recipe
- 多页列表提取
- load-more / 虚拟列表式滚动补齐
- 导出 CSV / Markdown / JSON artifact

## 最短闭环

```bash
pw page assess --session bug-a
pw read-text --session bug-a --max-chars 2000
pw snapshot -i --session bug-a
pw extract run --session bug-a --recipe ./recipe.json --out ./artifact.json
pw diagnostics digest --session bug-a
```

## 什么时候用 `pw extract run`

用在：

- recipe 可结构化表达
- 只读提取
- 需要稳定 artifact
- 需要原始文档结构而不是最终重写结果

不要用在：

- 任意 JS 试探
- 页面 patch / preload hook
- 复杂站点临时调试

这些场景分别退回：

- `pw code`
- `pw bootstrap apply --init-script`

## recipe 起手式

列表：

```json
{
  "kind": "list",
  "itemSelector": ".post-card",
  "companionSelector": ".post-card-meta",
  "excludeSelectors": [".sponsored", ".sidebar"],
  "fields": {
    "title": "h2 a",
    "url": { "selector": "h2 a", "attr": "href" },
    "summary": ".summary",
    "publishedAt": { "selector": "time", "source": "companion" }
  }
}
```

多页列表：

```json
{
  "kind": "list",
  "itemSelector": ".post-card",
  "fields": {
    "title": "h2 a",
    "url": { "selector": "h2 a", "attr": "href" }
  },
  "pagination": {
    "mode": "next-page",
    "selector": "a.next",
    "maxPages": 3
  }
}
```

load-more + scroll：

```json
{
  "kind": "list",
  "itemSelector": ".feed-item",
  "fields": {
    "title": ".title",
    "url": { "selector": "a", "attr": "href" }
  },
  "pagination": {
    "mode": "load-more",
    "selector": "button.load-more",
    "maxPages": 3
  },
  "scroll": {
    "mode": "until-stable",
    "stepPx": 1200,
    "settleMs": 250,
    "maxSteps": 5
  },
  "output": {
    "format": "markdown"
  }
}
```

## 导出规则

- stdout 始终是 JSON envelope
- `--out` 决定 artifact 文件
- `output.format = "json"`：写完整 JSON payload
- `output.format = "csv"`：写 CSV 文本
- `output.format = "markdown"`：写 Markdown 表格

## 原始结构输出

`extract run` 现在不仅返回 `items[]`，也返回：

- `document.blocks[]`
- `document.media[]`

用途：

- `items[]`：字段化提取结果
- `document.blocks[]`：按 DOM 顺序给 Agent 原始内容块
- `document.media[]`：聚合图片/视频引用

Agent 基于这些原始结果自行还原：

- Markdown
- 报告
- 文章
- 摘要

real-site dogfood 用这条 workflow 压稳定性即可；不要把真实站点跑法混进 deterministic regression gate。

## 明确限制

- 只读提取
- 所有分页/滚动都必须是 bounded
- 不支持 URL template / cursor/API pagination
- 不支持 site marketplace
- 不支持把 `extract run` 当成任意脚本平台
- same-origin iframe 支持
- cross-origin iframe 不深采，只会返回 limitation

文章：

```json
{
  "kind": "article",
  "containerSelector": "article[data-kind='doc']",
  "excludeSelectors": [".toc", ".navbox", ".metadata"],
  "fields": {
    "title": "h1",
    "body": ".lede"
  }
}
```

Wikipedia 长文章起手式：

```bash
pw extract run --session wiki-a \
  --recipe ./benchmark/tasks/real-sites/recipes/wikipedia-article-document.json \
  --out ./wikipedia-article.json
```

说明：

- 这个模板通过 `excludeSelectors` 主动跳过 infobox / TOC / navbox / edit controls 等噪声块
- 适合 long-article dogfood，不代表所有 article 页都应共享同一组排除规则

GitHub issue / PR 详情页起手式：

```bash
pw extract run --session gh-a \
  --recipe ./benchmark/tasks/real-sites/recipes/github-discussion-document.json \
  --out ./github-discussion.json
```

说明：

- 这是 public GitHub issue/PR 详情页的起手模板
- 目标是把 `main` 里的原始讨论内容稳定采出来
- 如果页面结构不匹配，复制 recipe 到本地修改，不要直接把临时站点细节写回内置模板

Hacker News 列表页起手式：

```bash
pw extract run --session hn-a \
  --recipe ./benchmark/tasks/real-sites/recipes/hacker-news-list.json \
  --out ./hacker-news.json
```

说明：

- 这个模板依赖 `companionSelector`
- 用来读取 title row 后面的 metadata row
- 这是 real-site dogfood 资产，不是内置产品模板

## 失败时怎么收缩

如果 `extract run` 失败，先回退到：

```bash
pw page current --session bug-a
pw read-text --session bug-a --max-chars 2000
pw snapshot -i --session bug-a
```

然后再判断是：

- recipe 错了
- 页面没落到预期内容
- 这个任务其实应该走 `pw code`

# Extraction Workflow

目标：把当前页面上的结构化内容导出成稳定 artifact，而不是停留在一次性 `pw code`。

## 适用场景

- 列表页首屏结构化提取
- 文章/文档容器提取
- 想把提取流程固化成可重复 recipe

## 最短闭环

```bash
pw page assess --session bug-a
pw read-text --session bug-a --max-chars 2000
pw snapshot -i --session bug-a
pw extract run --session bug-a --recipe ./recipe.json --out ./artifact.json
```

## 什么时候用 `pw extract run`

用在：

- recipe 可结构化表达
- 只读提取
- 需要稳定 artifact

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
  "fields": {
    "title": "h2 a",
    "url": { "selector": "h2 a", "attr": "href" },
    "summary": ".summary"
  }
}
```

文章：

```json
{
  "kind": "article",
  "containerSelector": "article[data-kind='doc']",
  "fields": {
    "title": "h1",
    "body": ".lede"
  }
}
```

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

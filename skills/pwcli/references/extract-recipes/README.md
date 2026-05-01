# Bundled Extract Recipes

这些 recipe 是 `pw extract run` 的起手模板，不是站点级强契约。

当前内置：

- `github-issues-list`
- `github-prs-list`
- `table-rows`

使用：

```bash
pw extract recipes
pw extract recipe-path github-issues-list
pw extract run --session bug-a --recipe "$(pw extract recipe-path github-issues-list --output json | jq -r '.data.path')"
```

原则：

- 这些 recipe 只是模板
- 真正运行前，先用 `pw page assess` / `pw read-text` / `pw snapshot -i` 确认页面结构
- 如果页面结构不匹配，复制模板到本地再改，不要把临时站点细节直接写回内置 recipe

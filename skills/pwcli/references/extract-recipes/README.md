# Bundled Extract Recipes

这些 recipe 是 `pw extract run` 的**通用起手模板**，不是站点级强契约。

当前内置：

- `table-rows`

使用：

```bash
pw extract recipes
pw extract recipe-path table-rows
pw extract run --session bug-a --recipe "$(pw extract recipe-path table-rows --output json | jq -r '.data.path')"
```

原则：

- 内置 recipe 只保留通用模板
- 站点型 recipe 不再作为 bundled product surface 暴露
- real-site dogfood recipe 统一放在 `benchmark/tasks/real-sites/recipes/`
- 真正运行前，先用 `pw page assess` / `pw read-text` / `pw snapshot -i` 确认页面结构
- 如果页面结构不匹配，复制通用模板或 dogfood recipe 到本地再改，不要把临时站点细节写回内置面

# Benchmark Fixtures

`benchmark/fixtures/` 只放 deterministic benchmark fixture 资产。

## 归属

fixture 是 benchmark 的 substrate，不是 `pwcli` shipped 功能的一部分。

这里后续允许放：

- 本地 demo 页面
- mock API
- seed data
- fixture lifecycle scripts

这里不应该放：

- 真实站点抓取结果
- 用户敏感 state
- 通用教程文档

## 确定性规则

- fixture 页面必须稳定、可重复
- 输出 marker 必须固定，便于 `successCriteria` 判断
- 不依赖外部互联网
- 不依赖本机真实登录态
- 优先支持 CI / smoke

## 未来目录建议

```text
benchmark/fixtures/
  apps/
  data/
  scripts/
```

## 和 real-site benchmark 的关系

- `fixtures/` 用于日常 gate 和 deterministic contract 验证
- real-site benchmark 另走 `benchmark/tasks/real-sites/`，不把波动站点混入本地 fixture 面

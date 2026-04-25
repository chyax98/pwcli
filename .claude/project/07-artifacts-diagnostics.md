# Artifacts And Diagnostics

更新时间：2026-04-25
状态：active

当前 `pwcli` 的 artifact / diagnostics 还是薄层。真相只有已经落地的这部分。

## 1. 当前真实 artifact

已落地：

- `screenshot --path <file>`
- `download --path <file>`
- `state save <file>`
- `trace start`
- `trace stop`
- `skill install <dir>`

当前行为：

- `screenshot` 没传 `--path` 时不会建立项目级默认目录 contract
- `download` 没传 `--path` 时只返回下载元信息
- `trace start/stop` 当前只暴露动作结果，没有稳定的 trace 文件路径输出
- `state save/load` 完全由用户显式路径驱动

## 2. 当前 diagnostics

### console

`pw console` 当前输出：

```json
{
  "summary": {
    "total": 0,
    "errors": 0,
    "warnings": 0,
    "sample": []
  }
}
```

它来自 Playwright CLI 结果文本解析，不是项目层自建缓存。

### network

`pw network` 当前输出：

```json
{
  "summary": {
    "total": 0,
    "sample": []
  }
}
```

同样只是解析 CLI 结果文本。

## 3. 当前没有的 artifact / diagnostics

以下都不要再写成现有能力：

- 默认 `.pwcli/artifacts/<runId>/`
- `session-log.jsonl`
- HAR 自动落盘
- perf 产物
- video / screencast
- artifact index / search
- 动作后自动附带 console/network diagnostics
- 项目层长期 console/network ring buffer

## 4. 当前实现边界

当前项目层做的事只有：

- 把 CLI / Playwright 输出转成更稳一点的 JSON
- 把部分结果整理成 `summary`
- 在少数命令里回传路径、URL、文件名

当前项目层没做：

- 可检索 artifact 管理
- 跨命令 run 关联
- 诊断面默认开启与默认采样

## 5. 文档口径

当前 README 和 project docs 只能说：

- 支持显式截图、显式下载、显式 state save/load、trace start/stop
- `console` / `network` 提供结构化摘要

不能说：

- 默认会记录整次运行生命周期
- 默认会落盘所有诊断证据
- 已有完整 artifact run 目录模型

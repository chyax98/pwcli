# Migration Roadmap

更新时间：2026-04-25
状态：draft

本项目没有版本切分，按完整产品一次性构建。
实现顺序只表示依赖顺序，不表示功能等级。

## 施工顺序

1. 工具链与项目规范
2. runtime/session/artifact 基础层
3. `pw code`
4. `open` 与最小 session 复用
5. diagnostics / artifact 落盘
6. 页面探索命令
7. 基础动作命令
8. 环境控制与证据命令
9. 登录插件与 profile/state 模型
10. skill 分发与最终 dogfood

## 当前重点

- 把 `pw code` 变成一级能力
- 建立最小 session truth
- 建立 artifact run 目录
- 定义 diagnostics 最小 contract

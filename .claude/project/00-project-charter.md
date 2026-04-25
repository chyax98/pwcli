# Project Charter

更新时间：2026-04-25
状态：draft

## 推荐命名

项目名：`pwcli`
CLI 名：`pw`

理由：
- 短。
- 直接暴露底座是 Playwright。
- 不绑 Forge 项目名。
- CLI 名足够短，适合内部高频使用。
- 项目名和 CLI 名分开后，仓库/package 语义更清楚。
- 不会把项目伪装成通用浏览器平台。

不推荐：
- `forge-browser`
  - 绑死单一项目。
  - 名字太宽，容易让人继续把产品面做大。
- `playwright-cli`
  - 和官方项目认知冲突。
- 任何带 `cloud`、`studio`、`platform`、`engine` 的名字
  - 会诱导错误的产品心智。

## 一句话定义

`pwcli` 是一个面向内部自用的、agent-first 的 Playwright 编排 CLI，默认命令名是 `pw`。

它的职责只有五件事：
- 管理浏览器 / session / profile / state 的复用。
- 把 Playwright Core 的原生能力组织成稳定的命令工作流。
- 默认打开并收口诊断与证据。
- 提供直接执行 Playwright 代码的一级能力。
- 通过 skill 和少量登录插件降低 Agent 使用门槛。

## 产品宗旨

第一原则：

**Playwright Core native-first，项目层只做编排、诊断、检索、分发。**

展开：
- 能直接复用 Playwright Core 公共能力，就直接复用。
- 编排层负责把多个原生能力组织成可重复、可观测、可落盘的工作流。
- 自研层只允许出现在 agent contract、artifact indexing、diagnostics summary、skill distribution、项目登录接入这几个点。
- 项目层不能为了“统一协议”去重写 Playwright 已解决的定位、动作、等待、frame、dialog、download、storageState、trace、video、route 原语。

## 主要使用者

- Claude / Codex / Cursor / Copilot 这类 coding agent
- 内部 QA / 开发 / 调试人员

## 主场景

1. 打开页面并快速理解当前状态。
2. 在已登录页面上复现问题。
3. 连接已有浏览器继续排查。
4. 通过 profile / session / state 复用登录态。
5. 直接运行 Playwright 代码处理复杂场景。
6. 执行动作后立即看到 console / network / page-level 异常。
7. 自动落盘 trace / screenshot / session log / HAR / perf 等证据。
8. 对运行日志和证据做检索、搜索、关联。
9. 用少量插件完成项目登录。
10. 用 skill 把这套工作流分发给 Agent。

## 非目标

- 通用浏览器平台。
- 面向外部用户的公共产品。
- 自建 DevTools 替代品。
- 自建浏览器动作执行引擎。
- 自建元素定位系统。
- 自建多协议插件市场。

## 层级边界

L0：Playwright Core
- browser/context/page/locator/frame/dialog/download/route/trace/storageState/connect/codegen/video

L1：项目编排层
- CLI
- session / profile / state / connect orchestration
- batch workflow
- artifact 路径与落盘
- diagnostics summary
- search / index / retrieval

L2：项目接入层
- 登录插件
- 少量项目 bootstrap

L3：Agent 分发层
- skill 文档
- skill install
- 命令使用路由

## 一等公民能力

这些能力必须继续存在：
- `skill` 分发与安装
- session / profile / state 复用
- connect 既有浏览器
- 直接执行 Playwright 代码
- diagnostics 默认回传
- trace / screenshot / session log / HAR / perf 等证据链
- 项目登录插件

## 设计口径

默认口径：
- 动作：走 Playwright `locator/page/context` 原生能力
- 诊断：走 Playwright 事件与 artifact，项目层只做收口与展示
- 证据：默认落盘，命令返回路径与摘要
- 复杂场景：直接运行 Playwright 代码
- 登录：优先插件；若插件成本过高，可接受极薄的项目接入层

## 重构方向

后续重构按下面的顺序执行：
- 先收口 use case 和能力边界
- 再决定哪些命令直接映射 Playwright Core
- 再决定哪些能力只是编排层
- 最后才讨论例外层和必要自研

# Project Truth

更新时间：2026-04-25
状态：active

## 我们到底在构建什么

`pwcli` 是给 Agent 长眼睛、长手、长记忆的内部浏览器工具。

它不是通用浏览器平台。
它不是 DevTools 替代品。
它不是测试框架。

它是一个面向 Agent 的、围绕真实页面工作流构建的 Playwright 编排壳。

## 最核心的使用场景

### 1. 先进入目标状态

入口可以是：
- `open`
- `open --profile`
- `state load`
- `auth <plugin>`
- `code ...`

目标：
- 打开页面
- 或登录
- 或恢复 profile/state
- 或执行一段 Playwright code 把页面推进到目标状态

### 2. 进入 Agent 闭环

默认闭环：

```text
wait -> snapshot -> decide -> action -> wait -> snapshot -> decide
```

也可以是：

```text
read-text -> decide -> action -> wait -> read-text
```

### 3. 记录整个生命周期

Agent 在执行过程中，需要持续拿到：
- 当前页面
- 快照
- 文本
- console
- network
- state/profile 复用点
- artifact

这些信息主要给 Agent 看，不是给人看。

## 默认 workflow

当前真相：
- 默认只要求稳定支持一套 `default managed browser`
- session 能力存在，但默认对 Agent 下沉
- Agent 不需要先理解复杂 session 概念

默认体验应该是：

```text
pw open ...
pw wait ...
pw snapshot
pw click ...
pw wait ...
pw read-text
```

## 登录模型

登录不是单一命令，而是一组入口：

1. profile / state 复用
2. plugin auth
3. auth 后再跑 code

目标是：
- 登录后直接进入目标页面
- 然后立刻进入 `wait -> snapshot -> action` 闭环

## 设计原则

### 原则 1：默认复用 Playwright

只要 Playwright Core 或 Playwright CLI 内部能力能覆盖，就直接用。

### 原则 2：项目层只做拼装

项目层的价值在于：
- 语义化命令
- 生命周期管理
- diagnostics 收口
- artifact 落盘
- skill 分发
- 登录插件

### 原则 3：不要给 Agent 增加心智负担

如果一个能力让 Agent 需要先理解复杂状态机，这个设计就是失败的。

### 原则 4：不要浪费 token

默认输出必须克制：
- 只返回当前命令真正有用的结果
- 不需要的长原文不要默认返回

## 当前明确采用

- AI snapshot ref：`page.ariaSnapshot({ mode: "ai" })`
- ref action：`aria-ref=...`
- managed session substrate：Playwright CLI 内部 session/registry
- default managed browser 优先
- profile/state/plugin 作为登录与复用入口

## 当前明确不做

- 自建 ref 协议
- 自建动作 substrate
- 自建复杂 session 协议
- 自动化 E2E case
- 为“以后可能有问题”做重抽象

# Layering Rules

更新时间：2026-04-25
状态：draft

## 目标

把 `pwcli` 控制在清晰、可维护、可删除的结构里。

这里的分层不是为了秀工程，也不是为了制造文件数量。
分层的唯一目的，是让每一层的职责单一、边界明确、错误更容易被发现。

## 总原则

每一层都必须回答两件事：

1. 为什么要有这一层？
2. 这一层解决的目的是什么？

如果回答不清楚，这一层就不应该存在。

## 四层结构

### 1. Command Layer

为什么要有：
- CLI 一定需要参数解析和命令路由。
- 这层负责把用户输入变成内部调用。

目的：
- 保持命令面清晰。
- 让命令定义和实现入口集中。
- 不让命令文件长成业务逻辑容器。

允许：
- commander 定义
- 参数校验
- 输出 envelope
- 调用 runtime/orchestrator

禁止：
- 直接写 Playwright 细节
- 自己维护 session/page truth
- 混入 artifact 管理

### 2. Runtime / Orchestration Layer

为什么要有：
- 项目的真正差异化在编排，不在浏览器 primitive。
- session / page / state / diagnostics / artifact truth 必须有集中位置。

目的：
- 组织 Playwright 能力
- 收口状态 truth
- 组织 artifact 和 diagnostics

允许：
- session/profile/state/connect truth
- artifact run 管理
- diagnostics cache 与 summary
- 多步流程组织

禁止：
- 自建浏览器原语
- 重写 locator / page / context 行为

### 3. Playwright Adapter Layer

为什么要有：
- 需要一个明确边界，告诉团队哪些地方是在直接调用 Playwright。
- 避免命令层和项目编排层到处散落原生调用。

目的：
- 薄封装 Playwright 公共 API
- 让上游升级和替换风险集中

允许：
- 直接调用 Playwright Core 公共 API
- 少量参数转换
- 极薄错误翻译

禁止：
- 包装成第二套 DSL
- 发明第二套元素/动作模型
- 大面积依赖 `playwright-core/lib/...`

### 4. Plugin / Skill Layer

为什么要有：
- 登录与项目私有接入不应污染通用 runtime。
- Agent 分发需要独立 contract surface。

目的：
- 插件负责项目登录和少量 bootstrap
- skill 负责 Agent 使用路径

允许：
- 登录逻辑
- 项目 bootstrap
- skill install / skill docs

禁止：
- 承载通用动作执行
- 承载通用 diagnostics
- 演化成第二套 runtime

## 文档要求

每新增一个重要模块，都要在对应设计记录里写：
- 为什么需要它
- 它的职责边界
- 它不负责什么

## 反模式

以下信号出现时，说明架构开始变杂：

- 一个文件同时管 command + runtime + artifact
- 同一个能力在两层重复实现
- 为统一而统一的 facade
- 大量无收益的小 class
- 一层只是把另一层原样转发
- 私有协议开始主导原生能力

## 当前执行要求

任何后续能力迁移，都要先标注落在哪一层。


# Private Layer Review Gate

更新时间：2026-04-25
状态：hard-rule

## 总原则

任何新增私有层，都必须先证明：

1. Playwright Core 公共能力无法直接覆盖。
2. 现有命令组合无法解决。
3. 直接执行 Playwright 代码无法解决。
4. 组合现有逻辑后仍然存在稳定性、性能、协议或安全缺口。

只要上面四条里有一条无法证明，禁止自研。

## 审查前置问题

提交设计前必须回答：

1. 你要解决的精确 use case 是什么？
2. 对应的 Playwright 公共 API 是什么？
3. 为什么这些 API 直接组合后仍然不够？
4. 现有命令或 run-code 为什么不能解决？
5. 新私有层的输入、输出、状态边界是什么？
6. 它会带来哪些长期维护成本？
7. 它的退出条件是什么？

## 必要证据

没有下面这些证据，不允许加私有层：
- 最小复现
- Playwright 原生尝试方案
- 原生方案失败原因
- 当前项目层组合方案失败原因
- 预期 contract
- 影响范围

## 允许的私有层类型

允许：
- artifact index / search
- diagnostics summary
- session/page/artifact truth
- skill distribution
- 项目登录插件
- 极薄的命令编排层

条件允许：
- 对 Playwright 公共能力的少量补口
- 少量项目 bootstrap helper
- 极少数必须存在的 fallback parser

默认禁止：
- 自定义 locator engine
- 自定义 AX tree 主路径
- 自定义动作执行引擎
- 自定义 frame 遍历引擎
- 大量依赖 `playwright-core/lib/...` 私有实现的主路径

## 内部模块依赖规则

默认只能依赖：
- `playwright-core` 公共 API
- 项目现有稳定 contract

如果必须依赖 Playwright 内部模块，必须额外回答：
- 为什么没有公共 API？
- 为什么不能延后做？
- 版本漂移怎么处理？
- 一旦上游提供公共 API，如何迁出？

## 审查结论类型

通过：
- 有明确空白点
- 私有层很薄
- 对上游能力是补口，不是重写

有条件通过：
- 仅限实验或诊断
- 不进入主路径
- 需要写清退出计划

拒绝：
- 为了统一协议而重写原生能力
- 为了“更可控”而重写原生能力
- 为了“看起来更 agent-friendly”而引入大私有层
- 现有能力组合已足够

## 强制语言

设计评审里必须明确写出一句：

`该私有层不能被现有 Playwright 公共能力、现有命令编排、或直接执行 Playwright 代码替代。`

如果写不出这句并给出证据，禁止进入实现。

## 当前已知高风险区

这些区域以后加逻辑必须默认高压审查：
- 元素定位
- 动作执行
- frame / popup / dialog 目标恢复
- codegen / recorder / trace internal API
- 登录状态模型


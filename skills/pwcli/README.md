# pwcli Skill

这是随 `pwcli` 包一起分发给 Agent 的 skill 目录。

## 目录职责

- `SKILL.md`
  - 给 agent 的主入口说明
  - 定义稳定使用路径
- `references/command-reference.md`
  - 当前 shipped command surface
  - 当前稳定参数和限制
- `references/workflows.md`
  - 模型可直接套用的调查 / 自动化工作流
- `references/failure-recovery.md`
  - 常见错误、limitation 和恢复路径
- `rules/`
  - 项目级规则、补充约束
- `agents/openai.yaml`
  - skill 列表和默认 prompt 所需的 UI 元数据

## 维护规则

- 以 `src/app/commands/*` 和 `node dist/cli.js --help` 为准
- 命令、flag、输出 envelope 变化后，同步更新本目录
- 只写已落地 contract
- 不写未来设计
- 不从历史草案里拷贝命令面

## 当前定位

这套 skill 面向 agent。

优先内容：

- 唯一命令路径
- 明确参数
- 稳定 JSON 输出
- 明确限制与恢复建议
- 工作流顺序和决策树

低优先级内容：

- 面向人类的教程式描述
- 多套等价用法
- 未来能力占位

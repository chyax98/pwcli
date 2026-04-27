# pwcli Skill

这是随 `pwcli` 包一起分发给 Agent 的 skill 目录。

## 目录职责

- `SKILL.md`
  - Agent 真正读取的主教程
  - 放高频核心流程、能力分类、最佳命令和禁止事项
  - 工具类 skill 不追求短路由表，优先保证只读主文档也能执行
- `references/command-reference.md`
  - 当前 shipped command surface
  - 当前稳定参数和限制
- `workflows/`
  - 低频或展开版专项流程
  - 不承载首次决策所需的核心规则
- `references/workflows.md`
  - 旧引用兼容索引，新内容写到 `workflows/`
- `references/forge-dc-auth.md`
  - Forge / DC / `dc2.0` 登录细节、失败分支
- `references/failure-recovery.md`
  - 常见错误、limitation 和恢复路径
- `rules/`
  - 主教程的规则摘要和补充约束
- `agents/openai.yaml`
  - skill 列表和默认 prompt 所需的 UI 元数据

## 维护规则

- 以 `src/app/commands/*` 和 `node dist/cli.js --help` 为准
- 命令、flag、输出模式或 JSON envelope 变化后，同步更新本目录
- 高频命令策略变化后，先同步 `SKILL.md`
- 只写已落地 contract
- 不写未来设计
- 不从历史草案里拷贝命令面
- 子文档不写触发条件；skill 触发只由 frontmatter 决定
- 主文档不能只做目录，核心流程必须内联

## 当前定位

这套 skill 面向 agent。

这是 `pwcli` 的唯一使用教程真相。

架构、限制和扩展方向单独维护在：

- [docs/architecture/README.md](../../docs/architecture/README.md)

优先内容：

- 唯一命令路径
- 明确参数
- 主文档充分教程
- 默认 text 输出和稳定 `--output json` 输出
- 明确限制与恢复建议
- 工作流顺序和决策树

低优先级内容：

- 面向人类的教程式描述
- 多套等价用法
- 未来能力占位
- 为了短而拆空主文档

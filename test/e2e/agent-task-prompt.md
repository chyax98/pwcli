# pwcli Agent Task

你正在验证 `pwcli` 的真实可用性。

必须先加载并遵守这个 skill：

`skills/pwcli/SKILL.md`

任务目标：

1. 打开 dogfood 系统登录页。
2. 完成登录。
3. 进入 checkout timeout reproduce 页面。
4. 读取页面状态，确认故障复现入口存在。
5. 触发一次失败复现。
6. 收集足够的诊断证据，能解释失败发生在哪里。
7. 产出结构化总结。

输出要求：

- 只写一个 JSON 文件到环境变量 `PWCLI_AGENT_OUTPUT` 指向的路径。
- JSON 必须包含：
  - `status`: `"passed"` 或 `"failed"`
  - `task`
  - `skillPath`
  - `stepCount`
  - `steps`: 数组，每项至少有 `command` 或 `action`
  - `tokenUsage`: number 或 null
  - `result`: 对任务结果的简短总结
  - `evidence`: 数组，列出关键命令、文件或诊断结论

环境变量：

- `PWCLI_AGENT_TARGET_URL`
- `PWCLI_AGENT_SKILL_PATH`
- `PWCLI_AGENT_OUTPUT`

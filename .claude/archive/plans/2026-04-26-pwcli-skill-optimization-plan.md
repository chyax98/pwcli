# pwcli Skill Optimization Plan

目标：把 `skills/pwcli/` 收成一份真正给模型使用的操作手册。它要教会模型何时用 `pw`、按什么顺序用、何时停、何时恢复、何时升级到 `pw code`。

## 范围

只改 skill 面：

1. `skills/pwcli/SKILL.md`
2. `skills/pwcli/references/command-reference.md`
3. `skills/pwcli/references/workflows.md`
4. `skills/pwcli/references/failure-recovery.md`
5. `skills/pwcli/rules/core-usage.md`
6. `skills/pwcli/agents/openai.yaml`
7. `skills/pwcli/README.md`

不改产品代码、不改命令语义。

## 设计要求

### 1. 主文件负责决策

`SKILL.md` 必须回答：
- 什么时候触发 `pwcli`
- 什么时候先 `session create`，什么时候 `session attach`
- 什么时候先读，什么时候先 mock，什么时候先 environment
- 什么时候用 `pw code`
- 什么时候停止并报告 limitation

### 2. references 负责深细节

- `command-reference.md`：只放 shipped surface、flags、稳定输出和关键限制
- `workflows.md`：放真实 agent playbooks
- `failure-recovery.md`：放错误码和恢复顺序

### 3. rules 负责硬约束

`core-usage.md` 只写硬规则：
- strict session-first
- JSON batch only
- diagnostics/query/export 优先
- mock/environment 的使用边界
- limitation code 的处理原则

### 4. 元数据负责正确触发

`agents/openai.yaml` 要把 skill 明确定位为：
- bug reproduction
- diagnostics collection
- deterministic browser automation
- request mocking
- environment mutation

## 内容补强点

1. 补一条完整的 bug workflow：
   - create
   - inspect
   - act
   - query diagnostics
   - export
2. 补 deterministic fixture + file-backed mock workflow
3. 补 modal blockage workflow
4. 补 auth/state reuse workflow
5. 补 environment workflow
6. 补 batch file / stdin workflow
7. 明确写出不要做的事：
   - 不猜默认 session
   - 不继续使用已删命令
   - 不把 `page dialogs` 当 live truth
   - 不把 `clock set` 写成稳定能力
   - 不把 `HAR` 热录制和 observe stream 写成已支持

## 验收

1. `SKILL.md` 单独就能指导模型启动任务
2. 引导路径覆盖 read -> act -> diagnose -> reproduce -> recover
3. references 和 rules 不重复堆砌
4. 内容和 `dist/cli.js --help`、当前 truth 文档一致
5. 变更后跑最小验证：
   - `node dist/cli.js --help`
   - `node dist/cli.js diagnostics --help`
   - `node dist/cli.js environment --help`

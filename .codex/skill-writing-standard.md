# pwcli Skill Writing Standard

目标：让 Agent 只读 `skills/pwcli/SKILL.md` 就能稳定完成高频任务；需要精确参数时再跳到 reference。不要把 skill 写成散乱命令百科。

## 1. 文档分层

| 文件 | 放什么 | 不放什么 |
|---|---|---|
| `skills/pwcli/SKILL.md` | 高频主路、决策规则、硬限制、最短可执行模板 | 全量参数表、历史背景、未来计划 |
| `skills/pwcli/references/command-reference.md` | lifecycle、页面读取、动作、等待的完整 shipped command surface | 诊断、auth、batch 深细节 |
| `skills/pwcli/references/command-reference-diagnostics.md` | diagnostics、console、network、errors、route、trace/HAR | 普通页面动作教程 |
| `skills/pwcli/references/command-reference-advanced.md` | state、auth、batch、environment、bootstrap、code | bug 诊断流程 |
| `skills/pwcli/references/failure-recovery.md` | error code、blocked state、恢复升级路径 | 成功路径教程 |
| `skills/pwcli/references/workflows.md` 和 `skills/pwcli/workflows/*.md` | 场景链路：探索、诊断、受控测试 | 参数百科 |
| `skills/pwcli/references/forge-dc-auth.md` | Forge/DC provider 使用和失败分支 | 通用 auth 架构设计 |

## 2. 主文档质量线

`SKILL.md` 必须满足：

1. 开头 40 行内说清楚：
   - 什么时候创建 session
   - 什么时候复用 session
   - `open` / `auth` / `batch` 的边界
   - stdout 默认给 Agent 读，脚本解析才用 `--output json`
2. 所有示例必须可复制执行，且浏览器命令显式带 `--session <name>`。
3. 高频路径必须给完整闭环：
   - 探索：create -> observe/read-text/snapshot
   - 动作：click/fill -> wait -> read/diagnostics
   - bug：clear baseline -> reproduce -> digest -> console/network/errors
   - auth：create -> auth provider -> read/state
   - controlled testing：route/environment/bootstrap -> action -> assertion
4. 每个 limitation 必须写成：
   - 触发条件
   - 表现或错误码
   - 首选恢复路径
   - fallback
5. 主文档允许重复最关键命令，禁止重复完整参数表。

## 3. Reference 质量线

command reference 必须满足：

1. 只写当前 shipped contract。
2. 每个命令写：
   - 命令形态
   - 稳定 flag
   - 输出/副作用
   - 当前限制
3. 参数以 `src/app/commands/*` 和 `node dist/cli.js --help` 为准。
4. 删除命令时必须从所有 reference 和 workflow 移除。
5. 新增 limitation 时，reference 可以短写，完整恢复路径必须进 `failure-recovery.md`。

## 4. Workflow 质量线

workflow 必须是任务链路，不是教程散文。

每条 workflow 必须包含：

1. 适用场景。
2. 命令序列。
3. 成功判据。
4. 失败时跳转到哪个 recovery 文档。

禁止：

- 写“可以考虑”“也许使用”这种无决策价值文本。
- 给多个等价主路。
- 把 future design 写成当前用法。

## 5. 修改检查单

改 skill 前后都跑这张表：

| 检查项 | 命令 / 动作 |
|---|---|
| 命令是否存在 | `pnpm build && node dist/cli.js --help` |
| 子命令参数是否存在 | `node dist/cli.js <cmd> --help` 或读 `src/app/commands/<cmd>.ts` |
| 示例是否带 session | 搜索新增示例中的 `pw ` 命令 |
| JSON 说法是否准确 | 检查是否只把 `--output json` 用于脚本解析 |
| limitation 是否有恢复路径 | 检查 `failure-recovery.md` |
| workflow 是否重复教程 | 检查是否能删成命令链和判据 |

## 6. 坏味道

出现下面情况就必须重写：

- 主文档只剩目录，Agent 第一次读完仍不知道下一条命令。
- README、docs、skill 同时维护同一套使用教程。
- limitation 被写成“已支持”。
- 示例不带 `--session`。
- auth 被写成会创建 session。
- open 被写成会创建或改变 browser shape。
- batch 被写成支持完整 CLI parity。
- reference 里有源码不存在的命令或 flag。

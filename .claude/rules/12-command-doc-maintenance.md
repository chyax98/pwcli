# Command Documentation Maintenance

状态：active

## 核心原则

`codestable/architecture/commands/` 是命令设计决策的唯一真相（ADR）。
`skills/pwcli/` 是使用教程的唯一真相。
两者不重复，各司其职。

## 强制维护规则

**任何触碰命令的改动，必须同步更新对应的 `codestable/architecture/commands/<command>.md`：**

| 改动类型 | 必须更新 |
|---|---|
| 新增命令或子命令 | 新建对应 codestable/architecture/commands/ 文件 |
| 删除命令或子命令 | 在文档里注明删除原因和日期 |
| 修改 flag / 参数 | 更新"技术原理"和"已知限制"章节 |
| 修改错误码 | 更新"已知限制"章节 |
| benchmark / Agent dogfood 新证据 | 更新"使用证据"和状态标记 |
| 发现新 limitation | 更新"已知限制" |

## 文件结构

```
codestable/architecture/commands/
  _template.md         ← 新命令参照此模板
  session.md           ← pw session create|attach|recreate|close|list
  snapshot.md          ← pw snapshot
  click.md             ← pw click（代表所有元素操作命令）
  observe.md           ← pw observe / pw status
  auth.md              ← pw auth run|probe|list
  ...（每个命令族一个文件）
```

## 状态标记

每个命令文档必须有明确的状态：

- `proven`：benchmark、基础回归或真实 Agent dogfood 端到端验证过，可信赖
- `documented`：skill 有记录，但无 benchmark 证据，谨慎使用
- `experimental`：代码存在，无 skill 也无 benchmark 记录，可能不工作

`experimental` 的命令：
- 代码保留但在 --help 里加 `[experimental]` 标注
- 不进入主 skill 文档
- 有证据后升级为 `documented` 或 `proven`

## 和 skills/pwcli/ 的分工

| 问题 | 去哪里找 |
|---|---|
| 怎么用这个命令？ | `skills/pwcli/` |
| 为什么这样设计？ | `codestable/architecture/commands/` |
| 这个命令可靠吗？ | `codestable/architecture/commands/` 的"使用证据"章节 |
| 失败了怎么恢复？ | `skills/pwcli/references/failure-recovery.md` |

## Review 要求

PR review 时检查：命令行为有变化 → codestable/architecture/commands/ 必须同步更新。
没有同步更新的 PR 视为文档债务，需在下次修改时补上。

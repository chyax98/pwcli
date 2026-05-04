# CodeStable 文档入口

`codestable/` 只保存已经稳定下来的项目知识，不保存过程计划、临时评测、旧 issue、roadmap 草案或 backlog。

## 目录

```text
architecture/  架构事实、命令 ADR、限制、发布和仓库治理
compound/      已沉淀的 decision / learning / explore 参考
```

## 阅读顺序

| 目标 | 入口 |
|---|---|
| 理解架构 | `architecture/ARCHITECTURE.md` |
| 查文档边界 | `architecture/documentation-governance.md` |
| 查命令设计 | `architecture/commands/` |
| 查领域现状 | `architecture/domain-status.md` |
| 查仓库结构 | `architecture/repository-governance.md` |
| 查决策和经验 | `compound/` |

## 维护规则

- 使用教程写在 `skills/pwcli/`。
- 精确命令参数以 `pw --help` / `pw <command> --help` 为准。
- 架构、限制、扩展口写在 `architecture/`。
- 长期决策、经验和已沉淀的外部参考写在 `compound/`。
- 过程稿、路线图草案、临时评测和旧修复流水不进入本目录。

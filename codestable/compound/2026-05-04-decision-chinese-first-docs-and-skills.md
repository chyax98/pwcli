---
doc_type: decision
category: convention
status: active
summary: "项目文档和 pwcli skill 采用中文优先写作。"
tags:
  - documentation
  - skill
  - convention
---

# 中文优先文档与 Skill 写作

## 决定

`pwcli` 项目文档采用中文优先写作。`skills/pwcli/` 是核心产品面的一部分，面向 Agent 的 skill、workflow、reference、domain 文档必须中文优先。

英文只用于以下场景：

- 代码标识符、命令名、flag、错误码、API 名称、文件路径。
- 终端输出、协议字段、第三方生态固定术语的原文引用。
- 用户明确要求英文版本，或对外交付对象要求英文。

## 背景

`pwcli` 的产品面不是单独的 CLI，而是 `CLI + skills/pwcli/`。Agent 需要通过 skill 快速理解命令边界、任务链路、失败恢复和验证证据。项目当前协作语言是中文，文档如果中英混杂或默认英文，会降低持续维护、审查和复用效率。

## 理由

- 中文优先能减少项目规则、限制、roadmap、skill 指令之间的理解偏差。
- skill 是 Agent 的使用入口，中文优先可以让后续维护者明确默认写作风格，不把 reference 写成英文命令百科。
- 命令名、flag、错误码等仍保留英文原文，避免破坏可复制执行性和源码可追溯性。

## 影响

- 新增或修改 `skills/pwcli/**/*.md` 时，正文说明、任务流程、限制和恢复路径默认使用中文。
- CodeStable 文档、roadmap、architecture、decision、learning 等长期资产默认使用中文。
- 英文片段必须服务于可执行命令、源码标识、协议字段或外部引用，不能替代中文说明。

## 相关文档

- `AGENTS.md`
- `.claude/rules/09-skill-writing-standard.md`

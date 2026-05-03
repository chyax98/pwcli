---
doc_type: issue-report
issue: 2026-05-04-skill-packaged-path-resolution
status: confirmed
severity: P1
summary: "pw skill path 指向仓库父目录，导致 packaged skill install 失败。"
tags:
  - skill
  - package
  - agent-product
  - command-contract
---

# skill packaged path 解析 Issue Report

## 1. 问题现象

Agent dogfood 工具分发场景中：

```bash
pw skill path
pw skill install /tmp/pwcli-skill-install
```

`skill path` 返回：

```text
/Users/xd/work/tools/skills/pwcli
```

且 `info.exists=false`。随后 `skill install` 失败：

```text
ERROR SKILL_INSTALL_FAILED
ENOENT: no such file or directory, lstat '/Users/xd/work/tools/skills/pwcli'
```

实际 packaged skill 位于项目根：

```text
/Users/xd/work/tools/pwcli/skills/pwcli
```

## 2. 复现步骤

1. `pnpm build`
2. `pw skill path`
3. `pw skill install /tmp/pwcli-skill-install`

复现频率：稳定复现。

## 3. 期望 vs 实际

**期望行为**：`pw skill path` 指向当前包内 `skills/pwcli`，`skill install` 能复制 packaged skill 到目标目录。

**实际行为**：编译后路径从 `dist/store/skill.js` 多退了一层，指向仓库父目录的 `skills/pwcli`。

## 4. 环境信息

- Node：`v24.12.0`
- pnpm：`10.33.0`
- 相关文件：
  - `src/store/skill.ts`
  - `src/cli/commands/skill.ts`

## 5. 严重程度

**P1** — `skills/pwcli/` 是产品面的一部分；packaged skill 不能安装会破坏 Agent 获取使用真相的闭环。

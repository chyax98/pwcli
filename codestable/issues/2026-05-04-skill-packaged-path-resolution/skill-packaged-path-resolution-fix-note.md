---
doc_type: issue-fix-note
issue: 2026-05-04-skill-packaged-path-resolution
status: fixed
path: fastforward
severity: P1
root_cause_type: path-resolution
tags:
  - skill
  - package
  - agent-product
---

# skill packaged path 解析 Fix Note

## 1. 根因

`src/store/skill.ts` 使用：

```ts
new URL("../../../skills/pwcli", import.meta.url)
```

编译后模块位置是：

```text
dist/store/skill.js
```

从这里到项目/包根的 `skills/pwcli` 只需要退两层：`../../skills/pwcli`。旧实现退三层，落到项目父目录。

## 2. 修复内容

- 将 packaged skill root 解析改为 `new URL("../../skills/pwcli", import.meta.url)`。
- 新增 `pnpm check:skill-install`，覆盖：
  - `pw skill path --output json` 返回存在的 `skills/pwcli`
  - `pw skill install <tmpdir> --output json` 成功安装
  - 安装目标包含 `pwcli/SKILL.md`

## 3. 验证

RED：

```bash
pw skill path
pw skill install /tmp/pwcli-skill-install
```

修复前：`info.exists=false`，install 返回 `SKILL_INSTALL_FAILED`。

GREEN：

```bash
pnpm build
pnpm check:skill-install
```

结果：通过。

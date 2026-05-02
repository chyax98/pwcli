---
name: Bug Report
about: 命令行为与文档/skill 不符，或 Agent 主链被意外阻断
title: "[command]: [what broke] — [impact on agent]"
labels: bug
assignees: ''
---

## 💥 Bug 描述（必填）

**受影响命令**：`pw ____`

**期望行为**（引用 skill 文档或错误码定义）：
```
（引用 skills/pwcli/ 或 src/domain/ 里的 contract 描述）
```

**实际行为**（贴真实输出，不是描述）：
```
（粘贴实际 CLI 输出）
```

---

## 🔁 复现步骤（必填）

```bash
pw session create ...
pw ...
pw ...   ← 此处出现 bug
```

**可复现率**：每次必现 / 偶发（约 N/10 次）/ 环境相关

---

## 📁 代码位置（必填）

- 错误来源文件：`src/____`
- 错误码定义：`src/domain/____`（如果是错误码问题）
- 相关 skill 描述：`skills/pwcli/____`

---

## 🎯 Agent 影响

- [ ] 阻断 Agent 主链（observe / action / wait / verify / diagnostics / auth）
- [ ] 恢复提示错误或缺失
- [ ] Skill 文档与实际行为不符
- [ ] 其他：`____`

---

## ✅ 修复验收

- [ ] 具体 pw 命令 + 期望输出：`____`
- [ ] `pnpm typecheck` 通过
- [ ] `skills/pwcli/` 同步（如果 contract 变化）

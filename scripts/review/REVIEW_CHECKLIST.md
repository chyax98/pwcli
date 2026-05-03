# Code Review Checklist — pwcli 架构重构

> 审查员按本文逐项检查。自动化脚本覆盖不到的项目需要人工抽查。

---

## A. 自动化检查（跑脚本，零人工）

```bash
bash scripts/review/review-run.sh
```

脚本覆盖：
- TypeScript strict typecheck（0错误）
- 架构层边界（12项）
- pnpm build
- CLI contract（命令注册、别名、错误码）
- skill 对齐
- smoke 回归

---

## B. 架构人工抽查

### B1. 层职责抽查（每层抽2个文件）

- [ ] `engine/session.ts` — 只有 Playwright 运行时逻辑，无 CLI parsing
- [ ] `engine/act/element.ts` — 只有元素操作，无 output formatting
- [ ] `store/config.ts` — 只有 fs I/O，无 playwright import
- [ ] `cli/commands/click.ts` — 只有 3 件事：parseArgs → callEngine → printResult
- [ ] `cli/parsers/session.ts` — 只有 arg parsing，无 engine 调用

### B2. engine/shared.ts 核心检查

- [ ] `DIAGNOSTICS_STATE_KEY` 值是 `"__pwcliDiagnostics"`
- [ ] `stateAccessPrelude()` 返回正确的 JS 模板字符串
- [ ] `managedRunCode` 签名和旧 cli-client.ts 一致
- [ ] 所有 browser-side 模板字符串中的变量都用 `${JSON.stringify(...)}` 插值

### B3. engine/session.ts 核心检查

- [ ] 使用 playwright-core 私有 API（`lib/tools/cli-client/session.js`）方式和旧代码一致
- [ ] `ensureManagedSession` 签名不变
- [ ] `sessionRoutingError` 保留（错误映射）
- [ ] `SessionDefaults` 类型从 `#store/config.js` 引入，不自己定义

### B4. API 改进验证

- [ ] `--headless` 已从所有命令删除（grep 验证）
- [ ] `--no-headed` 在 session create/recreate 可用
- [ ] `pw wait --state` 是 enum（visible|hidden|stable|attached|detached）
- [ ] `pw click --button` 是 enum（left|right|middle）
- [ ] `pw screenshot --format` 是 enum（png|jpeg）
- [ ] `pw status` 是主命令，`pw observe` 是别名，两者输出完全一致
- [ ] `pw text` 和 `pw read-text` 输出完全一致

### B5. P1 Bug 修复验证

- [ ] **Tab select TOCTOU**：`engine/workspace.ts` 中 tab select 使用 pageId 直接操作，不转成 index
- [ ] **batch verify as any**：`cli/batch/executor.ts` 中 assertion 有枚举校验
- [ ] **batch route load 字段**：`cli/batch/executor.ts` 中 route load 包含 matchQuery/matchHeaders/matchJson/patchText/mergeHeaders

### B6. 错误恢复文档补全（手动检查 skill）

- [ ] `skills/pwcli/references/failure-recovery.md` 包含 `TAB_PAGE_NOT_FOUND`
- [ ] `skills/pwcli/references/failure-recovery.md` 包含 `TAB_PAGE_SELECTION_RACE`
- [ ] `skills/pwcli/references/failure-recovery.md` 包含 `STORAGE_ORIGIN_UNAVAILABLE`
- [ ] `CLOCK_LIMITATION` 有完整恢复路径
- [ ] `pw observe → pw status` 变更已在 skill 里说明

---

## C. citty 设计质量抽查

### C1. 命令文件结构一致性（抽查 5 个）

每个命令文件应该：
- [ ] `< 80 行`（thin adapter 原则）
- [ ] import `defineCommand` from citty
- [ ] spread `sharedArgs` 或 `actionArgs`
- [ ] `run({ args })` 里只有 3 步：requireSessionName → callEngine → printResult
- [ ] error 走 `printCommandError`

### C2. --help 可读性（人工看 3 个命令）

```bash
node dist/cli.js click --help
node dist/cli.js session create --help  
node dist/cli.js wait --help
```

检查：
- [ ] 每个 option 有描述
- [ ] 受限选项（enum）在描述里显示可选值
- [ ] valueHint 让参数格式一目了然
- [ ] `-s, --session` 每个命令都有

### C3. lazy import 验证（懒加载）

```bash
# index.ts 里是否用了 lazy import
grep "() => import" src/cli/commands/index.ts | wc -l
```
- [ ] 55+ 个命令全部用 lazy import（不是直接 import）

---

## D. 整体健康指标

| 指标 | 目标 | 当前 |
|---|---|---|
| src/ 总行数 | < 20000 | 待测 |
| engine/ 行数 | ~16000 | 已确认 |
| cli/ 行数 | < 5000（citty 更简洁）| 待测 |
| 命令文件平均行数 | < 80 | 待测 |
| typecheck 错误 | 0 | 待测 |
| smoke 通过率 | 100% | 待测 |

---

## E. 审查结论

- [ ] **PASS**：可进入 benchmark 阶段
- [ ] **FAIL，需修复**：列出具体问题

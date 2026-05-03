# pwcli Agent Benchmark Report

**执行时间**: 2026-05-03
**pwcli 版本**: 0.2.0
**靶场**: http://localhost:3099
**执行方式**: 10 个 Agent 并行，每个 Agent 自主决策 pw 命令序列

---

## 总览

| 指标 | 值 | 目标 | 结论 |
|------|-----|------|------|
| 场景通过率 | **10/10 (100%)** | ≥ 80% | ✅ 超额达成 |
| Core 场景通过率 | **4/4 (100%)** | ≥ 90% | ✅ 超额达成 |
| 平均命令数 | **14.7 条/任务** | — | — |
| 平均效率比 | **1.58x** | ≤ 2.0 | ✅ 达成 |
| 证据产出率 | **9/10 (90%)** | ≥ 60% | ✅ 超额达成 |
| 总自主恢复次数 | **15 次** | — | Agent 恢复能力强 |
| 发现真实 Bug | **2 个** | — | #135 #136 |

---

## 场景明细

| 任务 | 名称 | 结果 | 命令数 | 效率 | 恢复 | 截图 | 主要错误码 |
|------|------|------|--------|------|------|------|------------|
| T01 | 标准登录 [Core] | ✅ PASS | 11 | 1.57x | 1 | ✅ | REF_STALE |
| T02 | MFA 两步登录 [Core] | ✅ PASS | 20 | 1.54x | 1 | ✅ | REF_STALE |
| T03 | 登录失败恢复 | ✅ PASS | 10 | 0.91x | 1 | ✅ | none |
| T04 | 表单填写 [Core] | ✅ PASS | 18 | 1.50x | 4 | ✅ | REF_STALE×3, ACTION_TIMEOUT |
| T05 | 上传下载 | ✅ PASS | 14 | 2.00x | 0 | ✅ | none |
| T06 | Route Mock [Core] | ✅ PASS | 17 | 1.89x | 1 | ✅ | none |
| T07 | Bug 诊断 | ✅ PASS | 12 | 1.20x | 2 | ✅ | REF_STALE |
| T08 | 多 Tab | ✅ PASS | 18 | 2.00x | 1 | ✅ | CLICK_FAILED |
| T09 | 状态持久化 | ✅ PASS | 12 | 1.33x | 1 | — | STATE_DIFF_BEFORE_REQUIRED |
| T10 | Dialog 处理 | ✅ PASS | 15 | 2.50x | 3 | ✅ | MODAL_STATE_BLOCKED |
| **合计** | | **10/10** | **147** | **1.58x** | **15** | **9/10** | — |

> 效率比 = 实际命令数 / 最优命令数。T03 效率 0.91x 是因为 Agent 用更少命令完成了任务。

---

## 发现的真实 Bug（Benchmark 产出）

### Bug #135（P1）：`pw click --test-id` 触发内部错误
- **场景**: T08 多 Tab
- **错误**: `DIAGNOSTICS_STATE_KEY is not defined`
- **Agent 恢复**: 改用 `pw snapshot -i` 获取 ref 后点击
- **Issue**: https://github.com/chyax98/pwcli/issues/135

### Bug #136（P2）：`route remove` pattern 归一化不一致
- **场景**: T06 Route Mock
- **现象**: `route add **/api/products` 内部注册两条 pattern，`route remove **/api/products` 只删一条
- **Agent 恢复**: 额外执行 `route remove`（无 pattern）清空全部
- **Issue**: https://github.com/chyax98/pwcli/issues/136

---

## Agent 行为观察（评测侧发现）

### 自主恢复模式
Agent 展现了高质量的恢复策略，REF_STALE 是最常见的错误码：

| 错误码 | 出现次数 | Agent 恢复策略 | 恢复成功率 |
|--------|----------|----------------|------------|
| REF_STALE | 7 | 重新 snapshot -i 获取最新 ref | 100% |
| MODAL_STATE_BLOCKED | 1 | 顺序执行 pw dialog accept/dismiss | 100% |
| STATE_DIFF_BEFORE_REQUIRED | 1 | 先 --before 捕获基线再 diff | 100% |
| SESSION_NOT_FOUND | 2 | 重建 session 后继续 | 100% |
| ACTION_TIMEOUT | 1 | 改用语义定位重试 | 100% |

**恢复成功率：15/15 (100%)**

### 关键行为发现

1. **REF_STALE 是主要噪音**：7次出现，均源于跨页面/Session 超时后 ref 失效。MFA 逐字填入（T02）和表单复杂填写（T04）最容易触发。建议：高频场景应优先用 `--selector` 或语义定位代替 ref。

2. **Dialog 必须顺序处理**（T10）：`pw click` → 等待 `MODAL_STATE_BLOCKED` → `pw dialog accept/dismiss`。并行模式会导致 session 不稳定甚至崩溃。这个规律需要写入 skill 文档。

3. **`pw code` 是 VM sandbox**（T05）：不支持 `require()` / `import()`，Agent 自主改用 Bash 验证文件存在。需在 skill 中明确说明此限制。

4. **state diff 需要显式 baseline**（T09）：`STATE_DIFF_BEFORE_REQUIRED` 是设计行为，但 Agent 首次遇到需要自主学习。错误消息清晰，恢复路径明确。

5. **MFA 逐字填入耗时风险**（T02）：6 位 × 1次fill ≈ 40s，接近 session timeout 阈值。建议 MFA 场景用 `pw fill --selector '[data-testid=mfa-digit-0]' '123456'` 整体填入（若支持）。

---

## Task Spec 问题（需修正）

| 任务 | 问题 | 修正 |
|------|------|------|
| T04 | input-select 是 Country 下拉框，task spec 写的是选 "python"（语言） | 改为选 "cn"（中国）或删除 select 步骤 |

---

## 结论

**pwcli v0.2.0 的 Agent 可用性：优秀**

- 100% 场景完成率，Agent 能独立完成所有 10 类真实浏览器任务
- 自主恢复率 100%，错误码设计清晰，Agent 能从错误中准确判断下一步
- 平均效率 1.58x（仅比最优多用 58% 的命令），在可接受范围内
- 最大问题：REF_STALE 频率较高，在 MFA/复杂表单等多步场景中需要更稳定的定位策略
- 发现 2 个真实 Bug（#135 #136），已建 Issue

**下一步优先级：**
1. 修复 #135（click --test-id 内部错误）
2. 修复 #136（route remove pattern 归一化）
3. Skill 文档更新：Dialog 顺序处理模式、pw code VM 限制、state diff baseline 用法
4. 考虑降低 REF_STALE 触发频率（MFA 场景优化）

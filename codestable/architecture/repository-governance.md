# Repository Governance

更新时间：2026-05-04
状态：active

这份文档记录仓库结构和清理归档规则。它是仓库治理说明，不是开发日志。

## 当前结构

```text
src/                  产品源码
skills/pwcli/         Agent 使用 SOP
test/                 测试、fixture、smoke、e2e、benchmark 资产
docs/                 对外文档入口
codestable/           架构、decision、归档后的稳定结论；README.md 是入口
.github/              issue template、CI
.claude/              Claude Code 项目规则和本地 slash command
```

## 测试分层

- `test/unit/`：纯函数、生成器、轻量 contract。
- `test/integration/`：真实 `dist/cli.js`、本地 session、fixture server 和命令集成。
- `test/contract/`：命令 surface、skill 安装、help 文案和专项能力契约验证。
- `test/smoke/`：发布前本地主链回归。
- `test/e2e/`：Agent dogfood 辅助脚本，不替代 Agent 真实任务验证。
- `test/app/`：本地测试应用。
- `test/benchmark/`：deterministic stability harness，属于测试资产，不是独立平台。

默认 gate：

```bash
pnpm test
pnpm check
pnpm smoke
pnpm pack:check
```

## 清理归档规则

- 旧过程稿、review 脚本、survey 草稿、无入口测试和已删除产品面的测试不长期保留。
- 稳定结论只能吸收到 `skills/pwcli/`、`codestable/architecture/`、`codestable/compound/` 或 issue/fix-note。
- 如果只需要解释“为什么删”，在本文件记录结论，不把旧文件搬到 archive 目录继续维护。
- 仓库不保留独立 `scripts/` 测试入口；测试和契约验证统一放 `test/`。

## 本轮归档结论

- 旧 `extract` recipe 测试已删除。`extract` 不属于 1.0 command surface，不恢复兼容命令。
- 旧 `scripts/review/` 已删除。它记录的是历史重构 review 流程，含旧 flag 和旧兼容表述，不作为 1.0 truth。
- 旧 `codestable/roadmap/`、`codestable/issues/`、`codestable/reference/` 和 `codestable/tools/` 已删除。它们是 1.0 冲刺过程面或模板面；长期结论已收敛到 architecture、compound 和本文件。
- 原 `benchmark/` 已迁入 `test/benchmark/`，定位收敛为测试分层的一部分。
- 原 `scripts/test*`、`scripts/e2e`、`scripts/smoke`、`scripts/fixtures` 已迁入 `test/`。
- 原 `scripts/check-*.js` 已迁入 `test/contract/`，定位为命令和 skill 的专项契约验证。

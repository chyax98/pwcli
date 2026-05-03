---
doc_type: audit
slug: repo-cleanup-baseline
status: completed
created: 2026-05-04
tags: [repo-cleanup, pre-1-0, generated-artifacts]
related_roadmap: pre-1-0-breakthrough
---

# Repo Cleanup Baseline Audit

## 结论

本轮 `repo-cleanup-baseline` 只处理确定性生成物和过程辅助文件，不扩大到需要产品判断的脚本体系。

已清理：

| 类别 | 路径 | 数量 | 结论 |
|---|---|---:|---|
| Next fixture build output | `scripts/test-app/.next/` | 299 | 删除。它是本地 fixture app 的构建产物，不是源码 truth |
| eval run output | `scripts/eval/*.log`、`scripts/eval/raw_results.tsv` | 6 | 删除。它们是历史运行输出，不是稳定评测结论 |
| 临时调查脚本 | `scripts/tmp/` | 5 | 删除。它们是过程辅助文件，未形成稳定入口 |

防回归：

| 路径 | 处理 |
|---|---|
| `scripts/test-app/.next/` | 加入 `.gitignore` |
| `scripts/test-app/node_modules/` | 加入 `.gitignore` |
| `scripts/tmp/` | 加入 `.gitignore` |
| `scripts/eval/*.log` | 加入 `.gitignore` |
| `scripts/eval/raw_results.tsv` | 加入 `.gitignore` |

## 保留边界

以下内容本轮不删除，因为仍可能承担 1.0 证据或辅助回归责任，必须进入后续专项审计，而不是按“旧文件”粗暴清理。

| 路径 | 当前判断 | 后续 item |
|---|---|---|
| `scripts/e2e/` | 保留。`test:dogfood:e2e` 仍是 package script，且当前已跑通；后续需要决定保留、拆分或移除 | `e2e-helper-contract-alignment` |
| `scripts/eval/` 的 harness / markdown | 暂时保留。历史评测工具和结论需要判断是否仍支撑 1.0 能力提升，不在 baseline 中删除 | `codestable-truth-1-0-audit` |
| `scripts/benchmark/` | 暂时保留。benchmark 结果和截图可能仍能作为历史能力证据，但需要明确入口、owner 和是否进入 1.0 gate | `codestable-truth-1-0-audit` |
| `scripts/test-app/src`、配置和 package 文件 | 保留。它是本地 fixture app 源码，不是生成物 | 后续按实际测试入口维护 |

## 证据

审计前，Go 辅助工具按 Git tracked 文件扫描得到：

```text
tracked_file_count: 741
delete_candidate_count: 309
delete_candidate_size: 82.5 MiB
needs_review:
  scripts/benchmark/: 29 files
  scripts/e2e/: 8 files
  scripts/eval/: 12 files
```

清理动作：

```bash
git rm -- scripts/eval/*.log scripts/eval/raw_results.tsv
git rm -r -- scripts/test-app/.next
git rm -r -- scripts/tmp
```

清理后复查：

```bash
git ls-files scripts/test-app/.next scripts/tmp 'scripts/eval/*.log' scripts/eval/raw_results.tsv | wc -l
# 0
```

## 维护约束

- `scripts/test-app/` 可以继续作为 fixture app 源码存在，但 `.next/`、`node_modules/` 不进入 Git。
- eval / benchmark 的历史结论如果要继续保留，后续必须明确用途、入口、维护责任和 1.0 关联；否则在 `codestable-truth-1-0-audit` 中删除或吸收进正式文档。
- baseline 不改变任何 CLI command contract，不需要同步 `skills/pwcli/`。

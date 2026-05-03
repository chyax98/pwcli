#!/usr/bin/env bash
# 完整 review 流程入口：按顺序跑所有检查，任何一步失败就停
# 用法：bash scripts/review/review-run.sh

set -euo pipefail

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     pwcli 架构重构 Code Review           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

FAILED_STEPS=()

run_step() {
  local step="$1"
  local cmd="$2"
  echo "▶ $step"
  if eval "$cmd"; then
    echo "  → PASS"
  else
    echo "  → FAIL（后续步骤继续，汇总见末尾）"
    FAILED_STEPS+=("$step")
  fi
  echo ""
}

# ── Step 1：TypeScript 严格检查 ──────────────────────────────────────────
run_step "1. TypeScript strict typecheck" \
  "pnpm exec tsc -p tsconfig.json --noEmit 2>&1 | tee /tmp/pwcli-typecheck.log | tail -5 && ! grep -q 'error TS' /tmp/pwcli-typecheck.log"

# ── Step 2：架构边界检查 ─────────────────────────────────────────────────
run_step "2. 架构层边界（无越层 import）" \
  "bash scripts/review/arch-check.sh"

# ── Step 3：编译 ──────────────────────────────────────────────────────────
run_step "3. pnpm build（产出 dist/）" \
  "pnpm build 2>&1 | tail -5"

# ── Step 4：CLI contract 检查 ────────────────────────────────────────────
run_step "4. CLI contract（命令注册 + 别名 + 错误码）" \
  "bash scripts/review/contract-check.sh"

# ── Step 5：skill 对齐检查 ────────────────────────────────────────────────
run_step "5. Skill contract 检查" \
  "node scripts/check-skill-contract.js 2>&1 | tail -10"

# ── Step 6：Smoke 回归 ────────────────────────────────────────────────────
run_step "6. Smoke 回归测试" \
  "pnpm smoke 2>&1 | tail -15"

# ── 汇总 ─────────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════╗"
echo "║  Review 汇总                             ║"
echo "╚══════════════════════════════════════════╝"
if [ ${#FAILED_STEPS[@]} -eq 0 ]; then
  echo ""
  echo "  🎉 全部通过！可以进入 benchmark 阶段。"
  echo ""
  exit 0
else
  echo ""
  echo "  ❌ 以下步骤失败，需要修复："
  for s in "${FAILED_STEPS[@]}"; do
    echo "     - $s"
  done
  echo ""
  exit 1
fi

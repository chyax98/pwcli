#!/usr/bin/env bash
# 架构健康自动检查
# 用法：bash scripts/review/arch-check.sh
# 每一项 PASS 继续，FAIL 打印证据并计数

set -euo pipefail
SRC="src"
PASS=0; FAIL=0

ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; shift; echo "     $*"; FAIL=$((FAIL+1)); }

echo ""
echo "══════════════════════════════════════════"
echo "  pwcli 架构检查"
echo "══════════════════════════════════════════"

# ── 1. 层边界：engine/ 不能 import #cli/ ─────────────────────────────────
echo ""
echo "【1】层边界：engine → cli（必须为空）"
BAD=$(grep -rn 'from "#cli/' "$SRC/engine/" 2>/dev/null || true)
[ -z "$BAD" ] && ok "engine/ 无 #cli/ import" \
               || fail "engine/ 存在 #cli/ import" "$BAD"

# ── 2. 层边界：store/ 不能 import #engine/ 或 #cli/ ─────────────────────
echo ""
echo "【2】层边界：store → engine/cli（必须为空）"
BAD=$(grep -rn 'from "#engine/\|from "#cli/' "$SRC/store/" 2>/dev/null || true)
[ -z "$BAD" ] && ok "store/ 无 #engine/ 或 #cli/ import" \
               || fail "store/ 存在越层 import" "$BAD"

# ── 3. 层边界：auth/ 不能 import #cli/ ──────────────────────────────────
echo ""
echo "【3】层边界：auth → cli（必须为空）"
BAD=$(grep -rn 'from "#cli/' "$SRC/auth/" 2>/dev/null || true)
[ -z "$BAD" ] && ok "auth/ 无 #cli/ import" \
               || fail "auth/ 存在 #cli/ import" "$BAD"

# ── 4. cli/ 不能 import commander ────────────────────────────────────────
echo ""
echo "【4】commander 清除（cli/ 必须无 commander）"
BAD=$(grep -rn 'from "commander"\|require("commander")' "$SRC/cli/" 2>/dev/null || true)
[ -z "$BAD" ] && ok "cli/ 无 commander import" \
               || fail "cli/ 仍有 commander import" "$BAD"

# ── 5. cli/ 全部使用 citty ───────────────────────────────────────────────
echo ""
echo "【5】citty 使用（所有命令文件必须有 defineCommand）"
TOTAL=$(find "$SRC/cli/commands" -name "*.ts" 2>/dev/null | grep -v index | grep -v _helpers | wc -l | tr -d ' ')
CITTY=$(grep -rl 'defineCommand\|from "citty"' "$SRC/cli/commands/" 2>/dev/null | grep -v index | grep -v _helpers | wc -l | tr -d ' ')
if [ "$TOTAL" -eq 0 ]; then
  fail "cli/commands/ 没有任何文件" ""
elif [ "$TOTAL" -eq "$CITTY" ]; then
  ok "全部 $TOTAL 个命令文件使用 citty"
else
  MISSING=$((TOTAL - CITTY))
  NAMES=$(grep -rL 'defineCommand\|from "citty"' "$SRC/cli/commands/" 2>/dev/null | grep -v index | grep -v _helpers | head -5)
  fail "$MISSING 个命令文件没有用 citty" "$NAMES"
fi

# ── 6. 模板注入安全：engine/ 中 DIAGNOSTICS_STATE_KEY 必须在 ${} 里 ─────
echo ""
echo "【6】模板注入安全（DIAGNOSTICS_STATE_KEY 必须 JSON.stringify 插值）"
# 在模板字符串里直接用变量名（不在 ${} 里）是危险的
# 检查：context[DIAGNOSTICS_STATE_KEY] 出现在模板字符串内（没有 ${ 包裹）
BAD=$(grep -rn 'context\[DIAGNOSTICS_STATE_KEY\]' "$SRC/engine/" 2>/dev/null \
      | grep -v '\${JSON\.stringify(DIAGNOSTICS_STATE_KEY)}' \
      | grep -v '^\s*//' \
      || true)
[ -z "$BAD" ] && ok "无裸露 DIAGNOSTICS_STATE_KEY 使用" \
               || fail "存在未插值的 DIAGNOSTICS_STATE_KEY" "$BAD"

# ── 7. import 扩展名（所有 import 必须用 .js） ──────────────────────────
echo ""
echo "【7】import 扩展名（必须用 .js）"
BAD=$(grep -rn "from ['\"]\..*['\"]" "$SRC/" 2>/dev/null \
      | grep -v '\.js["\x27]' \
      | grep -v '\.json["\x27]' \
      | grep -v '^.*//.*from' \
      | head -5 || true)
[ -z "$BAD" ] && ok "所有相对 import 使用 .js 扩展名" \
               || fail "存在缺少 .js 扩展名的 import" "$BAD"

# ── 8. 跨层 import 使用别名（engine/cli 跨层必须用 # 别名） ────────────
echo ""
echo "【8】跨层 import 用别名（不能用 ../../ 穿越层边界）"
# cli/ 里不应有 ../../engine 或 ../../store
BAD=$(grep -rn "from ['\"]\.\.\/\.\.\/" "$SRC/cli/" 2>/dev/null \
      | grep -E "engine|store|auth" | head -5 || true)
[ -z "$BAD" ] && ok "cli/ 无跨层相对路径" \
               || fail "cli/ 存在跨层相对路径（应用别名）" "$BAD"

# ── 9. Tab select TOCTOU bug 已修复 ─────────────────────────────────────
echo ""
echo "【9】Tab select TOCTOU 修复（不能有 tab-select + index 模式）"
BAD=$(grep -n '"tab-select".*index\|tab-select.*String(target\.index)' \
      "$SRC/engine/workspace.ts" 2>/dev/null || true)
[ -z "$BAD" ] && ok "Tab select TOCTOU 已修复" \
               || fail "Tab select 仍使用 index 传递" "$BAD"

# ── 10. batch verify 不能 as any ─────────────────────────────────────────
echo ""
echo "【10】batch verify assertion 校验（不能 as any）"
BAD=$(grep -n 'assertion.*as any\|as any.*assertion' \
      "$SRC/cli/batch/executor.ts" 2>/dev/null || true)
[ -z "$BAD" ] && ok "batch verify 无 as any" \
               || fail "batch verify 仍有 as any" "$BAD"

# ── 11. sharedArgs spread（每个命令都有 session + output）──────────────
echo ""
echo "【11】sharedArgs 使用（所有命令文件必须 spread sharedArgs 或 actionArgs）"
TOTAL=$(find "$SRC/cli/commands" -name "*.ts" 2>/dev/null | grep -v index | grep -v _helpers | wc -l | tr -d ' ')
WITH=$(grep -rl 'sharedArgs\|actionArgs\|sessionArg\|...session' \
       "$SRC/cli/commands/" 2>/dev/null | grep -v index | grep -v _helpers | wc -l | tr -d ' ')
if [ "$TOTAL" -eq 0 ]; then
  fail "cli/commands/ 没有命令文件" ""
elif [ "$WITH" -ge "$((TOTAL * 9 / 10))" ]; then
  ok "$WITH/$TOTAL 个命令文件使用共享 args"
else
  MISSING=$((TOTAL - WITH))
  fail "$MISSING 个命令文件缺少 sharedArgs" ""
fi

# ── 12. 旧路径残留（不能有 infra/ domain/ app/ 路径）────────────────────
echo ""
echo "【12】旧路径清除（src/ 内不能有 src_backup 路径引用）"
BAD=$(grep -rn 'infra/playwright\|domain/interaction\|domain/session\|domain/diagnostics\|app/commands' \
      "$SRC/" 2>/dev/null | grep "from ['\"]" | head -5 || true)
[ -z "$BAD" ] && ok "无旧路径引用" \
               || fail "存在旧路径引用" "$BAD"

# ── 汇总 ─────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  结果：PASS $PASS  FAIL $FAIL"
echo "══════════════════════════════════════════"
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1

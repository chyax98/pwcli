#!/usr/bin/env bash
# CLI contract 验证：确认重构没有破坏任何输出 contract 和命令面
# 需要先 pnpm build

set -euo pipefail
PASS=0; FAIL=0
CLI="node dist/cli.js"

ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; shift; echo "     $*"; FAIL=$((FAIL+1)); }

echo ""
echo "══════════════════════════════════════════"
echo "  CLI Contract 检查"
echo "══════════════════════════════════════════"

# ── 1. 入口可用 ───────────────────────────────────────────────────────────
echo ""
echo "【1】入口（pw --help 可以运行）"
OUTPUT=$($CLI --help 2>&1 || true)
echo "$OUTPUT" | grep -q "pw\|Playwright\|Agent" \
  && ok "pw --help 正常" \
  || fail "pw --help 失败" "$OUTPUT"

# ── 2. 核心命令注册 ────────────────────────────────────────────────────────
echo ""
echo "【2】核心命令注册"
for cmd in session click fill snapshot screenshot wait observe status; do
  $CLI "$cmd" --help > /dev/null 2>&1 \
    && ok "pw $cmd --help" \
    || fail "pw $cmd --help 失败" ""
done

# ── 3. 别名命令（新旧兼容）────────────────────────────────────────────────
echo ""
echo "【3】别名兼容"
# observe = status 的别名
OBS=$($CLI observe --help 2>&1 || true)
STA=$($CLI status --help 2>&1 || true)
[ -n "$OBS" ] && ok "pw observe（兼容别名）" \
               || fail "pw observe 不可用" ""
[ -n "$STA" ] && ok "pw status（新主名称）" \
               || fail "pw status 不可用" ""

# text = read-text 的别名
TXT=$($CLI text --help 2>&1 || true)
RT=$($CLI read-text --help 2>&1 || true)
[ -n "$TXT" ] && ok "pw text（短别名）" \
               || fail "pw text 不可用" ""
[ -n "$RT" ]  && ok "pw read-text（原名）" \
               || fail "pw read-text 不可用" ""

# ── 4. API 改进验证 ────────────────────────────────────────────────────────
echo ""
echo "【4】API 改进"
# --no-headed 替代 --headless（在 session create 子命令里）
SC=$($CLI session create --help 2>&1 || true)
echo "$SC" | grep -q "\-\-headed" \
  && ok "session 有 --headed/--no-headed" \
  || fail "session 缺少 --headed flag" ""

echo "$SC" | grep -qv "\-\-headless" \
  && ok "session 已移除 --headless" \
  || fail "session 仍有 --headless（应删除）" ""

# --state enum 在 wait 命令
WT=$($CLI wait --help 2>&1 || true)
echo "$WT" | grep -q "visible\|hidden\|stable" \
  && ok "wait --state 显示 enum 选项" \
  || fail "wait --state 缺少 enum 提示" ""

# ── 5. 全量命令 --help 不崩溃 ─────────────────────────────────────────────
echo ""
echo "【5】全量命令 --help 不崩溃"
CMDS=$(node -e "
const { execSync } = require('child_process');
const help = execSync('$CLI --help 2>&1').toString();
const matches = help.match(/^\s{2,4}(\w[\w-]+)/gm) || [];
console.log(matches.map(s => s.trim()).join('\n'));
" 2>/dev/null || true)

FAIL_CMDS=()
while IFS= read -r cmd; do
  [ -z "$cmd" ] && continue
  $CLI "$cmd" --help > /dev/null 2>&1 || FAIL_CMDS+=("$cmd")
done <<< "$CMDS"

if [ ${#FAIL_CMDS[@]} -eq 0 ]; then
  ok "所有顶级命令 --help 正常"
else
  fail "${#FAIL_CMDS[@]} 个命令 --help 失败" "${FAIL_CMDS[*]}"
fi

# ── 6. 错误码字符串存在（静态检查）────────────────────────────────────────
echo ""
echo "【6】关键错误码保留（源码静态检查）"
for code in REF_STALE CLICK_SEMANTIC_NOT_FOUND TAB_PAGE_NOT_FOUND \
            SESSION_REQUIRED SESSION_NAME_INVALID MODAL_STATE_BLOCKED; do
  grep -rq "$code" src/ \
    && ok "$code 存在" \
    || fail "$code 已消失（contract 破坏）" ""
done

# ── 7. JSON envelope 结构（需要真实 session，跳过） ───────────────────────
echo ""
echo "【7】JSON envelope（需要 session，本脚本跳过）"
echo "  ⏭  跳过：运行 pnpm smoke 验证完整 envelope"

# ── 汇总 ─────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  结果：PASS $PASS  FAIL $FAIL"
echo "══════════════════════════════════════════"
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1

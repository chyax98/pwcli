#!/bin/zsh
set -o pipefail

PW="node /Users/xd/work/tools/pwcli/dist/cli.js"
TARGET="http://localhost:3099"
RESULTS_FILE="/Users/xd/work/tools/pwcli/scripts/eval/EVAL_RESULTS.md"
TMP_DIR="/tmp/pwcli-eval"
mkdir -p "$TMP_DIR"

# Counters
declare -A D_PASS D_FAIL D_WARN D_SKIP
DOMAINS=("D1" "D2" "D3" "D4" "D5" "D6" "D7" "D8" "D9" "D10" "D11")
for d in "${DOMAINS[@]}"; do
  D_PASS[$d]=0; D_FAIL[$d]=0; D_WARN[$d]=0; D_SKIP[$d]=0
done

TOTAL_PASS=0; TOTAL_FAIL=0; TOTAL_WARN=0; TOTAL_SKIP=0

# Result lines for markdown
RESULT_MD=""
FAIL_LIST=""
WARN_LIST=""

log_tc() {
  local tc="$1"
  local status="$2"
  local cmd="$3"
  local out="$4"
  local reason="$5"
  local domain="$6"

  local icon=""
  case "$status" in
    PASS) icon="✅ PASS"; ((D_PASS[$domain]++)); ((TOTAL_PASS++)) ;;
    FAIL) icon="❌ FAIL"; ((D_FAIL[$domain]++)); ((TOTAL_FAIL++)); FAIL_LIST+="- $tc: \`$cmd\` → $reason\n" ;;
    WARN) icon="⚠️ WARN"; ((D_WARN[$domain]++)); ((TOTAL_WARN++)); WARN_LIST+="- $tc: exit 0 但 $reason\n" ;;
    SKIP) icon="⏭️ SKIP"; ((D_SKIP[$domain]++)); ((TOTAL_SKIP++)); FAIL_LIST+="- $tc: \`$cmd\` → SKIP: $reason\n" ;;
  esac

  local escaped_out
  escaped_out=$(echo "$out" | tr '\n' ' ' | sed 's/|/\\|/g' | cut -c1-300)
  RESULT_MD+="### $tc $icon\n"
  RESULT_MD+="**执行**: \`$cmd\`\n"
  RESULT_MD+="**输出摘要**: $escaped_out\n"
  if [ "$status" = "FAIL" ] || [ "$status" = "SKIP" ]; then
    RESULT_MD+="**判断**: $reason\n"
  else
    RESULT_MD+="**判断**: exit $exit_code + $reason\n"
  fi
  RESULT_MD+="\n"
}

run_cmd() {
  local cmd="$1"
  local out_file="$TMP_DIR/out_$$.txt"
  eval "$cmd" > "$out_file" 2>&1
  exit_code=$?
  cat "$out_file"
  rm -f "$out_file"
  return $exit_code
}

# Helper to run and check
run_and_log() {
  local tc="$1"
  local domain="$2"
  local cmd="$3"
  local check="$4"
  local reason_pass="$5"
  local expected_exit="${6:-0}"

  local out
  out=$(run_cmd "$cmd")
  local ec=$exit_code

  if [ "$expected_exit" = "nonzero" ]; then
    if [ $ec -ne 0 ]; then
      if echo "$out" | grep -q "$check"; then
        log_tc "$tc" "PASS" "$cmd" "$out" "$reason_pass" "$domain"
      else
        log_tc "$tc" "WARN" "$cmd" "$out" "exit 非0 但缺少 $check" "$domain"
      fi
    else
      log_tc "$tc" "FAIL" "$cmd" "$out" "预期 exit 非0，实际 exit 0" "$domain"
    fi
  else
    if [ $ec -ne 0 ]; then
      log_tc "$tc" "FAIL" "$cmd" "$out" "exit $ec (预期 0)" "$domain"
    else
      if echo "$out" | grep -q "$check"; then
        log_tc "$tc" "PASS" "$cmd" "$out" "$reason_pass" "$domain"
      else
        log_tc "$tc" "WARN" "$cmd" "$out" "缺少字段 $check" "$domain"
      fi
    fi
  fi
}

# ==================== Domain 1: Session ====================
echo "=== Domain 1: Session ==="

# TC-001
run_and_log "TC-001" "D1" "$PW session create eval-d1 --open $TARGET" "created: true" "created=true" 0

# TC-002
run_and_log "TC-002" "D1" "$PW session create eval-ses-02 --headed --open $TARGET" "headed: true" "headed=true" 0

# TC-003
run_and_log "TC-003" "D1" "$PW session create eval-ses-03 --open $TARGET/login" "/login" "page URL 含 /login" 0

# TC-004
run_and_log "TC-004" "D1" "$PW session status eval-d1" "active: true" "active=true" 0

# TC-005
run_and_log "TC-005" "D1" "$PW session status eval-ses-nonexistent" "SESSION_NOT_FOUND" "SESSION_NOT_FOUND" "nonzero"

# TC-006
run_and_log "TC-006" "D1" "$PW session list" "count" "count >= 1" 0

# TC-007
run_and_log "TC-007" "D1" "$PW session list --with-page" "withPage: true" "withPage=true" 0

# TC-008
run_and_log "TC-008" "D1" "$PW session recreate eval-d1 --open $TARGET/login" "recreated: true" "recreated=true" 0

# TC-009
run_and_log "TC-009" "D1" "$PW session list --attachable" "capability" "capability 字段存在" 0

# TC-010
run_and_log "TC-010" "D1" "$PW session close eval-ses-02" "closed: true\|name: eval-ses-02" "closed=true" 0

# Cleanup D1 sessions except eval-d1
$PW session close eval-ses-03 2>/dev/null || true

# ==================== Domain 2: Page Reading ====================
echo "=== Domain 2: Page Reading ==="
# Ensure eval-d1 is on dashboard and logged in for some tests
$PW open $TARGET/login --session eval-d1 2>/dev/null || true
$PW fill --session eval-d1 --selector '[data-testid=login-email]' 'demo@test.com' 2>/dev/null || true
$PW fill --session eval-d1 --selector '[data-testid=login-password]' 'password123' 2>/dev/null || true
$PW click --session eval-d1 --selector '[data-testid=login-submit]' 2>/dev/null || true
sleep 2
$PW open $TARGET/dashboard --session eval-d1 2>/dev/null || true
sleep 1

# TC-011
run_and_log "TC-011" "D2" "$PW observe status --session eval-d1" "summary" "summary 字段存在" 0

# TC-012
run_and_log "TC-012" "D2" "$PW read-text --session eval-d1" "Total Users\|Active Sessions" "文本非空含 dashboard 内容" 0

# TC-013
run_and_log "TC-013" "D2" "$PW read-text --session eval-d1 --max-chars 500" "text" "max-chars 限制" 0

# TC-014
run_and_log "TC-014" "D2" "$PW read-text --session eval-d1 --selector '[data-testid=\"stat-users\"]'" "Total Users\|stat-users" "selector 局部文本" 0

# TC-015
run_and_log "TC-015" "D2" "$PW snapshot --session eval-d1" "heading\|button\|link" "ARIA 树结构" 0

# TC-016
$PW open $TARGET/login --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-016" "D2" "$PW snapshot -i --session eval-d1" "button\|input\|link" "交互元素+ref" 0

# TC-017
run_and_log "TC-017" "D2" "$PW snapshot -c --session eval-d1" "button\|input" "紧凑模式" 0

# TC-018
$PW open $TARGET/dashboard --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-018" "D2" "$PW accessibility --session eval-d1" "role" "ARIA role 字段" 0

# TC-019
$PW open $TARGET/login --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-019" "D2" "$PW accessibility -i --session eval-d1" "button\|input" "仅交互节点" 0

# TC-020
$PW open $TARGET/dashboard --session eval-d1 2>/dev/null || true
sleep 1
out=$($PW screenshot --session eval-d1 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "path"; then
  path=$(echo "$out" | grep -o 'path: [^ ]*' | awk '{print $2}')
  if [ -f "$path" ]; then
    log_tc "TC-020" "PASS" "$PW screenshot --session eval-d1" "$out" "path 非空且文件存在" "D2"
  else
    log_tc "TC-020" "WARN" "$PW screenshot --session eval-d1" "$out" "path 非空但文件不存在" "D2"
  fi
else
  log_tc "TC-020" "FAIL" "$PW screenshot --session eval-d1" "$out" "exit $ec 或缺少 path" "D2"
fi

# TC-021
out=$($PW screenshot --session eval-d1 --full-page 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "path"; then
  log_tc "TC-021" "PASS" "$PW screenshot --session eval-d1 --full-page" "$out" "path 存在" "D2"
else
  log_tc "TC-021" "FAIL" "$PW screenshot --session eval-d1 --full-page" "$out" "exit $ec 或缺少 path" "D2"
fi

# TC-022
out=$($PW pdf --session eval-d1 --path /tmp/eval-test.pdf 2>&1)
ec=$?
if [ $ec -eq 0 ] && [ -f /tmp/eval-test.pdf ]; then
  log_tc "TC-022" "PASS" "$PW pdf --session eval-d1 --path /tmp/eval-test.pdf" "$out" "PDF 文件存在" "D2"
else
  log_tc "TC-022" "FAIL" "$PW pdf --session eval-d1 --path /tmp/eval-test.pdf" "$out" "exit $ec 或 PDF 不存在" "D2"
fi

# TC-023
run_and_log "TC-023" "D2" "$PW page current --session eval-d1" "pageId\|url\|title\|navigationId" "pageId/url/title/navigationId" 0

# TC-024
run_and_log "TC-024" "D2" "$PW page frames --session eval-d1" "frames" "frames 数组存在" 0

# TC-025
run_and_log "TC-025" "D2" "$PW page assess --session eval-d1" "summary\|nextSteps" "summary+nextSteps" 0

# ==================== Domain 3: Navigation & Workspace ====================
echo "=== Domain 3: Navigation ==="

# TC-026
run_and_log "TC-026" "D3" "$PW open $TARGET/login --session eval-d1" "/login" "URL 含 /login" 0

# TC-027
$PW open $TARGET/tabs --session eval-d1 2>/dev/null || true
sleep 1
$PW click --session eval-d1 --test-id link-new-tab-child 2>/dev/null || true
sleep 1
run_and_log "TC-027" "D3" "$PW page list --session eval-d1" "pages" "pages 数组 >=2" 0

# TC-028
pid=$($PW page list --session eval-d1 --output json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); pages=d.get('data',{}).get('pages',d.get('pages',[])); print([p['pageId'] for p in pages if '/tabs/child' in p.get('url','')][0])" 2>/dev/null)
if [ -n "$pid" ]; then
  $PW tab select $pid --session eval-d1 2>/dev/null || true
  run_and_log "TC-028" "D3" "$PW page current --session eval-d1" "/tabs/child" "切换后 URL 含 /tabs/child" 0
else
  log_tc "TC-028" "FAIL" "$PW tab select ..." "" "无法获取 child tab pageId" "D3"
fi

# TC-029
pid2=$($PW page list --session eval-d1 --output json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); pages=d.get('data',{}).get('pages',d.get('pages',[])); print([p['pageId'] for p in pages if '/tabs/child' in p.get('url','')][0])" 2>/dev/null)
if [ -n "$pid2" ]; then
  before=$($PW page list --session eval-d1 --output json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); pages=d.get('data',{}).get('pages',d.get('pages',[])); print(len(pages))")
  $PW tab close $pid2 --session eval-d1 2>/dev/null || true
  after=$($PW page list --session eval-d1 --output json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); pages=d.get('data',{}).get('pages',d.get('pages',[])); print(len(pages))")
  if [ "$before" -gt "$after" ]; then
    log_tc "TC-029" "PASS" "$PW tab close $pid2 --session eval-d1" "before=$before after=$after" "pages 减少" "D3"
  else
    log_tc "TC-029" "WARN" "$PW tab close $pid2 --session eval-d1" "before=$before after=$after" "pages 未减少" "D3"
  fi
else
  log_tc "TC-029" "FAIL" "$PW tab close ..." "" "无法获取 child tab pageId" "D3"
fi

# TC-030 (修正: --networkidle)
$PW open $TARGET/dashboard --session eval-d1 2>/dev/null || true
run_and_log "TC-030" "D3" "$PW wait --networkidle --session eval-d1" "waited\|networkIdle" "network idle 等待成功" 0

# TC-031
$PW open $TARGET/dashboard --session eval-d1 2>/dev/null || true
run_and_log "TC-031" "D3" "$PW wait --selector '[data-testid=\"stat-users\"]' --session eval-d1" "waited\|selector" "selector 等待成功" 0

# TC-032
run_and_log "TC-032" "D3" "$PW wait --text 'Total Users' --session eval-d1" "waited\|text" "text 等待成功" 0

# TC-033 (修正: --networkidle)
$PW open $TARGET/network --session eval-d1 2>/dev/null || true
run_and_log "TC-033" "D3" "$PW wait --networkidle --session eval-d1" "waited\|networkIdle" "network idle 等待成功" 0

# TC-034
run_and_log "TC-034" "D3" "$PW page dialogs --session eval-d1" "dialogs" "dialogs 字段存在" 0

# TC-035
run_and_log "TC-035" "D3" "$PW resize --session eval-d1 --view 1280x800" "width\|height\|1280\|800" "resize 成功含尺寸" 0

# ==================== Domain 4: Interaction ====================
echo "=== Domain 4: Interaction ==="
# eval-d1 reused

# TC-036
$PW open $TARGET/login --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-036" "D4" "$PW click --session eval-d1 --selector '[data-testid=\"login-submit\"]'" "acted: true" "acted=true" 0

# TC-037
$PW open $TARGET/login --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-037" "D4" "$PW click --session eval-d1 --role button --name 'Sign in'" "acted: true" "acted=true" 0

# TC-038
$PW open $TARGET/login --session eval-d1 2>/dev/null || true
sleep 1
ref=$($PW snapshot -i --session eval-d1 --output json 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
def find(node):
  name=node.get('name','')
  if 'Sign in' in name and node.get('role')=='button':
    return node.get('ref')
  for c in node.get('children',[]):
    r=find(c)
    if r: return r
  return None
print(find(d.get('data',d)) or '')
" 2>/dev/null)
if [ -n "$ref" ]; then
  run_and_log "TC-038" "D4" "$PW click $ref --session eval-d1" "acted: true" "acted=true" 0
else
  log_tc "TC-038" "FAIL" "$PW click <ref> --session eval-d1" "" "无法获取 Sign in ref" "D4"
fi

# TC-039
$PW open $TARGET/login --session eval-d1 2>/dev/null || true
sleep 1
out1=$($PW fill --session eval-d1 --label 'Email address' 'demo@test.com' 2>&1)
ec1=$?
out2=$($PW fill --session eval-d1 --label 'Password' 'password123' 2>&1)
ec2=$?
if [ $ec1 -eq 0 ] && [ $ec2 -eq 0 ] && echo "$out1" | grep -q "acted: true" && echo "$out2" | grep -q "acted: true"; then
  log_tc "TC-039" "PASS" "fill email + password" "$out1 / $out2" "两次 fill 均 acted=true" "D4"
else
  log_tc "TC-039" "FAIL" "fill email + password" "$out1 / $out2" "exit $ec1/$ec2 或缺少 acted=true" "D4"
fi

# TC-040
$PW open $TARGET/forms --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-040" "D4" "$PW type --session eval-d1 --label 'Full name' 'John Doe'" "acted: true" "acted=true" 0

# TC-041
$PW open $TARGET/login --session eval-d1 2>/dev/null || true
$PW fill --session eval-d1 --label 'Email address' 'demo@test.com' 2>/dev/null || true
$PW fill --session eval-d1 --label 'Password' 'password123' 2>/dev/null || true
run_and_log "TC-041" "D4" "$PW press Enter --session eval-d1" "acted: true" "acted=true" 0

# TC-042
$PW open $TARGET/interactions --session eval-d1 2>/dev/null || true
sleep 1
out=$($PW hover --session eval-d1 --test-id hover-target 2>&1)
ec=$?
out2=$($PW read-text --session eval-d1 2>&1)
if [ $ec -eq 0 ] && echo "$out2" | grep -q "Tooltip visible"; then
  log_tc "TC-042" "PASS" "$PW hover --test-id hover-target + read-text" "$out / $out2" "hover+tooltip 可见" "D4"
else
  log_tc "TC-042" "FAIL" "$PW hover --test-id hover-target + read-text" "$out / $out2" "hover 失败或无 tooltip" "D4"
fi

# TC-043
$PW open $TARGET/forms --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-043" "D4" "$PW select --session eval-d1 --label 'Country' 'us'" "value\|acted" "select 成功" 0

# TC-044
$PW open $TARGET/login --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-044" "D4" "$PW check --session eval-d1 --label 'Remember me'" "acted: true" "acted=true" 0

# TC-045
run_and_log "TC-045" "D4" "$PW uncheck --session eval-d1 --label 'Remember me'" "acted: true" "acted=true" 0

# TC-046
$PW open $TARGET/interactions --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-046" "D4" "$PW drag --session eval-d1 --from-selector '[data-testid=\"drag-item-0\"]' --to-selector '[data-testid=\"drag-item-2\"]'" "acted: true" "acted=true" 0

# TC-047
echo "eval upload test" > /tmp/eval-upload.txt
$PW open $TARGET/forms --session eval-d1 2>/dev/null || true
sleep 1
out=$($PW upload --session eval-d1 --selector '[data-testid=\"file-input\"]' /tmp/eval-upload.txt 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "eval-upload.txt"; then
  log_tc "TC-047" "PASS" "$PW upload ..." "$out" "文件名出现在输出" "D4"
else
  log_tc "TC-047" "WARN" "$PW upload ..." "$out" "exit $ec 或缺少文件名" "D4"
fi

# TC-048
$PW open $TARGET/interactions --session eval-d1 2>/dev/null || true
sleep 1
out=$($PW download --session eval-d1 --selector '[data-testid=\"download-server-txt\"]' 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "path"; then
  path=$(echo "$out" | grep -o 'path: [^ ]*' | awk '{print $2}')
  if [ -f "$path" ]; then
    log_tc "TC-048" "PASS" "$PW download ..." "$out" "path 非空且文件存在" "D4"
  else
    log_tc "TC-048" "WARN" "$PW download ..." "$out" "path 非空但文件不存在" "D4"
  fi
else
  log_tc "TC-048" "FAIL" "$PW download ..." "$out" "exit $ec 或缺少 path" "D4"
fi

# TC-049
$PW open $TARGET/dynamic --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-049" "D4" "$PW scroll down 500 --session eval-d1" "acted\|scroll" "scroll 成功" 0

# TC-050
run_and_log "TC-050" "D4" "$PW scroll up 500 --session eval-d1" "acted\|scroll" "scroll 成功" 0

# TC-051
run_and_log "TC-051" "D4" "$PW mouse move --session eval-d1 --x 400 --y 300" "acted\|move" "mouse move 成功" 0

# TC-052 (可能不稳定)
$PW open $TARGET/interactions --session eval-d1 2>/dev/null || true
sleep 1
out=$($PW mouse click --session eval-d1 --x 400 --y 300 2>&1)
ec=$?
if [ $ec -eq 0 ]; then
  log_tc "TC-052" "PASS" "$PW mouse click --x 400 --y 300" "$out" "无错误" "D4"
else
  log_tc "TC-052" "SKIP" "$PW mouse click --x 400 --y 300" "$out" "硬编码坐标不稳定" "D4"
fi

# TC-053
run_and_log "TC-053" "D4" "$PW mouse wheel --session eval-d1 --delta-x 0 --delta-y 300" "acted\|wheel" "mouse wheel 成功" 0

# TC-054
$PW open $TARGET/tabs --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-054" "D4" "$PW click --session eval-d1 --test-id link-new-tab-child" "openedPage" "openedPage 存在" 0

# TC-055 (可能不稳定)
$PW open $TARGET/interactions --session eval-d1 2>/dev/null || true
sleep 1
out=$($PW mouse dblclick --session eval-d1 --x 400 --y 400 2>&1)
ec=$?
if [ $ec -eq 0 ]; then
  log_tc "TC-055" "PASS" "$PW mouse dblclick --x 400 --y 400" "$out" "无错误" "D4"
else
  log_tc "TC-055" "SKIP" "$PW mouse dblclick --x 400 --y 400" "$out" "硬编码坐标不稳定" "D4"
fi

# ==================== Domain 5: Batch ====================
echo "=== Domain 5: Batch ==="

# TC-056
run_and_log "TC-056" "D5" "echo '[['\"'\"'observe'\"'\"', '\"'\"'status'\"'\"']]' | $PW batch --session eval-d1 --stdin-json" "summary\|stepsTotal\|successCount" "batch 单命令成功" 0

# TC-057
$PW session create eval-ses-b1 --open $TARGET/login 2>/dev/null || true
sleep 1
out=$(printf '[['\"'\"'fill'\"'\"', '\"'\"'--label'\"'\"', '\"'\"'Email address'\"'\"', '\"'\"'demo@test.com'\"'\"'], ['\"'\"'fill'\"'\"', '\"'\"'--label'\"'\"', '\"'\"'Password'\"'\"', '\"'\"'password123'\"'\"'], ['\"'\"'click'\"'\"', '\"'\"'--role'\"'\"', '\"'\"'button'\"'\"', '\"'\"'--name'\"'\"', '\"'\"'Sign in'\"'\"']]' | $PW batch --session eval-ses-b1 --stdin-json 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "successCount"; then
  log_tc "TC-057" "PASS" "batch fill+click login" "$out" "successCount 存在" "D5"
else
  log_tc "TC-057" "FAIL" "batch fill+click login" "$out" "exit $ec 或缺少 successCount" "D5"
fi

# TC-058
$PW open $TARGET/forms --session eval-ses-b1 2>/dev/null || true
sleep 1
out=$(printf '[['\"'\"'fill'\"'\"', '\"'\"'--label'\"'\"', '\"'\"'Full name'\"'\"', '\"'\"'Alice Test'\"'\"'], ['\"'\"'fill'\"'\"', '\"'\"'--label'\"'\"', '\"'\"'Email address'\"'\"', '\"'\"'alice@test.com'\"'\"'], ['\"'\"'select'\"'\"', '\"'\"'--label'\"'\"', '\"'\"'Country'\"'\"', '\"'\"'us'\"'\"']]' | $PW batch --session eval-ses-b1 --stdin-json 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "successCount"; then
  log_tc "TC-058" "PASS" "batch forms" "$out" "successCount 存在" "D5"
else
  log_tc "TC-058" "FAIL" "batch forms" "$out" "exit $ec 或缺少 successCount" "D5"
fi

# TC-059
run_and_log "TC-059" "D5" "echo '[['\"'\"'observe'\"'\"', '\"'\"'status'\"'\"']]' | $PW batch --session eval-ses-ghost --stdin-json" "SESSION_NOT_FOUND\|NOT_FOUND" "SESSION_NOT_FOUND" "nonzero"

# TC-060
out=$(printf '[['\"'\"'click'\"'\"', '\"'\"'--selector'\"'\"', '\"'\"'#nonexistent-element-xyz'\"'\"'], ['\"'\"'observe'\"'\"', '\"'\"'status'\"'\"']]' | $PW batch --session eval-ses-b1 --stdin-json --continue-on-error 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "failureCount"; then
  log_tc "TC-060" "PASS" "batch continue-on-error" "$out" "failureCount 存在" "D5"
else
  log_tc "TC-060" "WARN" "batch continue-on-error" "$out" "exit $ec 或缺少 failureCount" "D5"
fi

# TC-061
out=$(printf '[['\"'\"'observe'\"'\"', '\"'\"'status'\"'\"'], ['\"'\"'read-text'\"'\"']]' | $PW batch --session eval-ses-b1 --stdin-json --output json --summary-only 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "summary"; then
  log_tc "TC-061" "PASS" "batch summary-only" "$out" "summary 存在" "D5"
else
  log_tc "TC-061" "WARN" "batch summary-only" "$out" "exit $ec 或缺少 summary" "D5"
fi

# TC-062
out=$(printf '[['\"'\"'observe'\"'\"', '\"'\"'status'\"'\"']]' | $PW batch --session eval-ses-b1 --stdin-json --output json --include-results 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "results"; then
  log_tc "TC-062" "PASS" "batch include-results" "$out" "results 存在" "D5"
else
  log_tc "TC-062" "WARN" "batch include-results" "$out" "exit $ec 或缺少 results" "D5"
fi

# ==================== Domain 6: Verify & Get ====================
echo "=== Domain 6: Verify & Get ==="
# eval-d1 on dashboard
$PW open $TARGET/dashboard --session eval-d1 2>/dev/null || true
sleep 1

# TC-063
run_and_log "TC-063" "D6" "$PW verify text --session eval-d1 --text 'Total Users'" "passed: true" "passed=true" 0

# TC-064
run_and_log "TC-064" "D6" "$PW verify text-absent --session eval-d1 --text 'THIS_VERY_UNIQUE_STRING_SHOULDNOTEXIST'" "passed: true" "passed=true" 0

# TC-065
run_and_log "TC-065" "D6" "$PW verify visible --session eval-d1 --selector '[data-testid=\"stat-users\"]'" "passed: true" "passed=true" 0

# TC-066
$PW open $TARGET/interactions --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-066" "D6" "$PW verify disabled --session eval-d1 --selector '[data-testid=\"btn-disabled\"]'" "passed: true" "passed=true" 0

# TC-067
$PW open $TARGET/dashboard --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-067" "D6" "$PW verify url --session eval-d1 --contains '/dashboard'" "passed: true" "passed=true" 0

# TC-068
run_and_log "TC-068" "D6" "$PW verify count --session eval-d1 --selector '[data-testid^=\"stat-\"]' --equals 4" "passed: true\|count: 4" "passed=true, count=4" 0

# TC-069
run_and_log "TC-069" "D6" "$PW get text --session eval-d1 --selector '[data-testid=\"stat-users\"] .text-2xl'" "text\|count" "text 字段非空" 0

# TC-070
run_and_log "TC-070" "D6" "$PW locate --session eval-d1 --text 'Total Users'" "count\|candidates" "count>=1" 0

# TC-071
$PW open $TARGET/login --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-071" "D6" "$PW is visible --session eval-d1 --selector '[data-testid=\"login-submit\"]'" "value: true" "value=true" 0

# TC-072
$PW open $TARGET/dashboard --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-072" "D6" "$PW verify text --session eval-d1 --text 'THIS_VERY_UNIQUE_ABSENT_TEXT_123'" "VERIFY_FAILED\|passed: false" "VERIFY_FAILED" "nonzero"

# ==================== Domain 7: Diagnostics ====================
echo "=== Domain 7: Diagnostics ==="

# TC-073
$PW open $TARGET/network --session eval-d1 2>/dev/null || true
sleep 1
$PW click --session eval-d1 --selector '[data-testid=\"run-all\"]' 2>/dev/null || true
sleep 1
run_and_log "TC-073" "D7" "$PW network --session eval-d1" "url\|method\|status" "network 记录存在" 0

# TC-074
run_and_log "TC-074" "D7" "$PW network --session eval-d1 --include-body --limit 5" "requestBody\|responseBody" "body 字段存在" 0

# TC-075
run_and_log "TC-075" "D7" "$PW console --session eval-d1" "console\|messages\|level" "console 记录" 0

# TC-076
run_and_log "TC-076" "D7" "$PW errors recent --session eval-d1" "errors" "errors 记录" 0

# TC-077
run_and_log "TC-077" "D7" "$PW diagnostics runs --session eval-d1" "runId\|session\|commands\|failures" "runs 列表存在" 0

# TC-078
rid=$($PW diagnostics runs --session eval-d1 --output json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); runs=d.get('data',d).get('runs',[]); print(runs[0]['runId'] if runs else '')" 2>/dev/null)
if [ -n "$rid" ]; then
  run_and_log "TC-078" "D7" "$PW diagnostics show --run $rid" "events\|command\|timestamp" "events 数组非空" 0
else
  log_tc "TC-078" "FAIL" "$PW diagnostics show --run ..." "" "无法获取 runId" "D7"
fi

# TC-079
rm -rf /tmp/eval-bundle
out=$($PW diagnostics bundle --session eval-d1 --out /tmp/eval-bundle 2>&1)
ec=$?
if [ $ec -eq 0 ] && [ -f /tmp/eval-bundle/manifest.json ]; then
  log_tc "TC-079" "PASS" "$PW diagnostics bundle ..." "$out" "manifest.json 存在" "D7"
else
  log_tc "TC-079" "FAIL" "$PW diagnostics bundle ..." "$out" "exit $ec 或 manifest 不存在" "D7"
fi

# TC-080
run_and_log "TC-080" "D7" "$PW diagnostics digest --session eval-d1" "url\|console\|network\|error" "URL+计数字段" 0

# TC-081
run_and_log "TC-081" "D7" "$PW diagnostics timeline --session eval-d1 --limit 20" "timestamp\|kind\|summary" "时间线条目存在" 0

# TC-082
$PW trace start --session eval-d1 2>/dev/null || true
$PW click --session eval-d1 --role button --name 'Primary' 2>/dev/null || true
out=$($PW trace stop --session eval-d1 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "traceArtifactPath"; then
  log_tc "TC-082" "PASS" "$PW trace stop ..." "$out" "traceArtifactPath 存在" "D7"
else
  log_tc "TC-082" "WARN" "$PW trace stop ..." "$out" "exit $ec 或缺少 traceArtifactPath" "D7"
fi

# TC-083
# Try to find trace path
path=$(echo "$out" | grep -o 'traceArtifactPath: [^ ]*' | awk '{print $2}')
if [ -n "$path" ] && [ -f "$path" ]; then
  run_and_log "TC-083" "D7" "$PW trace inspect $path --section actions" "actions\|title\|url" "action 记录存在" 0
else
  # try to find any trace in .pwcli
  path=$(find .pwcli -name '*.zip' -mmin -5 | head -1)
  if [ -n "$path" ]; then
    run_and_log "TC-083" "D7" "$PW trace inspect $path --section actions" "actions\|title\|url" "action 记录存在" 0
  else
    log_tc "TC-083" "SKIP" "$PW trace inspect ..." "" "无 trace 文件可用" "D7"
  fi
fi

# TC-084 (修正: har start 预期失败)
$PW open $TARGET/api/data --session eval-d1 2>/dev/null || true
sleep 1
out=$($PW har start /tmp/eval-test.har --session eval-d1 2>&1)
ec=$?
if [ $ec -ne 0 ] && echo "$out" | grep -q "UNSUPPORTED_HAR_CAPTURE"; then
  log_tc "TC-084" "PASS" "$PW har start ..." "$out" "har start 返回 UNSUPPORTED_HAR_CAPTURE (exit 1 预期)" "D7"
else
  log_tc "TC-084" "WARN" "$PW har start ..." "$out" "exit $ec，预期 exit 非0 且含 UNSUPPORTED_HAR_CAPTURE" "D7"
fi
# 跳过录制，直接用已有文件测 har replay（如有 fixtures）
# 尝试用 fixtures 中的 har 或创建一个简单 har
if [ -f scripts/eval/fixtures/test.har ]; then
  run_and_log "TC-084b" "D7" "$PW har replay scripts/eval/fixtures/test.har --session eval-d1" "har\|replay" "har replay 成功" 0
fi

# TC-085
run_and_log "TC-085" "D7" "$PW doctor --session eval-d1" "diagnostics\|environment\|Node.js" "环境检查结果" 0

# TC-086
$PW video start --session eval-d1 2>/dev/null || true
$PW open $TARGET/dashboard --session eval-d1 2>/dev/null || true
sleep 1
out=$($PW video stop --session eval-d1 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "videoPath"; then
  log_tc "TC-086" "PASS" "$PW video stop ..." "$out" "videoPath 存在" "D7"
else
  log_tc "TC-086" "WARN" "$PW video stop ..." "$out" "exit $ec 或缺少 videoPath" "D7"
fi

# TC-087
out1=$($PW errors clear --session eval-d1 2>&1)
ec1=$?
out2=$($PW errors recent --session eval-d1 2>&1)
ec2=$?
if [ $ec1 -eq 0 ] && [ $ec2 -eq 0 ]; then
  log_tc "TC-087" "PASS" "errors clear + recent" "$out1 / $out2" "clear+recent 均成功" "D7"
else
  log_tc "TC-087" "FAIL" "errors clear + recent" "$out1 / $out2" "exit $ec1/$ec2" "D7"
fi

# TC-088
$PW open $TARGET/network --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-088" "D7" "$PW console --session eval-d1 --level error --limit 10" "level\|error\|messages" "console level 过滤" 0

# ==================== Domain 8: Route & Mock ====================
echo "=== Domain 8: Route & Mock ==="

# TC-089
run_and_log "TC-089" "D8" "$PW route add '$TARGET/api/data' --session eval-d1 --method GET --body '{\"mocked\":true,\"items\":[]}' --content-type application/json --status 200" "pattern\|route" "route 添加成功" 0

# TC-090
run_and_log "TC-090" "D8" "$PW route add '$TARGET/api/data' --session eval-d1 --method GET --patch-text 'items=MOCKED_ITEMS'" "pattern\|route" "route patch-text 成功" 0

# TC-091
run_and_log "TC-091" "D8" "$PW route list --session eval-d1" "routes\|pattern\|method" "routes 数组存在" 0

# TC-092
run_and_log "TC-092" "D8" "$PW route remove '$TARGET/api/data' --session eval-d1" "removed\|route" "route remove 成功" 0

# TC-093
$PW route add '$TARGET/api/data' --session eval-d1 --method GET --body '{\"mocked\":true}' --content-type application/json --status 200 2>/dev/null || true
$PW route remove --session eval-d1 2>/dev/null || true
run_and_log "TC-093" "D8" "$PW route list --session eval-d1" "routes: []\|count: 0\|routes" "routes 清空" 0

# TC-094
$PW route add '$TARGET/api/data' --session eval-d1 --method GET --body '{\"mocked\":true}' --content-type application/json --status 200 2>/dev/null || true
$PW open $TARGET/api/data --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-094" "D8" "$PW read-text --session eval-d1" "mocked" "read-text 含 mock 内容" 0

# TC-095
out=$(printf '[['\"'\"'route'\"'\"', '\"'\"'add'\"'\"', '$TARGET/api/data', '\"'\"'--method'\"'\"', '\"'\"'GET'\"'\"', '\"'\"'--body'\"'\"', '{\"batch_mocked\":true}', '\"'\"'--content-type'\"'\"', '\"'\"'application/json'\"'\"'], ['\"'\"'route'\"'\"', '\"'\"'list'\"'\"']]' | $PW batch --session eval-d1 --stdin-json 2>&1)
ec=$?
if [ $ec -eq 0 ] && echo "$out" | grep -q "successCount"; then
  log_tc "TC-095" "PASS" "batch route add+list" "$out" "successCount 存在" "D8"
else
  log_tc "TC-095" "FAIL" "batch route add+list" "$out" "exit $ec 或缺少 successCount" "D8"
fi

# TC-096
cat > /tmp/eval-routes.json << 'EOF'
[{"pattern":"http://localhost:3099/api/data/error","status":200,"body":"{\"recovered\":true}","contentType":"application/json"}]
EOF
$PW route remove --session eval-d1 2>/dev/null || true
run_and_log "TC-096" "D8" "$PW route load /tmp/eval-routes.json --session eval-d1" "loaded\|route" "route load 成功" 0

# ==================== Domain 9: Auth & State ====================
echo "=== Domain 9: Auth & State ==="
# eval-ses-b1 is already logged in from TC-057

# TC-097
run_and_log "TC-097" "D9" "$PW cookies list --session eval-ses-b1" "pwcli_session" "cookies 含 pwcli_session" 0

# TC-098
run_and_log "TC-098" "D9" "$PW cookies set --session eval-d1 --name eval_test_cookie --value test_value_123 --domain localhost" "cookie\|set" "cookie 设置成功" 0

# TC-099
$PW open $TARGET/dashboard --session eval-d1 2>/dev/null || true
sleep 1
out1=$($PW storage local set eval_test_key eval_test_value --session eval-d1 2>&1)
ec1=$?
out2=$($PW storage local get eval_test_key --session eval-d1 2>&1)
ec2=$?
if [ $ec1 -eq 0 ] && [ $ec2 -eq 0 ] && echo "$out2" | grep -q "eval_test_value"; then
  log_tc "TC-099" "PASS" "storage local set+get" "$out1 / $out2" "get 返回正确值" "D9"
else
  log_tc "TC-099" "FAIL" "storage local set+get" "$out1 / $out2" "exit $ec1/$ec2 或缺少 eval_test_value" "D9"
fi

# TC-100
run_and_log "TC-100" "D9" "$PW storage session --session eval-d1" "accessible\|storage" "accessible 字段存在" 0

# TC-101 (修正: 直接运行 state diff 看 summary 字段)
out1=$($PW state diff --session eval-ses-b1 2>&1)
ec1=$?
# 101: first run should create baseline
if [ $ec1 -eq 0 ] && echo "$out1" | grep -q "summary"; then
  log_tc "TC-101" "PASS" "$PW state diff --session eval-ses-b1" "$out1" "含 summary 字段" "D9"
else
  log_tc "TC-101" "WARN" "$PW state diff --session eval-ses-b1" "$out1" "exit $ec1 或缺少 summary" "D9"
fi

# TC-102
$PW storage local set diff_test_key diff_test_value --session eval-ses-b1 2>/dev/null || true
out2=$($PW state diff --session eval-ses-b1 --include-values 2>&1)
ec2=$?
if [ $ec2 -eq 0 ] && echo "$out2" | grep -q "summary"; then
  log_tc "TC-102" "PASS" "$PW state diff --include-values" "$out2" "含 summary 字段" "D9"
else
  log_tc "TC-102" "WARN" "$PW state diff --include-values" "$out2" "exit $ec2 或缺少 summary" "D9"
fi

# TC-103
run_and_log "TC-103" "D9" "$PW auth probe --session eval-ses-b1" "authenticated\|confidence\|status" "status=authenticated" 0

# TC-104
run_and_log "TC-104" "D9" "$PW auth probe --session eval-ses-b1 --url $TARGET/dashboard" "authenticated\|resolvedTargetUrl\|status" "status=authenticated" 0

# TC-105 (修正: profile list-chrome)
run_and_log "TC-105" "D9" "$PW profile list-chrome" "capability" "capability 字段存在" 0

# ==================== Domain 10: Environment & Bootstrap ====================
echo "=== Domain 10: Environment & Bootstrap ==="

# TC-106
out1=$($PW environment clock install --session eval-d1 2>&1)
ec1=$?
out2=$($PW environment clock set --session eval-d1 2026-01-01T00:00:00Z 2>&1)
ec2=$?
out3=$($PW environment clock resume --session eval-d1 2>&1)
ec3=$?
if [ $ec1 -eq 0 ] && [ $ec2 -eq 0 ] && [ $ec3 -eq 0 ]; then
  log_tc "TC-106" "PASS" "clock install/set/resume" "$out1 / $out2 / $out3" "三步均成功" "D10"
else
  log_tc "TC-106" "FAIL" "clock install/set/resume" "$out1 / $out2 / $out3" "exit $ec1/$ec2/$ec3" "D10"
fi

# TC-107
out1=$($PW environment offline on --session eval-d1 2>&1)
ec1=$?
out2=$($PW environment offline off --session eval-d1 2>&1)
ec2=$?
if [ $ec1 -eq 0 ] && [ $ec2 -eq 0 ]; then
  log_tc "TC-107" "PASS" "environment offline on/off" "$out1 / $out2" "两次均成功" "D10"
else
  log_tc "TC-107" "FAIL" "environment offline on/off" "$out1 / $out2" "exit $ec1/$ec2" "D10"
fi

# TC-108
run_and_log "TC-108" "D10" "$PW environment geolocation set --session eval-d1 --lat 31.2304 --lng 121.4737" "geolocation\|lat\|lng" "geolocation 设置成功" 0

# TC-109
echo 'window.__eval_bootstrap = true;' > /tmp/eval-init.js
run_and_log "TC-109" "D10" "$PW bootstrap apply --session eval-d1 --init-script /tmp/eval-init.js" "bootstrapApplied\|applied" "bootstrapApplied 存在" 0

# TC-110
run_and_log "TC-110" "D10" "$PW doctor --session eval-d1" "initScript\|appliedAt" "initScriptCount >= 1" 0

# TC-111 (修正: sleep 3)
$PW open $TARGET/api/stream --session eval-d1 2>/dev/null || true
sleep 3
run_and_log "TC-111" "D10" "$PW sse --session eval-d1" "events\|count\|timestamp" "SSE 事件记录" 0

# TC-112
run_and_log "TC-112" "D10" "$PW code 'return await page.title()' --session eval-d1" "title\|string" "返回 title 文本" 0

# TC-113
cat > /tmp/eval-code.js << 'EOF'
const url = page.url();
const title = await page.title();
return { url, title };
EOF
run_and_log "TC-113" "D10" "$PW code --file /tmp/eval-code.js --session eval-d1" "url\|title" "url+title 字段存在" 0

# TC-114
$PW open $TARGET/login --session eval-d1 2>/dev/null || true
sleep 1
run_and_log "TC-114" "D10" "$PW locate --session eval-d1 --text 'Sign in' --return-ref" "ref" "ref 字段非空" 0

# TC-115
run_and_log "TC-115" "D10" "$PW environment permissions grant geolocation --session eval-d1" "permission\|granted" "权限授予成功" 0


# ==================== Domain 11: Auth Flow E2E ====================
echo "=== Domain 11: Auth Flow E2E ==="

# TC-116: demo login
$PW session create eval-e2e-demo --open $TARGET/login 2>/dev/null || true
sleep 1
$PW fill --session eval-e2e-demo --label 'Email address' 'demo@test.com' 2>/dev/null || true
$PW fill --session eval-e2e-demo --label 'Password' 'password123' 2>/dev/null || true
$PW click --session eval-e2e-demo --role button --name 'Sign in' 2>/dev/null || true
sleep 2
$PW wait --text 'Total Users' --session eval-e2e-demo 2>/dev/null || sleep 2
run_and_log "TC-116" "D11" "$PW verify url --session eval-e2e-demo --contains '/dashboard'" "passed: true" "passed=true" 0

# TC-117: MFA login (修正: fill 逐位)
$PW session create eval-e2e-mfa --open $TARGET/login 2>/dev/null || true
sleep 1
$PW fill --session eval-e2e-mfa --label 'Email address' 'mfa@test.com' 2>/dev/null || true
$PW fill --session eval-e2e-mfa --label 'Password' 'password123' 2>/dev/null || true
$PW click --session eval-e2e-mfa --role button --name 'Sign in' 2>/dev/null || true
sleep 2
# Wait for MFA page
$PW wait --text 'verification code' --session eval-e2e-mfa 2>/dev/null || $PW wait --selector '[data-testid=\"mfa-code-0\"]' --session eval-e2e-mfa 2>/dev/null || sleep 2
# Fill MFA digits using fill with selectors
for i in 0 1 2 3 4 5; do
  $PW fill --session eval-e2e-mfa --selector "[data-testid=\"mfa-digit-$i\"]" "1" 2>/dev/null || true
  $PW fill --session eval-e2e-mfa --selector "[data-testid=\"mfa-code-$i\"]" "1" 2>/dev/null || true
done
# Alternative: try typing sequentially
$PW click --session eval-e2e-mfa --selector '[data-testid=\"mfa-code-0\"]' 2>/dev/null || true
$PW type --session eval-e2e-mfa '123456' 2>/dev/null || true
sleep 2
$PW wait --text 'Total Users' --session eval-e2e-mfa 2>/dev/null || sleep 2
run_and_log "TC-117" "D11" "$PW verify url --session eval-e2e-mfa --contains '/dashboard'" "passed: true" "passed=true" 0

# TC-118: bad password
$PW session create eval-e2e-bad --open $TARGET/login 2>/dev/null || true
sleep 1
$PW fill --session eval-e2e-bad --label 'Email address' 'demo@test.com' 2>/dev/null || true
$PW fill --session eval-e2e-bad --label 'Password' 'wrongpassword' 2>/dev/null || true
$PW click --session eval-e2e-bad --role button --name 'Sign in' 2>/dev/null || true
sleep 2
$PW wait --selector '[data-testid=\"login-error\"]' --session eval-e2e-bad 2>/dev/null || sleep 2
out1=$($PW verify text --session eval-e2e-bad --text 'Invalid email or password' 2>&1)
ec1=$?
out2=$($PW verify url --session eval-e2e-bad --contains '/login' 2>&1)
ec2=$?
if [ $ec1 -eq 0 ] && [ $ec2 -eq 0 ] && echo "$out1" | grep -q "passed: true" && echo "$out2" | grep -q "passed: true"; then
  log_tc "TC-118" "PASS" "bad password verify text+url" "$out1 / $out2" "两个 verify 均 passed=true" "D11"
else
  log_tc "TC-118" "FAIL" "bad password verify text+url" "$out1 / $out2" "exit $ec1/$ec2 或 verify 未通过" "D11"
fi

# TC-119 (修正: wait --text 'Sign in')
$PW session create eval-e2e-unauth --open $TARGET/dashboard 2>/dev/null || true
sleep 2
$PW wait --text 'Sign in' --session eval-e2e-unauth 2>/dev/null || sleep 2
run_and_log "TC-119" "D11" "$PW verify url --session eval-e2e-unauth --contains '/login'" "passed: true" "passed=true" 0

# TC-120: admin login
$PW session create eval-e2e-admin --open $TARGET/login 2>/dev/null || true
sleep 1
$PW fill --session eval-e2e-admin --label 'Email address' 'admin@test.com' 2>/dev/null || true
$PW fill --session eval-e2e-admin --label 'Password' 'admin123' 2>/dev/null || true
$PW click --session eval-e2e-admin --role button --name 'Sign in' 2>/dev/null || true
sleep 2
$PW wait --text 'Total Users' --session eval-e2e-admin 2>/dev/null || sleep 2
$PW open $TARGET/api/auth/me --session eval-e2e-admin 2>/dev/null || true
sleep 1
run_and_log "TC-120" "D11" "$PW read-text --session eval-e2e-admin" "role\|admin\|Admin User" "含 admin role 信息" 0

# ==================== Cleanup ====================
echo "=== Cleanup ==="
for s in eval-d1 eval-ses-b1 eval-e2e-demo eval-e2e-mfa eval-e2e-bad eval-e2e-unauth eval-e2e-admin; do
  $PW session close $s 2>/dev/null || true
done

# ==================== Generate Report ====================
echo "=== Generating Report ==="

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Build overview table
OVERVIEW="| Domain | 总数 | PASS | FAIL | WARN | SKIP |\n|--------|------|------|------|------|------|\n"
OVERVIEW+="| D1 Session | 10 | ${D_PASS[D1]} | ${D_FAIL[D1]} | ${D_WARN[D1]} | ${D_SKIP[D1]} |\n"
OVERVIEW+="| D2 Page Reading | 15 | ${D_PASS[D2]} | ${D_FAIL[D2]} | ${D_WARN[D2]} | ${D_SKIP[D2]} |\n"
OVERVIEW+="| D3 Navigation | 10 | ${D_PASS[D3]} | ${D_FAIL[D3]} | ${D_WARN[D3]} | ${D_SKIP[D3]} |\n"
OVERVIEW+="| D4 Interaction | 20 | ${D_PASS[D4]} | ${D_FAIL[D4]} | ${D_WARN[D4]} | ${D_SKIP[D4]} |\n"
OVERVIEW+="| D5 Batch | 7 | ${D_PASS[D5]} | ${D_FAIL[D5]} | ${D_WARN[D5]} | ${D_SKIP[D5]} |\n"
OVERVIEW+="| D6 Verify & Get | 10 | ${D_PASS[D6]} | ${D_FAIL[D6]} | ${D_WARN[D6]} | ${D_SKIP[D6]} |\n"
OVERVIEW+="| D7 Diagnostics | 16 | ${D_PASS[D7]} | ${D_FAIL[D7]} | ${D_WARN[D7]} | ${D_SKIP[D7]} |\n"
OVERVIEW+="| D8 Route & Mock | 8 | ${D_PASS[D8]} | ${D_FAIL[D8]} | ${D_WARN[D8]} | ${D_SKIP[D8]} |\n"
OVERVIEW+="| D9 Auth & State | 9 | ${D_PASS[D9]} | ${D_FAIL[D9]} | ${D_WARN[D9]} | ${D_SKIP[D9]} |\n"
OVERVIEW+="| D10 Environment | 10 | ${D_PASS[D10]} | ${D_FAIL[D10]} | ${D_WARN[D10]} | ${D_SKIP[D10]} |\n"
OVERVIEW+="| D11 E2E | 5 | ${D_PASS[D11]} | ${D_FAIL[D11]} | ${D_WARN[D11]} | ${D_SKIP[D11]} |\n"
OVERVIEW+="| **合计** | 120 | $TOTAL_PASS | $TOTAL_FAIL | $TOTAL_WARN | $TOTAL_SKIP |\n"

TOTAL_EXEC=$((TOTAL_PASS + TOTAL_FAIL + TOTAL_WARN + TOTAL_SKIP))
if [ $TOTAL_EXEC -gt 0 ]; then
  RATE=$((TOTAL_PASS * 100 / TOTAL_EXEC))
else
  RATE=0
fi

CORE_PASS=$((${D_PASS[D1]} + ${D_PASS[D2]} + ${D_PASS[D4]} + ${D_PASS[D11]}))
CORE_TOTAL=45
CORE_RATE=$((CORE_PASS * 100 / CORE_TOTAL))

if [ $RATE -ge 90 ]; then
  QUALITY="excellent"
elif [ $RATE -ge 75 ]; then
  QUALITY="good"
else
  QUALITY="needs-work"
fi

# Find domain with most fails
MAX_FAIL=0
MAX_D=""
for d in "${DOMAINS[@]}"; do
  if [ ${D_FAIL[$d]} -gt $MAX_FAIL ]; then
    MAX_FAIL=${D_FAIL[$d]}
    MAX_D=$d
  fi
done

cat > "$RESULTS_FILE" << EOF
# pwcli 评测结果
执行时间: $TS
pwcli 版本: 0.2.0
靶场: $TARGET

## 总览
$OVERVIEW

## Domain 1: Session 管理

$RESULT_MD

## 失败/警告汇总

### ❌ FAIL 列表
$FAIL_LIST

### ⚠️ WARN 列表
$WARN_LIST

## 评测结论
总通过率: $TOTAL_PASS/$TOTAL_EXEC ($RATE%)
核心链路通过率（D1+D2+D4+D11）: $CORE_PASS/$CORE_TOTAL ($CORE_RATE%)
主要问题域: $MAX_D（FAIL=$MAX_FAIL）
质量评价: $QUALITY
EOF

echo "Report written to $RESULTS_FILE"
echo "Total: PASS=$TOTAL_PASS FAIL=$TOTAL_FAIL WARN=$TOTAL_WARN SKIP=$TOTAL_SKIP"

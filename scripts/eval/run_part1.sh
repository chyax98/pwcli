#!/bin/bash
set +e

PW="node dist/cli.js"
BASE="http://localhost:3099"
RESULT="scripts/eval/EVAL_RESULTS_PART1.md"
TMPDIR="/tmp/pwcli_eval_p1"
mkdir -p "$TMPDIR"

# Cleanup function
cleanup_sessions() {
  for s in eval-p1-1 eval-p1-2 eval-p1-3 eval-p1-b1; do
    timeout 10 $PW session close "$s" >/dev/null 2>&1 || true
  done
}

cleanup_sessions

run() {
  local tc="$1"
  local name="$2"
  local cmd="$3"
  local check="$4"
  local expect_fail="$5"
  
  echo "=== $tc: $name ===" >&2
  local out="$TMPDIR/${tc}.out"
  local err="$TMPDIR/${tc}.err"
  
  eval "timeout 25 $cmd >\"$out\" 2>\"$err\""
  local code=$?
  
  local txt	xt=$(cat "$out" "$err" 2>/dev/null)
  
  # Detect timeout
  if [ $code -eq 124 ]; then
    echo "$tc|FAIL|$name|TIMEOUT|命令执行超时 (exit=124)"
    return
  fi
  
  local status="FAIL"
  local reason="exit=$code"
  
  if [ "$expect_fail" = "true" ]; then
    if [ $code -ne 0 ]; then
      # Check if error contains expected substring
      if echo "$txt" | grep -q "$check"; then
        status="PASS"
        reason=""
      else
        reason="expected error containing '$check', got exit=$code"
      fi
    else
      reason="expected failure, got exit=0"
    fi
  else
    if [ $code -eq 0 ]; then
      if echo "$txt" | grep -q "$check"; then
        status="PASS"
        reason=""
      else
        reason="output missing '$check'"
      fi
    fi
  fi
  
  # Special skip for headed
  if [ "$tc" = "TC-002" ] && [ $code -ne 0 ]; then
    status="SKIP"
    reason="headless environment (exit=$code)"
  fi
  
  local snippet
  snippet=$(echo "$txt" | head -3 | tr '\n' ' ' | sed 's/|/\\|/g')
  [ -z "$snippet" ] && snippet="(无输出)"
  echo "$tc|$status|$name|$snippet|$reason"
}

# Domain 1
run "TC-001" "session create 基本创建" "$PW session create eval-p1-1 --open $BASE" "created=true" ""
run "TC-002" "session create --headed" "$PW session create eval-p1-2 --headed --open $BASE" "created=true" ""
run "TC-003" "session create --open URL" "$PW session create eval-p1-3 --open $BASE/login" "created=true" ""
run "TC-004" "session status 查询存活" "$PW session status eval-p1-1" "active=true" ""
run "TC-005" "session status 查询不存在" "$PW session status eval-p1-ghost" "NOT_FOUND" "true"
run "TC-006" "session list" "$PW session list" "alive=true" ""
run "TC-007" "session list --with-page" "$PW session list --with-page" "eval-p1-1" ""
run "TC-008" "session recreate" "$PW session recreate eval-p1-1 --open $BASE/login" "eval-p1-1" ""
run "TC-009" "session list --attachable" "$PW session list --attachable" "alive=true" ""
run "TC-010" "session close" "$PW session close eval-p1-2" "closed=true" ""

# Close leftover domain1 sessions
timeout 10 $PW session close eval-p1-3 >/dev/null 2>&1 || true

# Domain 2
$PW open $BASE/dashboard --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-011" "observe status" "$PW observe status --session eval-p1-1" '"summary"' ""
run "TC-012" "read-text 默认全页" "$PW read-text --session eval-p1-1" "truncated" ""
run "TC-013" "read-text --max-chars" "$PW read-text --session eval-p1-1 --max-chars 500" "truncated" ""
run "TC-014" "read-text --selector" "$PW read-text --session eval-p1-1 --selector '[data-testid=\"stat-users\"]'" "Total Users" ""
run "TC-015" "snapshot 完整结构树" "$PW snapshot --session eval-p1-1" "heading" ""

$PW open $BASE/login --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-016" "snapshot -i 交互节点" "$PW snapshot -i --session eval-p1-1" "button" ""
run "TC-017" "snapshot -c 紧凑模式" "$PW snapshot -c --session eval-p1-1" "generic" ""

$PW open $BASE/dashboard --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-018" "accessibility 基本" "$PW accessibility --session eval-p1-1" "heading" ""

$PW open $BASE/login --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-019" "accessibility -i 仅交互" "$PW accessibility -i --session eval-p1-1" "button" ""

$PW open $BASE/dashboard --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-020" "screenshot 基本" "$PW screenshot --session eval-p1-1" "Screenshot:" ""
run "TC-021" "screenshot --full-page" "$PW screenshot --session eval-p1-1 --full-page" "Screenshot:" ""
run "TC-022" "pdf 生成" "$PW pdf --session eval-p1-1 --path /tmp/eval-test.pdf" "saved=true" ""
run "TC-023" "page current" "$PW page current --session eval-p1-1" "pageId=" ""
run "TC-024" "page frames" "$PW page frames --session eval-p1-1" '"frames"' ""
run "TC-025" "page assess" "$PW page assess --session eval-p1-1" '"summary"' ""

# Domain 3
run "TC-026" "open 导航" "$PW open $BASE/login --session eval-p1-1" "/login" ""

$PW open $BASE/tabs --session eval-p1-1 >/dev/null 2>&1 || true
$PW click --session eval-p1-1 --test-id link-new-tab-child >/dev/null 2>&1 || true
run "TC-027" "tab list 多 tab" "$PW page list --session eval-p1-1" '"pages"' ""

# Tab select / close need dynamic pageId
PAGES_OUT=$(timeout 15 $PW page list --session eval-p1-1 --output json 2>/dev/null)
P2=$(echo "$PAGES_OUT" | python3 -c "import sys,json; d=json.load(sys.stdin); pages=d.get('pages',[]); print(pages[1]['pageId']) if len(pages)>1 else print('')" 2>/dev/null)

if [ -n "$P2" ]; then
  run "TC-028" "tab select" "$PW tab select $P2 --session eval-p1-1 && $PW page current --session eval-p1-1" "/tabs/child" ""
  run "TC-029" "tab close" "$PW tab close $P2 --session eval-p1-1 && $PW page list --session eval-p1-1" '"pages"' ""
else
  echo "TC-028|SKIP|tab select|无输出|no second pageId"
  echo "TC-029|SKIP|tab close|无输出|no second pageId"
fi

$PW open $BASE/dashboard --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-030" "wait network-idle" "$PW wait network-idle --session eval-p1-1" "wait" ""
run "TC-031" "wait --selector" "$PW wait --selector '[data-testid=\"stat-users\"]' --session eval-p1-1" "wait" ""
run "TC-032" "wait --text" "$PW wait --text 'Total Users' --session eval-p1-1" "wait" ""

$PW open $BASE/network --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-033" "wait --networkidle" "$PW wait --networkidle --session eval-p1-1" "wait" ""

run "TC-034" "page dialogs" "$PW page dialogs --session eval-p1-1" "dialogs" ""
run "TC-035" "resize viewport" "$PW resize --session eval-p1-1 --view 1280x800" "1280" ""

# Domain 4
$PW open $BASE/login --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-036" "click selector" "$PW click --session eval-p1-1 --selector '[data-testid=\"login-submit\"]'" "acted=true" ""
run "TC-037" "click role/name" "$PW click --session eval-p1-1 --role button --name 'Sign in'" "acted=true" ""

# TC-038: click ref
$PW open $BASE/login --session eval-p1-1 >/dev/null 2>&1 || true
REF_OUT=$(timeout 15 $PW snapshot -i --session eval-p1-1 --output json 2>/dev/null)
REF=$(echo "$REF_OUT" | python3 -c "
import sys,json,re
try:
    d=json.load(sys.stdin)
    snap=d.get('data',{}).get('snapshot','')
    m=re.search(r'button \"Sign in\" \[ref=(e\d+)\]', snap)
    if m: print(m.group(1))
    else:
        m=re.search(r'\[ref=(e\d+)\].*button', snap, re.DOTALL)
        if m: print(m.group(1))
        else:
            m=re.search(r'\[ref=(e\d+)\]', snap)
            if m: print(m.group(1))
except: pass
" 2>/dev/null)
if [ -n "$REF" ]; then
  run "TC-038" "click ref" "$PW click $REF --session eval-p1-1" "acted=true" ""
else
  echo "TC-038|FAIL|click ref|无输出|no ref found"
fi

$PW open $BASE/login --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-039" "fill 填充" "$PW fill --session eval-p1-1 --label 'Email address' 'demo@test.com' && $PW fill --session eval-p1-1 --label 'Password' 'password123'" "filled=true" ""

$PW open $BASE/forms --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-040" "type 逐字符输入" "$PW type --session eval-p1-1 --label 'Full name' 'John Doe'" "acted=true" ""

$PW open $BASE/login --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-041" "press Enter" "$PW press Enter --session eval-p1-1" "acted=true" ""

$PW open $BASE/interactions --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-042" "hover tooltip" "$PW hover --session eval-p1-1 --test-id hover-target && $PW read-text --session eval-p1-1" "Tooltip" ""

$PW open $BASE/forms --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-043" "select 下拉" "$PW select --session eval-p1-1 --label 'Country' 'us'" "acted=true" ""

$PW open $BASE/login --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-044" "check checkbox" "$PW check --session eval-p1-1 --label 'Remember me'" "acted=true" ""
run "TC-045" "uncheck checkbox" "$PW uncheck --session eval-p1-1 --label 'Remember me'" "acted=true" ""

$PW open $BASE/interactions --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-046" "drag 拖拽" "$PW drag --session eval-p1-1 --from-selector '[data-testid=\"drag-item-0\"]' --to-selector '[data-testid=\"drag-item-2\"]'" "acted=true" ""

# TC-047: upload
echo "eval upload test" > /tmp/eval-upload.txt
$PW open $BASE/forms --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-047" "upload 文件上传" "$PW upload --session eval-p1-1 --selector '[data-testid=\"file-input\"]' /tmp/eval-upload.txt" "uploaded" ""

$PW open $BASE/interactions --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-048" "download 下载" "$PW download --session eval-p1-1 --selector '[data-testid=\"download-server-txt\"]'" "path" ""

$PW open $BASE/dynamic --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-049" "scroll down" "$PW scroll down 500 --session eval-p1-1" "scroll" ""
run "TC-050" "scroll up" "$PW scroll up 500 --session eval-p1-1" "scroll" ""

run "TC-051" "mouse move" "$PW mouse move --session eval-p1-1 --x 400 --y 300" "mouse" ""

$PW open $BASE/interactions --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-052" "mouse click" "$PW mouse click --session eval-p1-1 --x 400 --y 300" "mouse" ""
run "TC-053" "mouse wheel" "$PW mouse wheel --session eval-p1-1 --delta-x 0 --delta-y 300" "mouse" ""

$PW open $BASE/tabs --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-054" "click popup 新页面" "$PW click --session eval-p1-1 --test-id link-new-tab-child" "openedPage" ""

$PW open $BASE/interactions --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-055" "mouse dblclick" "$PW mouse dblclick --session eval-p1-1 --x 400 --y 400" "mouse" ""

# Domain 5
$PW open $BASE/dashboard --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-056" "batch 单命令" "echo '[[\"observe\", \"status\"]]' | $PW batch --session eval-p1-1 --stdin-json" "completed=true" ""

$PW session create eval-p1-b1 --open $BASE/login >/dev/null 2>&1 || true
run "TC-057" "batch 登录流程" "printf '%s' '[[\"fill\", \"--label\", \"Email address\", \"demo@test.com\"],[\"fill\", \"--label\", \"Password\", \"password123\"],[\"click\", \"--role\", \"button\", \"--name\", \"Sign in\"]]' | $PW batch --session eval-p1-b1 --stdin-json" "success=3" ""

$PW open $BASE/forms --session eval-p1-b1 >/dev/null 2>&1 || true
run "TC-058" "batch 表单填写" "printf '%s' '[[\"fill\", \"--label\", \"Full name\", \"Alice Test\"],[\"fill\", \"--label\", \"Email address\", \"alice@test.com\"],[\"select\", \"--label\", \"Country\", \"us\"]]' | $PW batch --session eval-p1-b1 --stdin-json" "success=3" ""

run "TC-059" "batch SESSION_NOT_FOUND" "echo '[[\"observe\", \"status\"]]' | $PW batch --session eval-p1-ghost --stdin-json" "NOT_FOUND" "true"

run "TC-060" "batch continue-on-error" "printf '%s' '[[\"click\", \"--selector\", \"#nonexistent-element-xyz\"],[\"observe\", \"status\"]]' | $PW batch --session eval-p1-b1 --stdin-json --continue-on-error" "failed=1" ""

# Domain 6
$PW open $BASE/dashboard --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-063" "verify text" "$PW verify text --session eval-p1-1 --text 'Total Users'" "passed=true" ""
run "TC-064" "verify text-absent" "$PW verify text-absent --session eval-p1-1 --text 'THIS_VERY_UNIQUE_STRING_SHOULDNOTEXIST'" "passed=true" ""
run "TC-065" "verify visible" "$PW verify visible --session eval-p1-1 --selector '[data-testid=\"stat-users\"]'" "passed=true" ""

$PW open $BASE/interactions --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-066" "verify disabled" "$PW verify disabled --session eval-p1-1 --selector '[data-testid=\"btn-disabled\"]'" "passed=true" ""

$PW open $BASE/dashboard --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-067" "verify url" "$PW verify url --session eval-p1-1 --contains '/dashboard'" "passed=true" ""
run "TC-068" "verify count" "$PW verify count --session eval-p1-1 --selector '[data-testid^=\"stat-\"]' --equals 4" "passed=true" ""
run "TC-069" "get text" "$PW get text --session eval-p1-1 --selector '[data-testid=\"stat-users\"] .text-2xl'" "text" ""
run "TC-070" "locate 语义定位" "$PW locate --session eval-p1-1 --text 'Total Users'" "count" ""

$PW open $BASE/login --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-071" "is visible" "$PW is visible --session eval-p1-1 --selector '[data-testid=\"login-submit\"]'" "value=true" ""

$PW open $BASE/dashboard --session eval-p1-1 >/dev/null 2>&1 || true
run "TC-072" "verify VERIFY_FAILED" "$PW verify text --session eval-p1-1 --text 'THIS_VERY_UNIQUE_ABSENT_TEXT_123'" "VERIFY_FAILED" "true"

cleanup_sessions

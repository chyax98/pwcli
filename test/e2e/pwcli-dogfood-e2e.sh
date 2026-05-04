#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CLI=(node dist/cli.js)
PORT="${PWCLI_DOGFOOD_PORT:-43279}"
ORIGIN="http://127.0.0.1:${PORT}"
LOGIN_URL="${ORIGIN}/login"
REPRO_URL="${ORIGIN}/app/projects/alpha/incidents/checkout-timeout/reproduce"
RUN_ID="$(date +%H%M%S)$((RANDOM % 100))"
SESSION_NAME="dg${RUN_ID}"
SESSION_REUSE="${SESSION_NAME}b"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pwcli-dogfood.XXXXXX")"
HEADERS_FILE="${TMP_DIR}/headers.json"
ROUTE_INJECT_HEADERS_FILE="${TMP_DIR}/route-inject-headers.json"
STATE_FILE="${TMP_DIR}/auth.json"
UPLOAD_FILE="${TMP_DIR}/upload.txt"
DOWNLOAD_DIR="${TMP_DIR}/downloads"
BATCH_FILE="${TMP_DIR}/steps.json"
SERVER_LOG="${TMP_DIR}/dogfood-server.log"
WARNINGS_FILE="${TMP_DIR}/warnings.txt"
STEP_LOG="${TMP_DIR}/steps.jsonl"
SUMMARY_JSON="${TMP_DIR}/summary.json"
SERVER_PID=""
SESSION_CLOSED="0"
REUSE_CLOSED="0"

cleanup() {
  if [[ "$SESSION_CLOSED" != "1" ]]; then
    "${CLI[@]}" session close "$SESSION_NAME" >/dev/null 2>&1 || true
  fi
  if [[ "$REUSE_CLOSED" != "1" ]]; then
    "${CLI[@]}" session close "$SESSION_REUSE" >/dev/null 2>&1 || true
  fi
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

log() {
  printf '[dogfood] %s\n' "$*"
}

warn() {
  printf '[dogfood][warn] %s\n' "$*" | tee -a "$WARNINGS_FILE" >&2
}

run_json() {
  local name="$1"
  shift
  local out="${TMP_DIR}/${name}.json"
  node - "$STEP_LOG" "$name" "$@" <<'NODE'
const fs = require("node:fs");
const [file, name, ...command] = process.argv.slice(2);
fs.appendFileSync(file, JSON.stringify({ name, command }) + "\n");
NODE
  if ! "${CLI[@]}" "$@" --output json >"$out"; then
    log "command failed: ${CLI[*]} $* --output json"
    cat "$out" >&2 || true
    return 1
  fi
  printf '%s\n' "$out"
}

assert_json() {
  local file="$1"
  local label="$2"
  local expr="$3"
  node - "$file" "$label" "$expr" <<'NODE'
const fs = require('node:fs');

const [file, label, expr] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const fn = new Function('data', `return (${expr});`);

if (!fn(data)) {
  console.error(`[dogfood] assertion failed: ${label}`);
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}
NODE
}

json_field() {
  local file="$1"
  local expr="$2"
  node - "$file" "$expr" <<'NODE'
const fs = require('node:fs');

const [file, expr] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const fn = new Function('data', `return (${expr});`);
const value = fn(data);
if (value === undefined || value === null || value === '') {
  process.exit(1);
}
if (typeof value === 'object') {
  process.stdout.write(JSON.stringify(value));
  process.exit(0);
}
process.stdout.write(String(value));
NODE
}

assert_contains() {
  local file="$1"
  local needle="$2"
  if ! rg -q --fixed-strings "$needle" "$file"; then
    log "missing expected text: $needle"
    cat "$file" >&2 || true
    exit 1
  fi
}

printf '{"x-pwcli-header":"dogfood-1"}' >"$HEADERS_FILE"
printf '{"x-pwcli-route-inject":"dogfood"}' >"$ROUTE_INJECT_HEADERS_FILE"
printf 'upload-check\n' >"$UPLOAD_FILE"
mkdir -p "$DOWNLOAD_DIR"
cat >"$BATCH_FILE" <<'JSON'
[
  ["observe", "status"],
  ["page", "dialogs"],
  ["route", "list"]
]
JSON

log "starting dogfood server on ${ORIGIN}"
node test/fixtures/servers/dogfood-server.js "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID="$!"

for _ in $(seq 1 50); do
  if curl -sf "$LOGIN_URL" >/dev/null; then
    break
  fi
  sleep 0.2
done

if ! curl -sf "$LOGIN_URL" >/dev/null; then
  log "dogfood server did not become healthy"
  cat "$SERVER_LOG" >&2 || true
  exit 1
fi

log "session create login"
create_json="$(run_json create session create "$SESSION_NAME" --open "$LOGIN_URL")"
assert_json "$create_json" "session create landed on login" \
  "data.ok === true && data.page.url === '${LOGIN_URL}' && data.data.created === true"

log "login page inspection"
snapshot_json="$(run_json login-snapshot snapshot --session "$SESSION_NAME")"
assert_json "$snapshot_json" "login snapshot has title" \
  "data.ok === true && typeof data.data.snapshot === 'string' && data.data.snapshot.includes('pwcli dogfood login')"
login_submit_ref="$(json_field "$snapshot_json" "data.data.snapshot.match(/Sign in[^\\n]*\\[ref=([^\\]]+)\\]/)?.[1]")"
read_login_json="$(run_json login-read read-text --session "$SESSION_NAME" --max-chars 800)"
assert_json "$read_login_json" "login read text sees remember me" \
  "data.ok === true && data.data.text.includes('Remember me')"

log "login flow"
fill_email_json="$(run_json fill-email fill --session "$SESSION_NAME" --selector '#email' qa@example.com)"
assert_json "$fill_email_json" "email filled" "data.ok === true && data.data.filled === true"
fill_password_json="$(run_json fill-password fill --session "$SESSION_NAME" --selector '#password' pwcli-secret)"
assert_json "$fill_password_json" "password filled" "data.ok === true && data.data.filled === true"
click_login_json="$(run_json login-click click --session "$SESSION_NAME" --selector '#login-submit')"
assert_json "$click_login_json" "login clicked" "data.ok === true && data.data.acted === true"
wait_projects_json="$(run_json wait-projects wait --session "$SESSION_NAME" --selector '#project-alpha')"
assert_json "$wait_projects_json" "projects page visible" "data.ok === true && data.data.matched === true"
stale_ref_out="${TMP_DIR}/stale-login-ref.json"
if "${CLI[@]}" click --session "$SESSION_NAME" "$login_submit_ref" --output json >"$stale_ref_out"; then
  log "expected stale login ref to fail after navigation"
  cat "$stale_ref_out" >&2 || true
  exit 1
fi
assert_json "$stale_ref_out" "stale login ref surfaces structured recovery" \
  "data.ok === false && data.error.code === 'REF_STALE' && data.error.retryable === false && data.error.details.reason === 'navigation-changed' && data.error.details.ref === '${login_submit_ref}' && data.error.suggestions.some(item => item.includes('snapshot -i'))"

log "save auth state"
state_save_json="$(run_json state-save state save "$STATE_FILE" --session "$SESSION_NAME")"
assert_json "$state_save_json" "state saved" "data.ok === true && data.data.saved === true"
if [[ ! -f "$STATE_FILE" ]]; then
  warn "state save reported success but did not materialize ${STATE_FILE}"
fi

log "deep navigation"
click_alpha_json="$(run_json click-alpha click --session "$SESSION_NAME" --selector '#project-alpha')"
assert_json "$click_alpha_json" "project alpha clicked" "data.ok === true && data.data.acted === true"
wait_incidents_json="$(run_json wait-incidents wait --session "$SESSION_NAME" --selector '#alpha-incidents')"
assert_json "$wait_incidents_json" "alpha page visible" "data.ok === true && data.data.matched === true"
click_incidents_json="$(run_json click-incidents click --session "$SESSION_NAME" --selector '#alpha-incidents')"
assert_json "$click_incidents_json" "incidents clicked" "data.ok === true && data.data.acted === true"
wait_incident_row_json="$(run_json wait-incident-row wait --session "$SESSION_NAME" --selector '#incident-checkout-timeout')"
assert_json "$wait_incident_row_json" "incident row visible" "data.ok === true && data.data.matched === true"
click_incident_json="$(run_json click-incident click --session "$SESSION_NAME" --selector '#incident-checkout-timeout')"
assert_json "$click_incident_json" "incident clicked" "data.ok === true && data.data.acted === true"
wait_repro_link_json="$(run_json wait-repro-link wait --session "$SESSION_NAME" --selector '#open-reproduce')"
assert_json "$wait_repro_link_json" "reproduce link visible" "data.ok === true && data.data.matched === true"
click_repro_json="$(run_json click-repro click --session "$SESSION_NAME" --selector '#open-reproduce')"
assert_json "$click_repro_json" "reproduce clicked" "data.ok === true && data.data.acted === true"
wait_repro_json="$(run_json wait-repro wait --session "$SESSION_NAME" --selector '#trigger-bug')"
assert_json "$wait_repro_json" "reproduce workspace visible" "data.ok === true && data.data.matched === true"

log "workspace projection"
page_current_json="$(run_json page-current page current --session "$SESSION_NAME")"
assert_json "$page_current_json" "reproduce url active" \
  "data.ok === true && data.data.currentPage.url === '${REPRO_URL}'"
page_frames_json="$(run_json page-frames page frames --session "$SESSION_NAME")"
assert_json "$page_frames_json" "iframe visible" \
  "data.ok === true && data.data.frameCount >= 2"
observe_json="$(run_json observe observe status --session "$SESSION_NAME")"
assert_json "$observe_json" "observe status sees workspace" \
  "data.ok === true && data.data.summary.pageCount >= 1 && data.data.dialogs.count === 0"

log "summary request"
summary_click_json="$(run_json summary-click click --session "$SESSION_NAME" --selector '#load-summary')"
assert_json "$summary_click_json" "summary clicked" \
  "data.ok === true && data.data.acted === true && data.data.diagnosticsDelta.networkDelta >= 2"
summary_text_json="$(run_json summary-read read-text --session "$SESSION_NAME" --selector '#summary-result')"
assert_json "$summary_text_json" "summary text updated" \
  "data.ok === true && data.data.text.includes('checkout-timeout')"

log "trigger failing reproduce"
bug_click_json="$(run_json bug-click click --session "$SESSION_NAME" --selector '#trigger-bug')"
assert_json "$bug_click_json" "bug clicked" \
  "data.ok === true && data.data.acted === true && data.data.diagnosticsDelta.networkDelta >= 2"
bug_run_id="$(json_field "$bug_click_json" "data.data.run.runId")"
digest_session_json="$(run_json digest-session diagnostics digest --session "$SESSION_NAME")"
assert_json "$digest_session_json" "digest session sees http errors" \
  "data.ok === true && data.data.summary.httpErrorCount >= 1 && Array.isArray(data.data.topSignals) && data.data.topSignals.length >= 1"
network_fail_json="$(run_json network-fail network --session "$SESSION_NAME" --status 500 --limit 5)"
assert_json "$network_fail_json" "network query finds 500" \
  "data.ok === true && data.data.summary.total >= 1"
network_request_body_json="$(run_json network-request-body network --session "$SESSION_NAME" --url '/api/incidents/alpha/checkout-timeout/start' --kind request --method POST --limit 5)"
assert_json "$network_request_body_json" "network request snippet captures bug payload" \
  "data.ok === true && data.data.summary.sample.some(item => item.requestBodySnippet && item.requestBodySnippet.includes('fail500'))"

log "page error and console"
console_warn_click="$(run_json console-warn-click click --session "$SESSION_NAME" --selector '#throw-console-warning')"
assert_json "$console_warn_click" "warning clicked" "data.ok === true && data.data.acted === true"
console_error_click="$(run_json console-error-click click --session "$SESSION_NAME" --selector '#throw-console-error')"
assert_json "$console_error_click" "error clicked" "data.ok === true && data.data.acted === true"
page_error_click="$(run_json page-error-click click --session "$SESSION_NAME" --selector '#throw-page-error')"
assert_json "$page_error_click" "page error clicked" "data.ok === true && data.data.acted === true"
wait_error_json="$(run_json wait-error wait --session "$SESSION_NAME" 400)"
assert_json "$wait_error_json" "wait after page error" "data.ok === true && data.data.matched === true"
console_json="$(run_json console-query console --session "$SESSION_NAME" --text dogfood-console-error --limit 5)"
assert_json "$console_json" "console query finds emitted error" \
  "data.ok === true && data.data.summary.total >= 1"
errors_json="$(run_json errors-query errors recent --session "$SESSION_NAME" --text dogfood-page-error --limit 5)"
assert_json "$errors_json" "page errors query finds thrown error" \
  "data.ok === true && data.data.summary.visible >= 1 && data.data.errors[0].text.includes('dogfood-page-error')"

log "route add direct"
route_add_json="$(run_json route-add route add '**/api/incidents/alpha/checkout-timeout/mock-target**' --session "$SESSION_NAME" --method GET --body direct-route-success --status 208 --content-type text/plain)"
assert_json "$route_add_json" "route add direct ok" \
  "data.ok === true && data.data.added === true && data.data.route.method === 'GET'"
route_target_click_json="$(run_json route-target-click click --session "$SESSION_NAME" --selector '#route-target')"
assert_json "$route_target_click_json" "route target clicked" "data.ok === true && data.data.acted === true"
route_result_json="$(run_json route-result read-text --session "$SESSION_NAME" --selector '#mock-result')"
assert_json "$route_result_json" "direct route result visible" \
  "data.ok === true && data.data.text.includes('208:direct-route-success')"
route_remove_json="$(run_json route-remove route remove '**/api/incidents/alpha/checkout-timeout/mock-target**' --session "$SESSION_NAME")"
assert_json "$route_remove_json" "route removed" "data.ok === true && data.data.removed === true"
route_inject_json="$(run_json route-inject route add '**/api/incidents/alpha/checkout-timeout/mock-target**' --session "$SESSION_NAME" --method GET --inject-headers-file "$ROUTE_INJECT_HEADERS_FILE")"
assert_json "$route_inject_json" "route inject continue added" \
  "data.ok === true && data.data.route.mode === 'inject-continue' && data.data.route.injectHeaders['x-pwcli-route-inject'] === 'dogfood'"
route_inject_click_json="$(run_json route-inject-click click --session "$SESSION_NAME" --selector '#route-target')"
assert_json "$route_inject_click_json" "route target clicked with injected request headers" "data.ok === true && data.data.acted === true"
route_inject_result_json="$(run_json route-inject-result read-text --session "$SESSION_NAME" --selector '#mock-result')"
assert_json "$route_inject_result_json" "inject continue reaches server variant" \
  "data.ok === true && data.data.text.includes('206:server-route-injected:dogfood')"
route_inject_remove_json="$(run_json route-inject-remove route remove '**/api/incidents/alpha/checkout-timeout/mock-target**' --session "$SESSION_NAME")"
assert_json "$route_inject_remove_json" "inject route removed" "data.ok === true && data.data.removed === true"

log "route load file via batch"
route_load_batch_file="${TMP_DIR}/route-load-batch.json"
printf '[["route","load","./test/fixtures/data/dogfood-routes.json"]]\n' >"$route_load_batch_file"
route_load_json="$(run_json route-load batch --session "$SESSION_NAME" --file "$route_load_batch_file" --include-results)"
assert_json "$route_load_json" "route file loaded via batch" \
  "data.ok === true && data.data.summary.successCount === 1 && data.data.results[0].data.loadedCount >= 1"
route_list_json="$(run_json route-list route list --session "$SESSION_NAME")"
assert_json "$route_list_json" "route list populated" \
  "data.ok === true && data.data.routeCount >= 1"
route_file_click_json="$(run_json route-file-click click --session "$SESSION_NAME" --selector '#route-target')"
assert_json "$route_file_click_json" "route target clicked with file route" "data.ok === true && data.data.acted === true"
route_file_result_json="$(run_json route-file-result read-text --session "$SESSION_NAME" --selector '#mock-result')"
assert_json "$route_file_result_json" "route file result visible" \
  "data.ok === true && data.data.text.includes('209:route-file-success')"

log "route match-body"
route_match_body_json="$(run_json route-match-body route add '**/api/incidents/alpha/checkout-timeout/start**' --session "$SESSION_NAME" --method POST --match-body fail500 --body '{"ok":true,"mocked":true}' --status 200 --content-type application/json)"
assert_json "$route_match_body_json" "route match-body fulfill added" \
  "data.ok === true && data.data.route.mode === 'fulfill' && data.data.route.matchBody === 'fail500'"
route_match_click_json="$(run_json route-match-click click --session "$SESSION_NAME" --selector '#trigger-bug')"
assert_json "$route_match_click_json" "trigger bug clicked under match-body mock" \
  "data.ok === true && data.data.acted === true"
route_match_result_json="$(run_json route-match-result read-text --session "$SESSION_NAME" --selector '#bug-result')"
assert_json "$route_match_result_json" "match-body mock forces success path" \
  "data.ok === true && data.data.text.includes('bug-result: success')"
route_match_remove_json="$(run_json route-match-remove route remove '**/api/incidents/alpha/checkout-timeout/start**' --session "$SESSION_NAME")"
assert_json "$route_match_remove_json" "match-body route removed" "data.ok === true && data.data.removed === true"

log "route patch response"
route_patch_batch_file="${TMP_DIR}/route-patch-batch.json"
printf '[["route","load","./test/fixtures/data/dogfood-routes-patch.json"]]\n' >"$route_patch_batch_file"
route_patch_json="$(run_json route-patch batch --session "$SESSION_NAME" --file "$route_patch_batch_file" --include-results)"
assert_json "$route_patch_json" "route patch loaded from file via batch" \
  "data.ok === true && data.data.summary.successCount === 1 && data.data.results[0].data.loadedCount >= 1 && data.data.results[0].data.routes.some(item => item.mode === 'patch-response' && item.patchStatus === 298 && item.patchJson.severity === 'critical')"
summary_patch_click_json="$(run_json summary-patch-click click --session "$SESSION_NAME" --selector '#load-summary')"
assert_json "$summary_patch_click_json" "patched summary clicked" \
  "data.ok === true && data.data.acted === true"
summary_patch_text_json="$(run_json summary-patch-read read-text --session "$SESSION_NAME" --selector '#summary-result')"
assert_json "$summary_patch_text_json" "patched summary text visible" \
  "data.ok === true && data.data.text.includes('checkout-timeout-patched / critical')"
summary_patch_network_json="$(run_json summary-patch-network network --session "$SESSION_NAME" --url '/api/incidents/alpha/checkout-timeout/summary' --kind response --status 298 --limit 5)"
assert_json "$summary_patch_network_json" "patched summary status visible in diagnostics" \
  "data.ok === true && data.data.summary.total >= 1"
route_patch_remove_json="$(run_json route-patch-remove route remove '**/api/incidents/alpha/checkout-timeout/summary**' --session "$SESSION_NAME")"
assert_json "$route_patch_remove_json" "route patch removed" "data.ok === true && data.data.removed === true"

log "environment controls"
perm_json="$(run_json env-perm environment permissions grant geolocation --session "$SESSION_NAME")"
assert_json "$perm_json" "permission granted" "data.ok === true"
geo_json="$(run_json env-geo environment geolocation set --session "$SESSION_NAME" --lat 37.7749 --lng -122.4194 --accuracy 15)"
assert_json "$geo_json" "geolocation set" "data.ok === true"
geo_click_json="$(run_json geo-click click --session "$SESSION_NAME" --selector '#geo-probe')"
assert_json "$geo_click_json" "geo clicked" "data.ok === true && data.data.acted === true"
geo_wait_json="$(run_json geo-wait wait --session "$SESSION_NAME" --text 'geo-result: 37.7749,-122.4194')"
assert_json "$geo_wait_json" "geolocation rendered" "data.ok === true && data.data.matched === true"
offline_on_json="$(run_json offline-on environment offline on --session "$SESSION_NAME")"
assert_json "$offline_on_json" "offline on" "data.ok === true"
offline_click_json="$(run_json offline-click click --session "$SESSION_NAME" --selector '#offline-probe')"
assert_json "$offline_click_json" "offline probe clicked" "data.ok === true && data.data.acted === true"
offline_wait_json="$(run_json offline-wait wait --session "$SESSION_NAME" --text 'offline-result: TypeError: Failed to fetch')"
assert_json "$offline_wait_json" "offline failure visible" "data.ok === true && data.data.matched === true"
offline_off_json="$(run_json offline-off environment offline off --session "$SESSION_NAME")"
assert_json "$offline_off_json" "offline off" "data.ok === true"
clock_install_json="$(run_json clock-install environment clock install --session "$SESSION_NAME")"
assert_json "$clock_install_json" "clock install ok" "data.ok === true"
clock_set_json="$(run_json clock-set environment clock set --session "$SESSION_NAME" 2024-12-10T10:00:00.000Z)"
assert_json "$clock_set_json" "clock set ok" \
  "data.ok === true && data.data.clock.currentTime === '2024-12-10T10:00:00.000Z'"
clock_verify_json="$(run_json clock-verify code --session "$SESSION_NAME" --file ./test/fixtures/code/clock-verify.js)"
assert_json "$clock_verify_json" "clock verify sees updated date" \
  "data.ok === true && data.data.result.iso.startsWith('2024-12-10T10:00:00')"
clock_resume_json="$(run_json clock-resume environment clock resume --session "$SESSION_NAME")"
assert_json "$clock_resume_json" "clock resume ok" "data.ok === true"

log "upload drag download"
upload_json="$(run_json upload upload --session "$SESSION_NAME" --selector '#upload-input' "$UPLOAD_FILE")"
assert_json "$upload_json" "upload ok" "data.ok === true && data.data.uploaded === true"
upload_result_json="$(run_json upload-result read-text --session "$SESSION_NAME" --selector '#upload-result')"
assert_json "$upload_result_json" "upload result shows file" \
  "data.ok === true && data.data.text.includes('upload.txt')"
drag_json="$(run_json drag drag --session "$SESSION_NAME" --from-selector '#drag-card-a' --to-selector '#drag-lane-done')"
assert_json "$drag_json" "drag ok" "data.ok === true && data.data.dragged === true"
drag_result_json="$(run_json drag-result read-text --session "$SESSION_NAME" --selector '#drag-status')"
assert_json "$drag_result_json" "drag result updated" \
  "data.ok === true && data.data.text.includes('triage customer report')"
download_json="$(run_json download download --session "$SESSION_NAME" --selector '#download-report' --dir "$DOWNLOAD_DIR")"
assert_json "$download_json" "download ok" "data.ok === true && data.data.downloaded === true"
download_path="$(json_field "$download_json" "data.data.savedAs")"
if [[ ! -f "$download_path" ]]; then
  log "downloaded file missing: $download_path"
  exit 1
fi
assert_contains "$download_path" "dogfood-report:dogfood-1"

log "bootstrap and code"
bootstrap_apply_json="$(run_json bootstrap-apply bootstrap apply --session "$SESSION_NAME" --init-script ./test/fixtures/code/bootstrap-init.js --headers-file "$HEADERS_FILE")"
assert_json "$bootstrap_apply_json" "bootstrap applied" \
  "data.ok === true && data.data.applied === true"
open_repro_json="$(run_json open-repro open --session "$SESSION_NAME" "$REPRO_URL")"
assert_json "$open_repro_json" "reopened reproduce page" "data.ok === true && data.page.url === '${REPRO_URL}'"
bootstrap_verify_json="$(run_json bootstrap-verify code --session "$SESSION_NAME" --file ./test/fixtures/code/dogfood-bootstrap.js)"
assert_json "$bootstrap_verify_json" "bootstrap verify sees dogfood echo" \
  "data.ok === true && data.data.result.installed === true && data.data.result.fetchResult.headerEcho === 'dogfood-1' && data.data.result.xhrResult.headerEcho === 'dogfood-1'"

log "cookies and storage"
cookies_set_json="$(run_json cookies-set cookies set --session "$SESSION_NAME" --name pwcli-extra --value ok --domain 127.0.0.1)"
assert_json "$cookies_set_json" "cookie set ok" "data.ok === true && data.data.set === true"
cookies_list_json="$(run_json cookies-list cookies list --session "$SESSION_NAME" --domain 127.0.0.1)"
assert_json "$cookies_list_json" "cookie list sees auth" \
  "data.ok === true && data.data.count >= 1 && data.data.cookies.some(item => item.name === 'pwcli_auth')"
storage_local_json="$(run_json storage-local storage local --session "$SESSION_NAME")"
assert_json "$storage_local_json" "local storage readable" \
  "data.ok === true && data.data.accessible === true && data.data.entries['pwcli-auth'] === 'qa@example.com'"
storage_session_json="$(run_json storage-session storage session --session "$SESSION_NAME")"
assert_json "$storage_session_json" "session storage readable" \
  "data.ok === true && data.data.accessible === true && data.data.entries['pwcli-session'] === 'live'"

log "batch file"
batch_out="${TMP_DIR}/dogfood-batch.json"
if ! "${CLI[@]}" batch --session "$SESSION_NAME" --file "$BATCH_FILE" --output json >"$batch_out"; then
  log "command failed: ${CLI[*]} batch --session ${SESSION_NAME} --file ${BATCH_FILE} --output json"
  cat "$batch_out" >&2 || true
  exit 1
fi
assert_json "$batch_out" "batch file completed" \
  "data.ok === true && data.data.completed === true && data.data.results.length === 3 && data.data.results.every(item => item.ok === true)"

log "modal blockage and recovery"
modal_click_out="${TMP_DIR}/modal-click.json"
if ! "${CLI[@]}" click --session "$SESSION_NAME" --selector '#open-alert' --output json >"$modal_click_out"; then
  log "expected modal-triggering click to succeed with blocked state"
  cat "$modal_click_out" >&2 || true
  exit 1
fi
assert_json "$modal_click_out" "modal blockage surfaced on click result" \
  "data.ok === true && data.data.acted === true && data.data.modalPending === true && data.data.blockedState === 'MODAL_STATE_BLOCKED'"
modal_page_out="${TMP_DIR}/modal-page.json"
if "${CLI[@]}" page current --session "$SESSION_NAME" --output json >"$modal_page_out"; then
  log "expected modal blockage but page current succeeded"
  cat "$modal_page_out" >&2 || true
  exit 1
fi
assert_json "$modal_page_out" "modal blockage still blocks reads" \
  "data.ok === false && data.error.code === 'MODAL_STATE_BLOCKED'"
modal_doctor_json="$(run_json modal-doctor doctor --session "$SESSION_NAME" --endpoint "$REPRO_URL")"
assert_json "$modal_doctor_json" "doctor sees modal state" \
  "data.ok === true && data.data.diagnostics.some(item => item.kind === 'modal-state') && data.data.recovery.blocked === true"
dialog_accept_json="$(run_json dialog-accept dialog accept --session "$SESSION_NAME")"
assert_json "$dialog_accept_json" "dialog accepted" \
  "data.ok === true && data.command === 'dialog accept' && data.data.handled === true"
recovered_page_json="$(run_json recovered-page page current --session "$SESSION_NAME")"
assert_json "$recovered_page_json" "page current recovered after dialog accept" \
  "data.ok === true && data.data.currentPage.url === '${REPRO_URL}'"
recovered_read_json="$(run_json recovered-read read-text --session "$SESSION_NAME" --selector '#auth-state')"
assert_json "$recovered_read_json" "dialog recovery preserved auth state" \
  "data.ok === true && data.data.text.includes('cookie-present')"

log "diagnostics export and run queries"
export_json="$(run_json export diagnostics export --session "$SESSION_NAME" --out "${TMP_DIR}/diag-network.json" --section network --limit 10)"
assert_json "$export_json" "diagnostics export ok" "data.ok === true && data.data.exported === true"
if [[ ! -f "${TMP_DIR}/diag-network.json" ]]; then
  log "diagnostics export output missing"
  exit 1
fi
assert_contains "${TMP_DIR}/diag-network.json" "\"network\""
runs_filtered_json="$(run_json runs-filtered diagnostics runs --session "$SESSION_NAME" --since 2000-01-01T00:00:00.000Z --limit 20)"
assert_json "$runs_filtered_json" "runs filter keeps only current dogfood session" \
  "data.ok === true && data.data.count >= 1 && data.data.runs.every(item => item.sessionName === '${SESSION_NAME}')"
digest_run_json="$(run_json digest-run diagnostics digest --run "$bug_run_id")"
assert_json "$digest_run_json" "run digest available" \
  "data.ok === true && data.data.runId === '${bug_run_id}' && data.data.commandCount >= 1"
show_json="$(run_json show diagnostics show --run "$bug_run_id" --command click --limit 10)"
assert_json "$show_json" "show filtered by command" \
  "data.ok === true && data.data.count >= 1 && data.data.events.every(item => item.command === 'click')"
show_alias_json="$(run_json show-alias diagnostics show --run "$bug_run_id" --command click --limit 1 --fields at=ts,cmd=command,status=diagnosticsDelta.lastNetwork.status)"
assert_json "$show_alias_json" "show can alias projected fields" \
  "data.ok === true && data.data.events.length === 1 && data.data.events[0].cmd === 'click' && data.data.events[0].command === undefined"
grep_json="$(run_json grep diagnostics grep --run "$bug_run_id" --text CHECKOUT_TIMEOUT --limit 10)"
assert_json "$grep_json" "grep finds bug payload" \
  "data.ok === true && data.data.count >= 1"
export_text_json="$(run_json export-text diagnostics export --session "$SESSION_NAME" --out "${TMP_DIR}/diag-checkout.json" --section network --text fail500 --fields at=timestamp,method,url,body=requestBodySnippet)"
assert_json "$export_text_json" "diagnostics export can narrow by text and alias fields" \
  "data.ok === true && data.data.exported === true && data.data.text === 'fail500'"
assert_json "${TMP_DIR}/diag-checkout.json" "diagnostics export file keeps aliased request body snippet" \
  "Array.isArray(data.network) && data.network.some(item => item.method === 'POST' && typeof item.body === 'string' && item.body.includes('fail500'))"

log "state reuse on new session"
reuse_create_json="$(run_json reuse-create session create "$SESSION_REUSE" --open "$LOGIN_URL")"
assert_json "$reuse_create_json" "reuse session created" "data.ok === true && data.data.created === true"
reuse_load_json="$(run_json reuse-load state load "$STATE_FILE" --session "$SESSION_REUSE")"
assert_json "$reuse_load_json" "state loaded" "data.ok === true && data.data.loaded === true"
reuse_open_json="$(run_json reuse-open open --session "$SESSION_REUSE" "$REPRO_URL")"
assert_json "$reuse_open_json" "reuse session navigated" "data.ok === true"
reuse_read_json="$(run_json reuse-read read-text --session "$SESSION_REUSE" --selector '#auth-state')"
if ! node -e "const fs=require('node:fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.exit(data.ok===true && String(data.data.text||'').includes('cookie-present') ? 0 : 1)" "$reuse_read_json"; then
  warn "state load returned success but did not restore authenticated access on a fresh session"
fi

log "close sessions"
close_primary_json="$(run_json close-primary session close "$SESSION_NAME")"
assert_json "$close_primary_json" "primary session closed" "data.ok === true"
SESSION_CLOSED="1"
close_reuse_json="$(run_json close-reuse session close "$SESSION_REUSE")"
assert_json "$close_reuse_json" "reuse session closed" "data.ok === true"
REUSE_CLOSED="1"

if [[ -f "$WARNINGS_FILE" ]]; then
  log "warnings"
  cat "$WARNINGS_FILE"
fi

node test/e2e/render-summary.mjs \
  "$STEP_LOG" \
  "$WARNINGS_FILE" \
  "$SUMMARY_JSON" \
  "$SESSION_NAME" \
  "$SESSION_REUSE"
log "summary written to ${SUMMARY_JSON}"

log "dogfood e2e passed"

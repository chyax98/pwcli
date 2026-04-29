#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CLI=(node dist/cli.js --output json)
PORT="${PWCLI_FIXTURE_PORT:-43179}"
ORIGIN="http://127.0.0.1:${PORT}"
BLANK_URL="${ORIGIN}/blank"
RUN_ID="$(date +%H%M%S)$((RANDOM % 100))"
SESSION_NAME="sm${RUN_ID}"
AUTH_SESSION="${SESSION_NAME}a"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pwcli-smoke.XXXXXX")"
HEADERS_FILE="${TMP_DIR}/headers.json"
ROUTE_INJECT_HEADERS_FILE="${TMP_DIR}/route-inject-headers.json"
AUTH_STATE_FILE="${TMP_DIR}/auth-state.json"
SERVER_LOG="${TMP_DIR}/fixture-server.log"
SERVER_PID=""
SESSION_CLOSED="0"
AUTH_SESSION_CLOSED="0"

cleanup() {
  if [[ "$SESSION_CLOSED" != "1" ]]; then
    "${CLI[@]}" session close "$SESSION_NAME" >/dev/null 2>&1 || true
  fi
  if [[ "$AUTH_SESSION_CLOSED" != "1" ]]; then
    "${CLI[@]}" session close "$AUTH_SESSION" >/dev/null 2>&1 || true
  fi
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

log() {
  printf '[smoke] %s\n' "$*"
}

run_json() {
  local name="$1"
  shift
  local out="${TMP_DIR}/${name}.json"
  if ! "${CLI[@]}" "$@" >"$out"; then
    log "command failed: ${CLI[*]} $*"
    cat "$out" >&2 || true
    return 1
  fi
  printf '%s\n' "$out"
}

run_fail_json() {
  local name="$1"
  shift
  local out="${TMP_DIR}/${name}.json"
  if "${CLI[@]}" "$@" >"$out"; then
    log "command unexpectedly succeeded: ${CLI[*]} $*"
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
  console.error(`[smoke] assertion failed: ${label}`);
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

printf '{"x-pwcli-header":"smoke-1"}' >"$HEADERS_FILE"
printf '{"x-pwcli-route-mode":"smoke"}' >"$ROUTE_INJECT_HEADERS_FILE"

log "starting deterministic fixture server on ${ORIGIN}"
node scripts/manual/deterministic-fixture-server.js "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID="$!"

for _ in $(seq 1 50); do
  if curl -sf "$BLANK_URL" >/dev/null; then
    break
  fi
  sleep 0.2
done

if ! curl -sf "$BLANK_URL" >/dev/null; then
  log "fixture server did not become healthy"
  cat "$SERVER_LOG" >&2 || true
  exit 1
fi

log "action failure classifier contract"
node --input-type=module <<'NODE'
import { ActionFailure } from './dist/domain/interaction/action-failure.js';
import { throwManagedActionErrorText } from './dist/infra/playwright/runtime/action-failure-classifier.js';

function expectActionFailure(label, message, expectedCode) {
  try {
    throwManagedActionErrorText(message, { command: 'click', sessionName: 'smoke-a' });
  } catch (error) {
    if (!(error instanceof ActionFailure)) {
      console.error(`[smoke] ${label}: expected ActionFailure, got ${error?.constructor?.name ?? typeof error}`);
      process.exit(1);
    }
    if (error.code !== expectedCode) {
      console.error(`[smoke] ${label}: expected ${expectedCode}, got ${error.code}`);
      process.exit(1);
    }
    if (!error.retryable) {
      console.error(`[smoke] ${label}: expected retryable failure`);
      process.exit(1);
    }
    if (!Array.isArray(error.suggestions) || error.suggestions.length === 0) {
      console.error(`[smoke] ${label}: expected suggestions`);
      process.exit(1);
    }
    return;
  }
  console.error(`[smoke] ${label}: expected classifier to throw`);
  process.exit(1);
}

expectActionFailure(
  'stale ref',
  'Ref e17 not found in the current page snapshot',
  'REF_STALE',
);
expectActionFailure(
  'semantic not found',
  'CLICK_SEMANTIC_NOT_FOUND:{"target":{"kind":"text","text":"missing semantic smoke action"}}',
  'ACTION_TARGET_NOT_FOUND',
);
expectActionFailure(
  'semantic fill not found',
  'FILL_SEMANTIC_NOT_FOUND:{"target":{"kind":"label","label":"missing semantic smoke field"}}',
  'ACTION_TARGET_NOT_FOUND',
);
expectActionFailure(
  'semantic nth out of range',
  'CLICK_SEMANTIC_INDEX_OUT_OF_RANGE:{"target":{"kind":"text","text":"nth smoke action","nth":2},"count":1,"nth":2}',
  'ACTION_TARGET_INDEX_OUT_OF_RANGE',
);
expectActionFailure(
  'semantic type nth out of range',
  'TYPE_SEMANTIC_INDEX_OUT_OF_RANGE:{"target":{"kind":"role","role":"textbox","nth":3},"count":1,"nth":3}',
  'ACTION_TARGET_INDEX_OUT_OF_RANGE',
);
expectActionFailure(
  'strict ambiguous target',
  "locator.click: Error: strict mode violation: locator('.strict-smoke-target') resolved to 2 elements",
  'ACTION_TARGET_AMBIGUOUS',
);
expectActionFailure(
  'timeout not actionable',
  "locator.click: Timeout 25000ms exceeded.\nCall log:\n  - waiting for locator('#hidden-smoke-target')\n  - element is not visible",
  'ACTION_TIMEOUT_OR_NOT_ACTIONABLE',
);

try {
  throwManagedActionErrorText('No dialog visible', { command: 'dialog', sessionName: 'smoke-a' });
} catch (error) {
  if (error instanceof ActionFailure) {
    console.error('[smoke] unknown dialog error must not become ActionFailure');
    process.exit(1);
  }
  if (!(error instanceof Error) || error.message !== 'No dialog visible') {
    console.error('[smoke] unknown dialog error should preserve raw message');
    process.exit(1);
  }
}
NODE

log "session create"
create_json="$(run_json session-create session create "$SESSION_NAME" --open "$BLANK_URL")"
assert_json "$create_json" "session create ok" \
  "data.ok === true && data.command === 'session create' && data.data.created === true && data.page.url === '${BLANK_URL}'"

log "snapshot"
snapshot_json="$(run_json snapshot snapshot --session "$SESSION_NAME")"
assert_json "$snapshot_json" "snapshot contains fixture title" \
  "data.ok === true && typeof data.data.snapshot === 'string' && data.data.snapshot.includes('pwcli deterministic fixture')"
snapshot_compact_json="$(run_json snapshot-compact snapshot --compact --session "$SESSION_NAME")"
assert_json "$snapshot_compact_json" "compact snapshot is smaller" \
  "data.ok === true && data.data.mode === 'compact' && data.data.charCount <= data.data.totalCharCount && typeof data.data.snapshot === 'string'"
snapshot_interactive_json="$(run_json snapshot-interactive snapshot --interactive --session "$SESSION_NAME")"
assert_json "$snapshot_interactive_json" "interactive snapshot keeps only action-oriented lines" \
  "data.ok === true && data.data.mode === 'interactive' && data.data.charCount <= data.data.totalCharCount && typeof data.data.snapshot === 'string'"
overlay_code_json="$(run_json overlay-code code --session "$SESSION_NAME" "async page => { await page.evaluate(() => { const el = document.createElement('div'); el.className = 'ant-dropdown'; el.style.position = 'fixed'; el.style.left = '10px'; el.style.top = '10px'; el.textContent = 'overlay smoke option'; document.body.appendChild(el); }); return 'overlay-ready'; }")"
assert_json "$overlay_code_json" "overlay fixture installed" \
  "data.ok === true && data.data.result === 'overlay-ready'"
overlay_read_json="$(run_json overlay-read read-text --session "$SESSION_NAME" --include-overlay --max-chars 4000)"
assert_json "$overlay_read_json" "read-text can include overlay text" \
  "data.ok === true && data.data.source === 'body-visible+overlay' && data.data.overlays.some(item => item.text.includes('overlay smoke option')) && data.data.text.includes('overlay smoke option')"

log "page current"
page_json="$(run_json page-current page current --session "$SESSION_NAME")"
assert_json "$page_json" "page current points at fixture" \
  "data.ok === true && data.data.currentPage.url === '${BLANK_URL}' && data.data.pageCount >= 1"

log "tab select and close"
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';

const source = readFileSync('./dist/infra/playwright/runtime/workspace.js', 'utf8');
if (/\btab-close\b/.test(source)) {
  console.error('[smoke] workspace pageId close must not call index-based tab-close primitive');
  process.exit(1);
}
NODE
tab_second_url="${ORIGIN}/second-tab"
tab_popup_url="${ORIGIN}/popup-tab"
tab_create_json="$(run_json tab-create code --session "$SESSION_NAME" "async page => { const context = page.context(); const unrelated = await context.newPage(); await unrelated.goto('${tab_second_url}'); await page.bringToFront(); const popupPromise = context.waitForEvent('page'); await page.evaluate(url => window.open(url, '_blank'), '${tab_popup_url}'); const popup = await popupPromise; await popup.waitForLoadState('domcontentloaded'); await popup.bringToFront(); return { openerUrl: page.url(), unrelatedUrl: unrelated.url(), popupUrl: popup.url() }; }")"
assert_json "$tab_create_json" "unrelated tab and popup created" \
  "data.ok === true && data.data.result.openerUrl === '${BLANK_URL}' && data.data.result.unrelatedUrl === '${tab_second_url}' && data.data.result.popupUrl === '${tab_popup_url}'"
tab_list_before_json="$(run_json tab-list-before page list --session "$SESSION_NAME")"
assert_json "$tab_list_before_json" "page list sees popup opener relationship" \
  "data.ok === true && data.data.pageCount === 3 && data.data.pages.some(item => item.url === '${BLANK_URL}') && data.data.pages.some(item => item.url === '${tab_second_url}') && data.data.pages.some(item => item.url === '${tab_popup_url}')"
first_page_id="$(json_field "$tab_list_before_json" "data.data.pages.find(item => item.url === '${BLANK_URL}').pageId")"
second_page_id="$(json_field "$tab_list_before_json" "data.data.pages.find(item => item.url === '${tab_second_url}').pageId")"
popup_page_id="$(json_field "$tab_list_before_json" "data.data.pages.find(item => item.url === '${tab_popup_url}').pageId")"
assert_json "$tab_list_before_json" "popup openerPageId points at opener pageId" \
  "data.data.pages.find(item => item.url === '${tab_popup_url}').openerPageId === '${first_page_id}'"
tab_select_json="$(run_json tab-select tab select "$second_page_id" --session "$SESSION_NAME")"
assert_json "$tab_select_json" "tab select switches by pageId" \
  "data.ok === true && data.data.selected === true && data.data.activePageId === '${second_page_id}' && data.data.currentPage.url === '${tab_second_url}'"
tab_select_popup_json="$(run_json tab-select-popup tab select "$popup_page_id" --session "$SESSION_NAME")"
assert_json "$tab_select_popup_json" "tab select switches to popup by pageId" \
  "data.ok === true && data.data.selected === true && data.data.activePageId === '${popup_page_id}' && data.data.currentPage.url === '${tab_popup_url}'"
tab_close_popup_json="$(run_json tab-close-popup tab close "$popup_page_id" --session "$SESSION_NAME")"
assert_json "$tab_close_popup_json" "tab close active popup falls back to opener, not adjacent tab" \
  "data.ok === true && data.data.closed === true && data.data.closedPageId === '${popup_page_id}' && data.data.fallbackPageId === '${first_page_id}' && data.data.activePageId === '${first_page_id}' && data.data.pageCount === 2 && data.data.currentPage.url === '${BLANK_URL}'"
tab_close_json="$(run_json tab-close tab close "$second_page_id" --session "$SESSION_NAME")"
assert_json "$tab_close_json" "tab close removes unrelated page and keeps current opener" \
  "data.ok === true && data.data.closed === true && data.data.closedPageId === '${second_page_id}' && data.data.activePageId === '${first_page_id}' && data.data.pageCount === 1 && data.data.currentPage.url === '${BLANK_URL}'"

log "session list"
session_list_json="$(run_json session-list session list)"
assert_json "$session_list_json" "session list is lightweight by default" \
  "data.ok === true && data.data.withPage === false && data.data.sessions.some(item => item.name === '${SESSION_NAME}' && item.page === undefined)"
session_list_with_page_json="$(run_json session-list-with-page session list --with-page)"
assert_json "$session_list_with_page_json" "session list can include page summaries on demand" \
  "data.ok === true && data.data.withPage === true && data.data.sessions.some(item => item.name === '${SESSION_NAME}' && item.page && item.page.url === '${BLANK_URL}')"

log "auth provider discovery"
auth_list_json="$(run_json auth-list auth list)"
assert_json "$auth_list_json" "auth list exposes built-in providers" \
  "data.ok === true && data.data.providers.some(item => item.name === 'dc') && data.data.providers.some(item => item.name === 'fixture-auth') && !data.data.providers.some(item => item.name === 'dc-login')"
auth_info_dc_json="$(run_json auth-info-dc auth info dc)"
assert_json "$auth_info_dc_json" "auth info exposes dc contract" \
  "data.ok === true && data.data.name === 'dc' && data.data.args.some(item => item.name === 'targetUrl') && !data.data.args.some(item => item.name === 'instance')"
node --input-type=module <<'NODE'
import { getAuthProvider, loadAuthProviderSource } from './dist/infra/auth-providers/registry.js';

const provider = getAuthProvider('dc');
const source = provider ? loadAuthProviderSource(provider) : '';
const outerSource = source.split('page.evaluate')[0] ?? source;

if (/\bnew\s+URL\b|\bURLSearchParams\b/.test(outerSource)) {
  console.error('[smoke] dc auth outer provider source must not depend on URL globals');
  process.exit(1);
}
NODE
auth_info_json="$(run_json auth-info auth info fixture-auth)"
assert_json "$auth_info_json" "auth info exposes fixture-auth contract" \
  "data.ok === true && data.data.name === 'fixture-auth' && data.data.args.some(item => item.name === 'marker')"
auth_apply_json="$(run_json auth-apply auth fixture-auth --session "$SESSION_NAME" --arg marker=smoke-auth --save-state "$AUTH_STATE_FILE")"
assert_json "$auth_apply_json" "auth provider executes and saves state" \
  "data.ok === true && data.data.provider === 'fixture-auth' && data.data.pageState.authMarker === 'smoke-auth' && data.data.stateSaved === '${AUTH_STATE_FILE}'"
storage_after_auth_json="$(run_json storage-after-auth storage local --session "$SESSION_NAME")"
assert_json "$storage_after_auth_json" "auth provider writes local storage marker" \
  "data.ok === true && data.data.entries['pwcli-auth-marker'] === 'smoke-auth'"
cookies_after_auth_json="$(run_json cookies-after-auth cookies list --session "$SESSION_NAME")"
assert_json "$cookies_after_auth_json" "auth provider writes cookie marker" \
  "data.ok === true && data.data.cookies.some(item => item.name === 'pwcli_auth_marker' && item.value === 'smoke-auth')"

log "auth state reuse"
auth_session_create_json="$(run_json auth-session-create session create "$AUTH_SESSION" --open "$BLANK_URL")"
assert_json "$auth_session_create_json" "auth reuse session created" \
  "data.ok === true && data.data.created === true"
auth_state_load_json="$(run_json auth-state-load state load "$AUTH_STATE_FILE" --session "$AUTH_SESSION")"
assert_json "$auth_state_load_json" "auth state file loaded" \
  "data.ok === true && data.data.loaded === true"
auth_storage_reuse_json="$(run_json auth-storage-reuse storage local --session "$AUTH_SESSION")"
assert_json "$auth_storage_reuse_json" "auth state restores local storage marker" \
  "data.ok === true && data.data.entries['pwcli-auth-marker'] === 'smoke-auth'"
auth_cookies_reuse_json="$(run_json auth-cookies-reuse cookies list --session "$AUTH_SESSION")"
assert_json "$auth_cookies_reuse_json" "auth state restores cookie marker" \
  "data.ok === true && data.data.cookies.some(item => item.name === 'pwcli_auth_marker' && item.value === 'smoke-auth')"
auth_session_close_json="$(run_json auth-session-close session close "$AUTH_SESSION")"
assert_json "$auth_session_close_json" "auth reuse session closed" \
  "data.ok === true && data.command === 'session close'"
AUTH_SESSION_CLOSED="1"

log "observe status"
observe_json="$(run_json observe-status observe status --session "$SESSION_NAME")"
assert_json "$observe_json" "observe status workspace is healthy" \
  "data.ok === true && data.data.summary.pageCount >= 1 && data.data.bootstrap.applied === false"

log "batch surfaces"
batch_out="${TMP_DIR}/batch.json"
if ! printf '[["observe","status"],["page","dialogs"]]' | "${CLI[@]}" batch --session "$SESSION_NAME" --json >"$batch_out"; then
  log "command failed: ${CLI[*]} batch --session ${SESSION_NAME} --json"
  cat "$batch_out" >&2 || true
  exit 1
fi
batch_json="$batch_out"
assert_json "$batch_json" "batch completed" \
  "data.ok === true && data.data.completed === true && Array.isArray(data.data.results) && data.data.results.length === 2 && data.data.results.every(item => item.ok === true)"
assert_json "$batch_json" "batch summary reflects successful execution" \
  "data.ok === true && data.data.summary.stepCount === 2 && data.data.summary.successCount === 2 && data.data.summary.failedCount === 0 && data.data.summary.firstFailedStep === null"

batch_fail_out="${TMP_DIR}/batch-fail.json"
if ! printf '[ [\"session\",\"list\"] ]' | "${CLI[@]}" --output json batch --session "$SESSION_NAME" --stdin-json >"$batch_fail_out"; then
  log "command failed: ${CLI[*]} --output json batch --session ${SESSION_NAME} --stdin-json"
  cat "$batch_fail_out" >&2 || true
  exit 1
fi
batch_fail_json="$batch_fail_out"
assert_json "$batch_fail_json" "batch failed step exposes summary and reason code" \
  "data.ok === true && data.data.summary.stepCount === 1 && data.data.summary.successCount === 0 && data.data.summary.failedCount === 1 && data.data.summary.firstFailedStep === 1 && data.data.summary.firstFailedCommand === 'session' && data.data.summary.failedSteps.length === 1 && data.data.summary.failedSteps[0].step === 1 && data.data.summary.failedSteps[0].command === 'session' && Array.isArray(data.data.results) && data.data.results.length === 1 && data.data.results[0].ok === false"

batch_verbose_out="${TMP_DIR}/batch-verbose.json"
if ! printf '[["observe","status"],["page","dialogs"]]' | "${CLI[@]}" --output json batch --session "$SESSION_NAME" --stdin-json --include-results >"$batch_verbose_out"; then
  log "command failed: ${CLI[*]} --output json batch --session ${SESSION_NAME} --stdin-json --include-results"
  cat "$batch_verbose_out" >&2 || true
  exit 1
fi
batch_verbose_json="$batch_verbose_out"
assert_json "$batch_verbose_json" "batch include-results keeps full step outputs when requested" \
  "data.ok === true && Array.isArray(data.data.results) && data.data.results.length === 2 && data.data.results.every(item => item.ok === true)"

batch_summary_only_out="${TMP_DIR}/batch-summary-only.json"
if ! printf '[["observe","status"],["page","dialogs"]]' | "${CLI[@]}" --output json batch --session "$SESSION_NAME" --stdin-json --summary-only >"$batch_summary_only_out"; then
  log "command failed: ${CLI[*]} --output json batch --session ${SESSION_NAME} --stdin-json --summary-only"
  cat "$batch_summary_only_out" >&2 || true
  exit 1
fi
batch_summary_only_json="$batch_summary_only_out"
assert_json "$batch_summary_only_json" "batch summary-only omits full step outputs when requested" \
  "data.ok === true && data.data.completed === true && data.data.summary.stepCount === 2 && data.data.results === undefined"

log "bootstrap apply"
bootstrap_json="$(run_json bootstrap-apply bootstrap apply --session "$SESSION_NAME" --init-script ./scripts/manual/bootstrap-fixture.js --headers-file "$HEADERS_FILE")"
assert_json "$bootstrap_json" "bootstrap applied" \
  "data.ok === true && data.data.applied === true && data.data.headersApplied === true && data.data.initScriptCount >= 1"

log "post-bootstrap navigation"
open_json="$(run_json open open --session "$SESSION_NAME" "$BLANK_URL")"
assert_json "$open_json" "open reused session" \
  "data.ok === true && data.data.navigated === true && data.page.url === '${BLANK_URL}'"

log "bootstrap verify"
bootstrap_verify_json="$(run_json bootstrap-verify code --session "$SESSION_NAME" --file ./scripts/manual/bootstrap-verify.js)"
assert_json "$bootstrap_verify_json" "bootstrap verify sees injected hooks" \
  "data.ok === true && data.data.result.installed === true && data.data.result.fetchResult.headerEcho === 'smoke-1' && data.data.result.xhrResult.headerEcho === 'smoke-1'"

log "route add"
route_json="$(run_json route-add route add '**/__pwcli__/diagnostics/route-hit**' --session "$SESSION_NAME" --body routed-from-pwcli --status 211 --content-type text/plain)"
assert_json "$route_json" "route add ok" \
  "data.ok === true && data.data.added === true && data.data.route.status === 211"

log "diagnostics fixture setup"
code_json="$(run_json diagnostics-code code --session "$SESSION_NAME" --file ./scripts/manual/diagnostics-fixture.js)"
assert_json "$code_json" "diagnostics fixture ready" \
  "data.ok === true && data.data.result === 'ready'"

log "semantic click evidence"
semantic_target_json="$(run_json semantic-target code --session "$SESSION_NAME" "async page => { await page.evaluate(() => { const button = document.createElement('button'); button.type = 'button'; button.textContent = 'semantic smoke action'; button.addEventListener('click', () => console.log('semantic-click-smoke')); document.body.appendChild(button); }); return 'semantic-target-ready'; }")"
assert_json "$semantic_target_json" "semantic click target installed" \
  "data.ok === true && data.data.result === 'semantic-target-ready'"
semantic_click_json="$(run_json semantic-click click --session "$SESSION_NAME" --text 'semantic smoke action')"
assert_json "$semantic_click_json" "semantic click records action evidence" \
  "data.ok === true && data.data.acted === true && data.page.url === '${BLANK_URL}' && data.data.target.text === 'semantic smoke action' && data.data.target.nth === 1 && data.data.diagnosticsDelta.consoleDelta >= 1 && typeof data.data.run.runId === 'string'"
SEMANTIC_RUN_ID="$(json_field "$semantic_click_json" "data.data.run.runId")"
semantic_show_json="$(run_json semantic-click-show diagnostics show --run "$SEMANTIC_RUN_ID" --command click --limit 1)"
assert_json "$semantic_show_json" "semantic click run preserves locator target" \
  "data.ok === true && data.data.events.length === 1 && data.data.events[0].target.text === 'semantic smoke action' && data.data.events[0].target.nth === 1"
semantic_missing_json="$(run_fail_json semantic-missing click --session "$SESSION_NAME" --text 'missing semantic smoke action')"
assert_json "$semantic_missing_json" "semantic missing target preserves action failure envelope" \
  "data.ok === false && data.error.code === 'ACTION_TARGET_NOT_FOUND' && data.error.retryable === true && data.error.message.includes('CLICK_SEMANTIC_NOT_FOUND') && data.error.suggestions.some(item => item.includes('snapshot -i')) && data.error.details.command === 'click'"

log "semantic fill and type evidence"
semantic_form_json="$(run_json semantic-form code --session "$SESSION_NAME" "async page => { await page.evaluate(() => { const root = document.createElement('form'); root.innerHTML = '<label>Email <input id=\"semantic-email\" data-testid=\"semantic-email\" placeholder=\"Email address\" /></label><label>Comment <textarea aria-label=\"Comment box\" placeholder=\"Comment body\"></textarea></label><input data-testid=\"semantic-search\" placeholder=\"Search terms\" />'; document.body.appendChild(root); }); return 'semantic-form-ready'; }")"
assert_json "$semantic_form_json" "semantic form target installed" \
  "data.ok === true && data.data.result === 'semantic-form-ready'"
semantic_fill_label_json="$(run_json semantic-fill-label fill --session "$SESSION_NAME" --label Email 'agent@example.com')"
assert_json "$semantic_fill_label_json" "semantic fill by label records action evidence" \
  "data.ok === true && data.data.filled === true && data.data.target.label === 'Email' && data.data.target.nth === 1 && typeof data.data.run.runId === 'string'"
semantic_fill_value_json="$(run_json semantic-fill-value code --session "$SESSION_NAME" "async page => page.locator('#semantic-email').inputValue()")"
assert_json "$semantic_fill_value_json" "semantic fill by label changed value" \
  "data.ok === true && data.data.result === 'agent@example.com'"
semantic_fill_testid_json="$(run_json semantic-fill-testid fill --session "$SESSION_NAME" --testid semantic-search 'pwcli search')"
assert_json "$semantic_fill_testid_json" "semantic fill by testid records target" \
  "data.ok === true && data.data.filled === true && data.data.target.testid === 'semantic-search'"
semantic_type_role_json="$(run_json semantic-type-role type --session "$SESSION_NAME" --role textbox --name 'Comment box' ' typed comment')"
assert_json "$semantic_type_role_json" "semantic type by role records target" \
  "data.ok === true && data.data.typed === true && data.data.target.role === 'textbox' && data.data.target.name === 'Comment box'"
semantic_type_value_json="$(run_json semantic-type-value code --session "$SESSION_NAME" "async page => page.getByLabel('Comment box').inputValue()")"
assert_json "$semantic_type_value_json" "semantic type by role changed value" \
  "data.ok === true && data.data.result === ' typed comment'"
semantic_fill_missing_json="$(run_fail_json semantic-fill-missing fill --session "$SESSION_NAME" --label 'Missing Email' 'x')"
assert_json "$semantic_fill_missing_json" "semantic fill missing target preserves action failure envelope" \
  "data.ok === false && data.error.code === 'ACTION_TARGET_NOT_FOUND' && data.error.retryable === true && data.error.details.command === 'fill'"

log "fire diagnostics"
click_json="$(run_json click-fire click --session "$SESSION_NAME" --selector '#fire')"
assert_json "$click_json" "click fire acted" \
  "data.ok === true && data.data.acted === true"

log "console delta"
console_json="$(run_json console console --session "$SESSION_NAME" --text fixture-route-hit-run-1)"
assert_json "$console_json" "console captured route hit log" \
  "data.ok === true && data.data.summary.total >= 1 && data.data.summary.sample[0].text.includes('fixture-route-hit-run-1')"
console_source_json="$(run_json console-source console --session "$SESSION_NAME" --source app --text fixture-route-hit-run-1)"
assert_json "$console_source_json" "console source filter works" \
  "data.ok === true && data.data.summary.source === 'app' && data.data.summary.total >= 1"
console_resource_code_json="$(run_json console-resource-code code --session "$SESSION_NAME" "async page => { await page.evaluate(() => console.error('Failed to load resource: the server responded with a status of 401 ()')); return 'console-resource-error'; }")"
assert_json "$console_resource_code_json" "console resource error emitted" \
  "data.ok === true && data.data.result === 'console-resource-error'"
console_since_zero_json="$(run_json console-since-zero console --session "$SESSION_NAME" --since 2099-01-01T00:00:00.000Z)"
assert_json "$console_since_zero_json" "console since filter can exclude all rows" \
  "data.ok === true && data.data.summary.total === 0"

log "network delta"
network_json="$(run_json network network --session "$SESSION_NAME" --resource-type xhr)"
assert_json "$network_json" "network captured xhr" \
  "data.ok === true && data.data.summary.total >= 2 && data.data.summary.sample.some(item => item.kind === 'response' && item.status === 201)"
network_snippet_json="$(run_json network-snippet network --session "$SESSION_NAME" --url '/__pwcli__/diagnostics/xhr' --kind response --limit 5)"
assert_json "$network_snippet_json" "network response snippet is captured for text responses" \
  "data.ok === true && data.data.summary.sample.some(item => item.responseBodySnippet && item.responseBodySnippet.includes('xhr:1'))"
network_console_status_json="$(run_json network-console-status network --session "$SESSION_NAME" --status 401 --kind console-resource-error --limit 5)"
assert_json "$network_console_status_json" "network can bridge console resource status errors" \
  "data.ok === true && data.data.summary.total >= 1 && data.data.summary.sample.some(item => item.kind === 'console-resource-error' && item.status === 401)"
network_since_zero_json="$(run_json network-since-zero network --session "$SESSION_NAME" --since 2099-01-01T00:00:00.000Z)"
assert_json "$network_since_zero_json" "network since filter can exclude all rows" \
  "data.ok === true && data.data.summary.total === 0"

log "page errors"
errors_json="$(run_json errors errors recent --session "$SESSION_NAME")"
assert_json "$errors_json" "page errors captured fixture throw" \
  "data.ok === true && data.data.summary.visible >= 1 && data.data.errors[0].text.includes('fixture-page-error-run-1')"
errors_since_zero_json="$(run_json errors-since-zero errors recent --session "$SESSION_NAME" --since 2099-01-01T00:00:00.000Z)"
assert_json "$errors_since_zero_json" "errors since filter can exclude all rows" \
  "data.ok === true && data.data.summary.matched === 0 && data.data.errors.length === 0"

RUN_ID="$(json_field "$click_json" "data.data.run.runId")"

log "diagnostics digest session"
digest_session_json="$(run_json diagnostics-digest-session diagnostics digest --session "$SESSION_NAME")"
assert_json "$digest_session_json" "diagnostics digest session exposes top signals" \
  "data.ok === true && data.data.source === 'session' && data.data.summary.pageErrorCount >= 1 && Array.isArray(data.data.topSignals) && data.data.topSignals.length >= 1"

log "diagnostics runs"
runs_json="$(run_json diagnostics-runs diagnostics runs)"
assert_json "$runs_json" "diagnostics runs exposes run metadata" \
  "data.ok === true && data.data.count >= 1 && Array.isArray(data.data.runs) && typeof data.data.runs[0].runId === 'string' && typeof data.data.runs[0].commandCount === 'number'"
runs_filtered_json="$(run_json diagnostics-runs-filtered diagnostics runs --session "$SESSION_NAME" --since 2000-01-01T00:00:00.000Z --limit 20)"
assert_json "$runs_filtered_json" "diagnostics runs can filter by session and since" \
  "data.ok === true && data.data.count >= 1 && data.data.runs.every(item => item.sessionName === '${SESSION_NAME}')"

log "diagnostics digest run"
digest_run_json="$(run_json diagnostics-digest-run diagnostics digest --run "$RUN_ID")"
assert_json "$digest_run_json" "diagnostics digest run exposes recent step summary" \
  "data.ok === true && data.data.source === 'run' && data.data.runId === '${RUN_ID}' && data.data.commandCount >= 1 && Array.isArray(data.data.recentSteps)"

log "diagnostics show filtered"
show_run_json="$(run_json diagnostics-show-run diagnostics show --run "$RUN_ID" --command click --limit 5)"
assert_json "$show_run_json" "diagnostics show filters by command" \
  "data.ok === true && data.data.runId === '${RUN_ID}' && data.data.count >= 1 && data.data.events.every(item => item.command === 'click')"
show_run_fields_json="$(run_json diagnostics-show-fields diagnostics show --run "$RUN_ID" --command click --limit 1 --fields ts,command,diagnosticsDelta.consoleDelta)"
assert_json "$show_run_fields_json" "diagnostics show can project event fields" \
  "data.ok === true && data.data.events.length === 1 && data.data.events[0].command === 'click' && data.data.events[0].diagnosticsDelta && data.data.events[0].pageId === undefined"
show_run_alias_json="$(run_json diagnostics-show-fields-alias diagnostics show --run "$RUN_ID" --command click --limit 1 --fields at=ts,cmd=command,network=diagnosticsDelta.networkDelta)"
assert_json "$show_run_alias_json" "diagnostics show can alias projected fields" \
  "data.ok === true && data.data.events.length === 1 && data.data.events[0].cmd === 'click' && data.data.events[0].command === undefined && typeof data.data.events[0].network === 'number'"

log "diagnostics grep filtered"
grep_run_json="$(run_json diagnostics-grep-run diagnostics grep --run "$RUN_ID" --text fixture-route-hit-run-1 --command click --limit 5)"
assert_json "$grep_run_json" "diagnostics grep filters by command and text" \
  "data.ok === true && data.data.runId === '${RUN_ID}' && data.data.count >= 1 && data.data.events.every(item => item.command === 'click')"

log "diagnostics export filtered"
export_since_json="$(run_json diagnostics-export-since diagnostics export --session "$SESSION_NAME" --out "${TMP_DIR}/diag-since.json" --since 2099-01-01T00:00:00.000Z)"
assert_json "$export_since_json" "diagnostics export accepts since without section or limit" \
  "data.ok === true && data.data.exported === true && data.data.since === '2099-01-01T00:00:00.000Z'"
assert_json "${TMP_DIR}/diag-since.json" "diagnostics export since filters all record arrays" \
  "Array.isArray(data.console) && data.console.length === 0 && Array.isArray(data.network) && data.network.length === 0 && Array.isArray(data.errors) && data.errors.length === 0"
export_text_json="$(run_json diagnostics-export-text diagnostics export --session "$SESSION_NAME" --out "${TMP_DIR}/diag-text.json" --section network --text xhr:1 --fields at=timestamp,kind,status,snippet=responseBodySnippet)"
assert_json "$export_text_json" "diagnostics export accepts text and aliased fields" \
  "data.ok === true && data.data.exported === true && data.data.text === 'xhr:1'"
assert_json "${TMP_DIR}/diag-text.json" "diagnostics export text filters projected network rows" \
  "data.section === 'network' && Array.isArray(data.network) && data.network.length >= 1 && data.network.every(item => item.kind === 'response' && typeof item.snippet === 'string' && item.snippet.includes('xhr:1') && item.url === undefined)"

log "route inject continue"
route_remove_json="$(run_json route-remove route remove '**/__pwcli__/diagnostics/route-hit**' --session "$SESSION_NAME")"
assert_json "$route_remove_json" "route removed before inject scenario" \
  "data.ok === true && data.data.removed === true"
route_inject_json="$(run_json route-inject route add '**/__pwcli__/diagnostics/route-hit**' --session "$SESSION_NAME" --inject-headers-file "$ROUTE_INJECT_HEADERS_FILE")"
assert_json "$route_inject_json" "route inject continue added" \
  "data.ok === true && data.data.route.mode === 'inject-continue' && data.data.route.injectHeaders['x-pwcli-route-mode'] === 'smoke'"
route_only_click_json="$(run_json route-only-click click --session "$SESSION_NAME" --selector '#route-only')"
assert_json "$route_only_click_json" "route-only click acted" \
  "data.ok === true && data.data.acted === true"
route_only_result_json="$(run_json route-only-result read-text --session "$SESSION_NAME" --selector '#last-route-result')"
assert_json "$route_only_result_json" "inject continue reaches server variant" \
  "data.ok === true && data.data.text.includes('206:server-route-injected:2:smoke')"

log "route patch response"
route_patch_json="$(run_json route-patch route add '**/__pwcli__/diagnostics/json**' --session "$SESSION_NAME" --patch-json '{"severity":"critical","meta":{"patched":true}}' --patch-status 218)"
assert_json "$route_patch_json" "route patch added" \
  "data.ok === true && data.data.route.mode === 'patch-response' && data.data.route.patchStatus === 218 && data.data.route.patchJson.severity === 'critical'"
route_patch_verify_json="$(run_json route-patch-verify code --session "$SESSION_NAME" --file ./scripts/manual/route-patch-verify.js)"
assert_json "$route_patch_verify_json" "route patch rewrites upstream json response" \
  "data.ok === true && data.data.result.status === 218 && data.data.result.payload.severity === 'critical' && data.data.result.payload.meta.patched === true && data.data.result.payload.meta.source === 'server'"

log "environment clock"
clock_install_json="$(run_json clock-install environment clock install --session "$SESSION_NAME")"
assert_json "$clock_install_json" "clock install ok" \
  "data.ok === true && data.data.clock.installed === true"
clock_set_json="$(run_json clock-set environment clock set --session "$SESSION_NAME" 2024-12-10T10:00:00.000Z)"
assert_json "$clock_set_json" "clock set uses stable method" \
  "data.ok === true && data.data.clock.currentTime === '2024-12-10T10:00:00.000Z' && (data.data.clock.setMethod === 'setFixedTime' || data.data.clock.setMethod === 'setSystemTime')"
clock_verify_json="$(run_json clock-verify code --session "$SESSION_NAME" --file ./scripts/manual/clock-verify.js)"
assert_json "$clock_verify_json" "clock verify sees updated date" \
  "data.ok === true && data.data.result.iso.startsWith('2024-12-10T10:00:00')"
clock_resume_json="$(run_json clock-resume environment clock resume --session "$SESSION_NAME")"
assert_json "$clock_resume_json" "clock resume ok" \
  "data.ok === true && data.data.clock.installed === true && data.data.clock.paused === false"

log "doctor"
doctor_json="$(run_json doctor doctor --session "$SESSION_NAME" --endpoint "$BLANK_URL")"
assert_json "$doctor_json" "doctor sees session and endpoint healthy" \
  "data.ok === true && data.data.healthy === true && data.diagnostics.some(item => item.kind === 'endpoint-reachability' && item.status === 'ok') && data.data.recovery.blocked === false"

log "session close"
close_json="$(run_json session-close session close "$SESSION_NAME")"
assert_json "$close_json" "session close ok" \
  "data.ok === true && data.command === 'session close'"
SESSION_CLOSED="1"

log "smoke passed"

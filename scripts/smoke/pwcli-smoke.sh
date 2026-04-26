#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CLI=(node dist/cli.js)
PORT="${PWCLI_FIXTURE_PORT:-43179}"
ORIGIN="http://127.0.0.1:${PORT}"
BLANK_URL="${ORIGIN}/blank"
RUN_ID="$(date +%H%M%S)$((RANDOM % 100))"
SESSION_NAME="sm${RUN_ID}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pwcli-smoke.XXXXXX")"
HEADERS_FILE="${TMP_DIR}/headers.json"
SERVER_LOG="${TMP_DIR}/fixture-server.log"
SERVER_PID=""
SESSION_CLOSED="0"

cleanup() {
  if [[ "$SESSION_CLOSED" != "1" ]]; then
    "${CLI[@]}" session close "$SESSION_NAME" >/dev/null 2>&1 || true
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

log "session create"
create_json="$(run_json session-create session create "$SESSION_NAME" --open "$BLANK_URL")"
assert_json "$create_json" "session create ok" \
  "data.ok === true && data.command === 'session create' && data.data.created === true && data.page.url === '${BLANK_URL}'"

log "snapshot"
snapshot_json="$(run_json snapshot snapshot --session "$SESSION_NAME")"
assert_json "$snapshot_json" "snapshot contains fixture title" \
  "data.ok === true && typeof data.data.snapshot === 'string' && data.data.snapshot.includes('pwcli deterministic fixture')"

log "page current"
page_json="$(run_json page-current page current --session "$SESSION_NAME")"
assert_json "$page_json" "page current points at fixture" \
  "data.ok === true && data.data.currentPage.url === '${BLANK_URL}' && data.data.pageCount >= 1"

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

log "fire diagnostics"
click_json="$(run_json click-fire click --session "$SESSION_NAME" --selector '#fire')"
assert_json "$click_json" "click fire acted" \
  "data.ok === true && data.data.acted === true"

log "console delta"
console_json="$(run_json console console --session "$SESSION_NAME" --text fixture-route-hit-run-1)"
assert_json "$console_json" "console captured route hit log" \
  "data.ok === true && data.data.summary.total >= 1 && data.data.summary.sample[0].text.includes('fixture-route-hit-run-1')"

log "network delta"
network_json="$(run_json network network --session "$SESSION_NAME" --resource-type xhr)"
assert_json "$network_json" "network captured xhr" \
  "data.ok === true && data.data.summary.total >= 2 && data.data.summary.sample.some(item => item.kind === 'response' && item.status === 201)"

log "page errors"
errors_json="$(run_json errors errors recent --session "$SESSION_NAME")"
assert_json "$errors_json" "page errors captured fixture throw" \
  "data.ok === true && data.data.summary.visible >= 1 && data.data.errors[0].text.includes('fixture-page-error-run-1')"

RUN_ID="$(json_field "$click_json" "data.data.run.runId")"

log "diagnostics digest session"
digest_session_json="$(run_json diagnostics-digest-session diagnostics digest --session "$SESSION_NAME")"
assert_json "$digest_session_json" "diagnostics digest session exposes top signals" \
  "data.ok === true && data.data.source === 'session' && data.data.summary.pageErrorCount >= 1 && Array.isArray(data.data.topSignals) && data.data.topSignals.length >= 1"

log "diagnostics runs"
runs_json="$(run_json diagnostics-runs diagnostics runs)"
assert_json "$runs_json" "diagnostics runs exposes run metadata" \
  "data.ok === true && data.data.count >= 1 && Array.isArray(data.data.runs) && typeof data.data.runs[0].runId === 'string' && typeof data.data.runs[0].commandCount === 'number'"

log "diagnostics digest run"
digest_run_json="$(run_json diagnostics-digest-run diagnostics digest --run "$RUN_ID")"
assert_json "$digest_run_json" "diagnostics digest run exposes recent step summary" \
  "data.ok === true && data.data.source === 'run' && data.data.runId === '${RUN_ID}' && data.data.commandCount >= 1 && Array.isArray(data.data.recentSteps)"

log "diagnostics show filtered"
show_run_json="$(run_json diagnostics-show-run diagnostics show --run "$RUN_ID" --command click --limit 5)"
assert_json "$show_run_json" "diagnostics show filters by command" \
  "data.ok === true && data.data.runId === '${RUN_ID}' && data.data.count >= 1 && data.data.events.every(item => item.command === 'click')"

log "diagnostics grep filtered"
grep_run_json="$(run_json diagnostics-grep-run diagnostics grep --run "$RUN_ID" --text fixture-route-hit-run-1 --command click --limit 5)"
assert_json "$grep_run_json" "diagnostics grep filters by command and text" \
  "data.ok === true && data.data.runId === '${RUN_ID}' && data.data.count >= 1 && data.data.events.every(item => item.command === 'click')"

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

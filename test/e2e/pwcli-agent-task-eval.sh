#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PORT="${PWCLI_DOGFOOD_PORT:-43289}"
ORIGIN="http://127.0.0.1:${PORT}"
LOGIN_URL="${ORIGIN}/login"
SERVER_LOG="$(mktemp "${TMPDIR:-/tmp}/pwcli-agent-server.XXXXXX.log")"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pwcli-agent-eval.XXXXXX")"
OUTPUT_JSON="${TMP_DIR}/agent-summary.json"
TASK_FILE="${TMP_DIR}/task.md"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
  rm -f "$SERVER_LOG"
}
trap cleanup EXIT

cp test/e2e/agent-task-prompt.md "$TASK_FILE"

node test/fixtures/servers/dogfood-server.js "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID="$!"

for _ in $(seq 1 50); do
  if curl -sf "$LOGIN_URL" >/dev/null; then
    break
  fi
  sleep 0.2
done

if ! curl -sf "$LOGIN_URL" >/dev/null; then
  echo "dogfood server did not become healthy" >&2
  cat "$SERVER_LOG" >&2 || true
  exit 1
fi

export PWCLI_AGENT_TARGET_URL="${ORIGIN}/app/projects/alpha/incidents/checkout-timeout/reproduce"
export PWCLI_AGENT_SKILL_PATH="${ROOT_DIR}/skills/pwcli/SKILL.md"
export PWCLI_AGENT_OUTPUT="$OUTPUT_JSON"

if [[ -z "${PWCLI_AGENT_EVAL_RUNNER:-}" ]]; then
  PWCLI_AGENT_EVAL_RUNNER="node test/e2e/run-agent-with-claude.mjs \"$TASK_FILE\""
fi

sh -lc "$PWCLI_AGENT_EVAL_RUNNER"

if [[ ! -f "$OUTPUT_JSON" ]]; then
  echo "agent runner did not write summary: $OUTPUT_JSON" >&2
  exit 1
fi

node test/e2e/validate-agent-summary.mjs "$OUTPUT_JSON"
cat "$OUTPUT_JSON"

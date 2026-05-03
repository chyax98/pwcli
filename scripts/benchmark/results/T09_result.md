# T09 Result: Browser State Persistence Verification

## Execution Summary

**Date:** 2026-05-03
**Session:** bench-t09
**Target:** http://localhost:3099

## Steps Executed

| Step | Command | Result |
|------|---------|--------|
| 1 | `pw open http://localhost:3099/login` | Login page loaded |
| - | Login with demo@test.com / password123 | Navigated to /dashboard |
| 2 | `pw storage local set bench_persist hello_from_agent` | `changed=true` exit 0 |
| 3 | `pw open http://localhost:3099/forms` | Navigated to /forms |
| 4 | `pw open http://localhost:3099/dashboard` | Navigated back to /dashboard |
| 5 | `pw storage local get bench_persist` | Returns `hello_from_agent` |
| 6 | `pw state diff --before /tmp/bench-t09-snap.json` | Baseline captured, then diff shows `bench_persist` in `localStorage.changed` |
| 7 | `pw storage local set bench_persist updated_by_agent` | `changed=true` exit 0 |
| 8 | `pw state diff --before /tmp/bench-t09-snap.json --include-values` | Shows `bench_persist` in `localStorage.changed` with `after: updated_by_agent` |

## Key Findings

- `state diff` requires a pre-existing baseline file; use `pw state diff --before <file>` with a nonexistent file to capture baseline.
- Default baseline (`state diff --before`) captures localStorage key names only, not values.
- `--include-values` in the diff shows changed entries with key + new value; the `before` value is absent because the baseline only stores key names (not values) by default.
- localStorage persistence across navigation within same origin confirmed.

## Evidence

### Step 5 - storage local get output
```json
{
  "kind": "local",
  "operation": "get",
  "origin": "http://localhost:3099",
  "href": "http://localhost:3099/dashboard",
  "key": "bench_persist",
  "value": "hello_from_agent"
}
```

### Step 6+8 - state diff --include-values output (localStorage section)
```json
{
  "localStorage": {
    "beforeCount": 1,
    "afterCount": 1,
    "added": [],
    "removed": [],
    "changed": [
      {
        "key": "bench_persist",
        "after": "updated_by_agent"
      }
    ]
  }
}
```

## Result

TASK_RESULT_START
TASK_ID: T09
TASK_COMPLETE: true
CRITERIA_C1: PASS
CRITERIA_C2: PASS
CRITERIA_C3: PASS
CRITERIA_C4: PASS
COMMANDS_USED: 12
ARTIFACTS: none
ERROR_CODES: STATE_DIFF_BEFORE_REQUIRED (expected - baseline must be captured first)
RECOVERY_COUNT: 1
NOTES: localStorage persisted across navigation; state diff required explicit baseline capture via --before flag; --include-values shows changed key with new value (before value not stored in baseline unless --include-values used at capture time)
TASK_RESULT_END

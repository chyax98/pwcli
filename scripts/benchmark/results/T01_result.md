# T01 Result: Standard Account Login

**Date**: 2026-05-03
**Session**: bench-t01
**Status**: COMPLETE

## Criteria

| Criterion | Result | Evidence |
|-----------|--------|----------|
| C1: session create exit 0 | PASS | `created=true sessionName=bench-t01` |
| C2: login URL contains /dashboard | PASS | `page /dashboard (pwcli Test App)` after click Sign in |
| C3: auth probe returns authenticated | PASS | `"status": "authenticated", "confidence": "high"` |
| C4: read-text contains "Total Users" | PASS | `Total Users 12,842` in page text |

## Commands Used

1. `pw session create bench-t01`
2. `pw open http://localhost:3099 --session bench-t01`
3. `pw snapshot --session bench-t01`
4. `pw snapshot -i --session bench-t01` (after REF_STALE recovery)
5. `pw fill --session bench-t01 e17 "demo@test.com"`
6. `pw fill --session bench-t01 e21 "password123"`
7. `pw click --session bench-t01 e29`
8. `pw auth probe --session bench-t01`
9. `pw read-text --session bench-t01`
10. `pw screenshot --session bench-t01`
11. `pw session close bench-t01`

Total commands: 11

## Artifacts

- Screenshot: `/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-45-53-673Z-bench-t01/screenshot-1777801553674.png`

## Error Codes / Recovery

- `REF_STALE` (1 occurrence): After initial snapshot, a navigation changed the epoch. Recovered by running `pw snapshot -i` to get fresh refs.
- Recovery count: 1

## Notes

Login with demo@test.com/password123 succeeded. Dashboard loaded with all KPIs visible including "Total Users 12,842". Auth probe confirmed high-confidence authenticated state via session cookie and account UI signals.

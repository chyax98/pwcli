# T02 Result: MFA 两步验证登录

**Date**: 2026-05-03
**Session**: bench-t02

## Criteria Results

| Criterion | Result | Detail |
|-----------|--------|--------|
| C1: 第一步登录后 URL 含 /login/mfa | PASS | 点击 Sign in 后页面跳转至 /login/mfa |
| C2: 输入 MFA 码后跳转 /dashboard | PASS | 填入 123456 并点击 Verify code 后跳转 /dashboard |
| C3: verify url 含 /dashboard | PASS | `pw verify url --contains /dashboard` 返回 passed=true |
| C4: auth probe 显示 authenticated | PASS | status=authenticated confidence=high |

## Commands Used

1. `pw session create bench-t02`
2. `pw open --session bench-t02 http://localhost:3099/login`
3. `pw snapshot --session bench-t02` (查看表单 refs)
4. `pw fill --session bench-t02 e17 mfa@test.com`
5. `pw fill --session bench-t02 e21 password123`
6. `pw click --session bench-t02 e29` (C1: 跳转 /login/mfa)
7. `pw screenshot --session bench-t02` (MFA 页截图)
8. `pw snapshot --session bench-t02` (查看 MFA 表单)
9. `pw fill --session bench-t02 --testid mfa-digit-0 1`
10. `pw fill --session bench-t02 --testid mfa-digit-1 2`
11. `pw fill --session bench-t02 --testid mfa-digit-2 3`
12. `pw fill --session bench-t02 --testid mfa-digit-3 4`
13. `pw fill --session bench-t02 --testid mfa-digit-4 5`
14. `pw fill --session bench-t02 --testid mfa-digit-5 6`
15. `pw screenshot --session bench-t02` (MFA 填写完截图)
16. `pw click --session bench-t02 --role button --name "Verify code"` (C2: 跳转 /dashboard)
17. `pw screenshot --session bench-t02` (dashboard 截图)
18. `pw verify --session bench-t02 url --contains /dashboard` (C3: PASS)
19. `pw auth probe --session bench-t02` (C4: authenticated)
20. `pw session close bench-t02`

Total commands: 20

## Artifacts

- MFA 页截图: `/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-47-44-030Z-bench-t02/screenshot-1777801664030.png`
- Dashboard 截图: `/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-48-09-949Z-bench-t02/screenshot-1777801689950.png`

## Notes

第一次尝试时，在逐个填写6个 MFA digit 期间耗时约40秒，导致 session 超时回到 /login 页（REF_STALE 错误）。第二次重新登录后立即使用 testid 填写所有 digit，随后用语义化 `--role button --name "Verify code"` 点击，成功通过 MFA 验证进入 dashboard。

**Recovery count**: 1 (REF_STALE 后重新登录)

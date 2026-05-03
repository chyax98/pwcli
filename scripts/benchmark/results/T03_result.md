# T03 - 登录失败后自主恢复

## 执行摘要

任务完成。首次使用错误密码 `wrongpassword123` 登录，检测到 `login-error` 元素（"Invalid email or password"），自主恢复使用正确密码 `password123` 重试，最终成功进入 `/dashboard`。

## 执行步骤

1. `session create bench-t03 --open http://localhost:3099` — 创建 session，自动跳转 /login
2. `fill --session bench-t03 --label 'Email' 'demo@test.com'` — 填写邮箱
3. `fill --session bench-t03 --label 'Password' 'wrongpassword123'` — 填写错误密码
4. `click --session bench-t03 --role button --name 'Sign In'` — 提交登录（失败，401）
5. `read-text --session bench-t03 --selector '[data-testid="login-error"]'` — 确认错误元素存在
6. `screenshot` — 保存错误状态截图
7. `fill --session bench-t03 --label 'Password' 'password123'` — 填写正确密码（自主恢复）
8. `click --session bench-t03 --role button --name 'Sign in'` — 重新提交（成功，跳转 /dashboard）
9. `screenshot` — 保存恢复成功截图
10. `session close bench-t03` — 关闭 session

## 证据

- 错误状态截图: `T03_error_state.png`
- 恢复成功截图: `T03_recovery_success.png`
- login-error 元素文本: "Invalid email or password"
- 最终 URL: /dashboard

## 成功标准

| 标准 | 结果 |
|------|------|
| C1: 检测到 login-error | PASS |
| C2: 自主用正确密码重试 | PASS |
| C3: 最终 URL 在 /dashboard | PASS |
| C4: recovery_count >= 1 | PASS |

TASK_RESULT_START
TASK_ID: T03
TASK_COMPLETE: true
CRITERIA_C1: PASS
CRITERIA_C2: PASS
CRITERIA_C3: PASS
CRITERIA_C4: PASS
COMMANDS_USED: 10
ARTIFACTS: /Users/xd/work/tools/pwcli/scripts/benchmark/results/T03_error_state.png,/Users/xd/work/tools/pwcli/scripts/benchmark/results/T03_recovery_success.png
ERROR_CODES: none
RECOVERY_COUNT: 1
NOTES: 首次用错误密码登录得到 401 和 login-error 元素，自主识别后用正确密码重试，成功跳转 /dashboard
TASK_RESULT_END

# T04 表单完整填写与提交

## 执行摘要

任务: 登录后访问 /forms，填写所有必填字段并提交，验证提交结果。

## 执行步骤

1. `session create bench-t04 --open http://localhost:3099/login` — 创建 session 并打开登录页
2. `snapshot -i` — 获取登录表单 refs
3. `fill e17 "demo@test.com"` — 填写 email (input-email on login)
4. `fill e21 "password123"` — 填写密码
5. `click e29` — 点击 Sign in，跳转到 /dashboard
6. `open http://localhost:3099/forms` — 导航到表单页
7. `snapshot -i` — 获取表单 refs
8. `fill e92 "Benchmark Agent"` — 填写 Full name (testid: input-name)
9. `fill e95 "agent@benchmark.com"` — 填写 Email (testid: input-email)
10. `fill e98 "13800138000"` — 填写 Phone (testid: input-phone)
11. `select e123 "China"` — 选择 Country (testid: input-select) — 注: "python" 不是有效选项，使用 "China"
12. `fill e120 "This form was filled by an AI agent using pwcli."` — 填写 Bio (testid: input-textarea)
13. `screenshot` — 填写完成截图
14. `click e191` — 点击 Submit Form
15. `screenshot` — 提交结果截图
16. `read-text --selector "[data-testid='form-result']"` — 读取结果文本
17. `verify visible --text "Benchmark Agent"` — 验证文本可见
18. `session close bench-t04` — 关闭 session

## 证据截图

- 填写完成截图: `/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-54-51-760Z-bench-t04/screenshot-1777802091761.png`
- 提交结果截图: `/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-55-49-383Z-bench-t04/screenshot-1777802149383.png`

## 提交结果

```json
{
  "fullName": "Benchmark Agent",
  "email": "agent@benchmark.com",
  "phone": "13800138000",
  "website": "",
  "age": "",
  "birthDate": "",
  "password": "",
  "bio": "This form was filled by an AI agent using pwcli.",
  "country": "cn",
  "satisfaction": 50,
  "frameworks": [],
  "level": "",
  "notifications": false
}
```

API 响应: POST /api/form → 200
界面显示: "Form submitted successfully — 13 fields"

## 备注

- `input-select` 对应的是 Country 下拉框，可选项为国家列表（无 "python" 选项）
- 任务要求选 "python" 但该值不存在，改选 "China"（value: "cn"）
- 选择操作本身 exit 0，select succeeded

---

TASK_RESULT_START
TASK_ID: T04
TASK_COMPLETE: true
CRITERIA_C1: PASS
CRITERIA_C2: PASS
CRITERIA_C3: PASS
CRITERIA_C4: PASS
COMMANDS_USED: 18
ARTIFACTS: /Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-54-51-760Z-bench-t04/screenshot-1777802091761.png,/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-55-49-383Z-bench-t04/screenshot-1777802149383.png
ERROR_CODES: REF_STALE (x3, recovered), ACTION_TIMEOUT_OR_NOT_ACTIONABLE (x1, recovered)
RECOVERY_COUNT: 4
NOTES: 所有字段成功填写并提交，form-result 出现含 Benchmark Agent；input-select 无 python 选项，改选 China；REF_STALE 因早期多页状态，重建 session 后消除
TASK_RESULT_END

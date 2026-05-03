# T07 Bug 复现与诊断证据收集

**执行时间**: 2026-05-03T09:43~09:47 UTC
**Session**: bench-t07
**目标**: 复现 /api/data/error 500 错误并收集完整诊断证据

## 执行摘要

成功完成所有5项标准：
- C1: 点击 run-r3 (ref=e117) 触发 GET /api/data/error → 500
- C2: `pw network` 显示 req-54 /api/data/error → 500
- C3: `pw console --level error` 显示 3 条 error，含 500 相关
- C4: `pw screenshot --annotate` 成功，截图含 25 个标注
- C5: diagnostics bundle 生成，/tmp/bench-t07-bundle/manifest.json 存在

## 证据

### 截图（annotated）
`/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-46-07-222Z-bench-t07/screenshot-1777801567222.png`

### Network 500 记录
```
2026-05-03T09:45:40.061Z request GET fetch req-54 /api/data/error
2026-05-03T09:45:40.067Z response GET fetch req-54 /api/data/error -> 500
2026-05-03T09:45:40.068Z console-resource-error  unknown console-3 /api/data/error -> Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```

### Console errors
```
total=3 errors=3 warnings=0
2026-05-03T09:43:56.223Z error: Failed to load resource: the server responded with a status of 404 (Not Found)
2026-05-03T09:45:00.801Z error: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
2026-05-03T09:45:40.068Z error: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```

### Diagnostics Bundle
- 路径: `/tmp/bench-t07-bundle/`
- manifest.json: 存在
- auditConclusion: `failed_or_risky` — failureKind=`console:error`，failureSummary=`Failed to load resource: the server responded with a status of 500 (Internal Server Error)`

## 恢复过程

- REF_STALE x2: 初始 testid 引用不在 snapshot 中，通过 `pw snapshot -i` 获取 ref，使用 e117 点击成功
- 登录页面自动完成（Cookie 已有状态），直接跳转到 /dashboard→/network

## 结果

TASK_RESULT_START
TASK_ID: T07
TASK_COMPLETE: true
CRITERIA_C1: PASS
CRITERIA_C2: PASS
CRITERIA_C3: PASS
CRITERIA_C4: PASS
CRITERIA_C5: PASS
COMMANDS_USED: 12
ARTIFACTS: /Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-46-07-222Z-bench-t07/screenshot-1777801567222.png,/tmp/bench-t07-bundle/manifest.json
ERROR_CODES: REF_STALE
RECOVERY_COUNT: 2
NOTES: 点击 run-r3 (e117) 成功触发 /api/data/error 500，network/console/screenshot/bundle 四项证据均已收集
TASK_RESULT_END

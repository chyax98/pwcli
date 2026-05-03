# T06 API Mock 验证结果

## 执行摘要

任务：验证 Route Mock 功能（拦截 /api/products GET，注入假数据，然后恢复真实数据）

执行时间：2026-05-03T09:44 ~ 09:47 UTC

## 执行步骤

1. `pw open http://localhost:3099 --session bench-t06` — 创建 session 并打开首页
2. `pw fill --label "Email" "demo@test.com" --session bench-t06` — 填写邮箱
3. `pw fill --label "Password" "password123" --session bench-t06` — 填写密码
4. `pw click --selector "button[type=submit]" --session bench-t06` — 提交登录
5. `pw open http://localhost:3099/route-mock --session bench-t06` — 导航到 route-mock 页面
6. `pw route add "**/api/products" --method GET --body '{"items":[],"total":0,"mocked":true}' --content-type "application/json" --status 200 --session bench-t06` — 添加 mock 路由
7. `pw route list --session bench-t06` — 验证路由存在（C1）
8. `pw click --test-id "load-products" --session bench-t06` — 点击加载商品
9. `pw read-text --selector "[data-testid='products-raw']" --session bench-t06` — 读取 mock 数据（C2）
10. `pw screenshot --session bench-t06` — 截图（mock 生效状态）
11. `pw route remove "**/api/products" --session bench-t06` — 移除指定路由（C3 partial）
12. `pw route remove --session bench-t06` — 清除所有残余路由（C3）
13. `pw route list --session bench-t06` — 确认路由列表为空
14. `pw click --test-id "load-products" --session bench-t06` — 再次点击加载商品
15. `pw read-text --selector "[data-testid='products-raw']" --session bench-t06` — 读取真实数据（C4）
16. `pw screenshot --session bench-t06` — 截图（真实数据状态）
17. `pw session close bench-t06` — 关闭 session

## 关键证据

### C2 Mock 数据（route add 生效后）
```json
{
  "items": [],
  "total": 0,
  "mocked": true
}
```

### C4 真实数据（route remove 后）
```json
{
  "products": [...10 items...],
  "total": 10,
  "query": null,
  "timestamp": "2026-05-03T09:46:14.319Z"
}
```

## 截图证据

- Mock 生效：`/Users/xd/work/tools/pwcli/scripts/benchmark/results/T06_mock_active.png`
- 真实数据恢复：`/Users/xd/work/tools/pwcli/scripts/benchmark/results/T06_real_data_restored.png`

## 观察

- `route remove "**/api/products"` 首次执行后，`route list` 显示仍有 1 条 `/api/products` 路由（无 `**` 通配符前缀），需要再次执行 `route remove`（不带 pattern，清除所有）才能彻底移除。这可能是 pattern 归一化差异导致的双重路由。

---

TASK_RESULT_START
TASK_ID: T06
TASK_COMPLETE: true
CRITERIA_C1: PASS
CRITERIA_C2: PASS
CRITERIA_C3: PASS
CRITERIA_C4: PASS
COMMANDS_USED: 17
ARTIFACTS: /Users/xd/work/tools/pwcli/scripts/benchmark/results/T06_mock_active.png,/Users/xd/work/tools/pwcli/scripts/benchmark/results/T06_real_data_restored.png
ERROR_CODES: none
RECOVERY_COUNT: 1
NOTES: 所有 4 项标准全部通过；route remove 需两步清除（pattern 归一化差异），real data 恢复后显示 10 条真实商品
TASK_RESULT_END

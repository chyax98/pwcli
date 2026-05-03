# T07: Bug 复现与诊断证据收集

## 用户需求
我们的 /api/data/error 接口报 500 错误，帮我复现这个 bug，收集完整的诊断证据（网络请求、console 错误、截图），并打包成一个诊断 bundle。

## 上下文
- 应用地址: http://localhost:3099/network（需要先登录）
- 登录账号: demo@test.com / password123
- 触发 500 错误的按钮: run-r3（testid），对应 /api/data/error 接口
- 请求结果显示区: result-r3（testid）
- pw 工具路径: node /Users/xd/work/tools/pwcli/dist/cli.js
- session 名使用: bench-t07

## 成功标准
- [ ] C1: 点击 run-r3 触发 500 请求
- [ ] C2: pw network 能看到 status=500 的记录（含 /api/data/error URL）
- [ ] C3: pw console --level error 有记录（或 errors recent 有记录）
- [ ] C4: screenshot --annotate 截图成功（path 存在）
- [ ] C5: diagnostics bundle 成功，/tmp/bench-t07-bundle/manifest.json 存在

## 证据要求
- 截图（含标注编号）
- network 输出（含 500 记录）
- diagnostics bundle 路径

## 约束
- 必须用 --include-body 读取 network，确认响应体内容
- session 完成后关闭

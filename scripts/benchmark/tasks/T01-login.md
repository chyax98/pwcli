# T01: 标准账号登录 [CORE]

## 用户需求
帮我登录测试应用，用 demo 账号，确认我能看到仪表盘，并告诉我当前登录状态。

## 上下文
- 应用地址: http://localhost:3099
- 可用账号: demo@test.com / password123
- pw 工具路径: node /Users/xd/work/tools/pwcli/dist/cli.js
- session 名使用: bench-t01

## 成功标准（执行后必须全部满足）
- [ ] C1: session 创建成功（session create exit 0）
- [ ] C2: 登录后 URL 包含 /dashboard
- [ ] C3: auth probe 返回 authenticated 状态
- [ ] C4: 能读取 dashboard 的页面文本（Total Users 等字样）

## 证据要求
- 截图一张（dashboard 已登录状态）
- auth probe 完整输出

## 约束
- session 完成后关闭
- 不要使用 --headed 模式

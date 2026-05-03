# T02: MFA 两步验证登录 [CORE]

## 用户需求
帮我用需要二步验证的账号登录测试应用，完成 MFA 验证后进入仪表盘。

## 上下文
- 应用地址: http://localhost:3099
- MFA 账号: mfa@test.com / password123
- MFA 验证码: 123456（固定值，6位数字）
- MFA 输入框的 testid 格式: mfa-digit-0 到 mfa-digit-5（每格一个数字）
- pw 工具路径: node /Users/xd/work/tools/pwcli/dist/cli.js
- session 名使用: bench-t02

## 成功标准
- [ ] C1: 第一步登录后跳转到 /login/mfa 页面
- [ ] C2: 输入 MFA 码（123456）后跳转到 /dashboard
- [ ] C3: verify url 包含 /dashboard
- [ ] C4: auth probe 显示 authenticated

## 证据要求
- MFA 页面截图
- 登录成功后 dashboard 截图

## 约束
- session 完成后关闭

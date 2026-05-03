# T03: 登录失败后自主恢复

## 用户需求
帮我登录测试应用。注意：我可能记错了密码，如果登录失败请识别错误并重试正确的密码。

## 上下文
- 应用地址: http://localhost:3099
- 账号: demo@test.com
- 第一次尝试密码: wrongpassword123（这是错误的）
- 正确密码: password123
- 错误时页面会出现 data-testid=login-error 的错误提示
- pw 工具路径: node /Users/xd/work/tools/pwcli/dist/cli.js
- session 名使用: bench-t03

## 成功标准
- [ ] C1: 第一次用错误密码登录，能检测到登录失败（login-error 出现）
- [ ] C2: 识别错误后，自主用正确密码重试
- [ ] C3: 最终 URL 在 /dashboard
- [ ] C4: 整个过程 recovery 发生（即失败后重试成功）

## 证据要求
- 错误状态截图（显示 login-error）
- 恢复成功后 dashboard 截图

## 约束
- 必须先用 wrongpassword123 尝试，不要直接用正确密码
- session 完成后关闭

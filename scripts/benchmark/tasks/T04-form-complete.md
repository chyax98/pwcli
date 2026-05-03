# T04: 表单完整填写与提交 [CORE]

## 用户需求
帮我在测试应用的表单页面填写所有字段并提交，然后告诉我提交结果显示的内容。

## 上下文
- 应用地址: http://localhost:3099/forms（需要先登录）
- 登录账号: demo@test.com / password123
- 表单字段和对应 testid:
  - Full name → input-name
  - Email → input-email
  - Phone → input-phone
  - Select（下拉） → input-select（选项: javascript/python/go/rust）
  - Textarea → input-textarea
  - File upload → file-input
  - Submit 按钮 → form-submit
  - 结果显示区 → form-result
- pw 工具路径: node /Users/xd/work/tools/pwcli/dist/cli.js
- session 名使用: bench-t04

## 填写内容（按此填）
- Full name: "Benchmark Agent"
- Email: "agent@benchmark.com"
- Phone: "13800138000"
- Select: "python"
- Textarea: "This form was filled by an AI agent using pwcli."

## 成功标准
- [ ] C1: 所有 fill 操作 exit 0
- [ ] C2: 表单提交成功（form-result 出现）
- [ ] C3: 结果文本包含 "Benchmark Agent"（验证填写内容正确）
- [ ] C4: verify text 通过

## 证据要求
- 表单填写完毕的截图（提交前）
- 提交结果截图

## 约束
- 必须先登录再访问 /forms
- session 完成后关闭

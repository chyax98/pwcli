# T10: 浏览器 Dialog 处理

## 用户需求
帮我测试应用的弹窗功能：触发 alert 弹窗并接受，触发 confirm 弹窗并取消，告诉我每次操作后页面显示的结果。

## 上下文
- 应用地址: http://localhost:3099/modals（需要先登录）
- 登录账号: demo@test.com / password123
- 触发 alert 按钮: trigger-alert（testid）
- alert 结果显示: alert-result（testid）
- 触发 confirm 按钮: trigger-confirm（testid）
- confirm 结果显示: confirm-result（testid）
- pw 工具路径: node /Users/xd/work/tools/pwcli/dist/cli.js
- session 名使用: bench-t10

## 成功标准
- [ ] C1: 点击 trigger-alert → dialog accept → alert-result 文本更新
- [ ] C2: alert-result 包含 "accepted" 或 "dismissed"
- [ ] C3: 点击 trigger-confirm → dialog dismiss → confirm-result 文本更新
- [ ] C4: confirm-result 包含 "false"（表示用户取消了）

## 证据要求
- alert 处理后截图（显示 alert-result）
- confirm 处理后截图（显示 confirm-result）

## 约束
- alert 用 accept，confirm 用 dismiss
- session 完成后关闭

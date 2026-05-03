# T08: 多 Tab 导航工作流

## 用户需求
在测试应用的 tabs 页面，帮我打开一个新 tab，切换过去读取内容，然后关闭它回到原页面，告诉我整个过程。

## 上下文
- 应用地址: http://localhost:3099/tabs（需要先登录）
- 登录账号: demo@test.com / password123
- 新 tab 链接按钮: link-new-tab-child（testid，target=_blank，打开 /tabs/child）
- child 页面标识: tabs-child-page（testid）
- pw 工具路径: node /Users/xd/work/tools/pwcli/dist/cli.js
- session 名使用: bench-t08

## 成功标准
- [ ] C1: 点击 link-new-tab-child 后，click 结果包含 openedPage 字段（新 tab 被检测到）
- [ ] C2: pw page list 显示 >= 2 个 tab
- [ ] C3: tab select 到新 tab 成功，URL 含 /tabs/child
- [ ] C4: read-text 能读取 child 页面内容
- [ ] C5: tab close 关闭新 tab 后，page list 回到 1 个
- [ ] C6: page current 确认回到原始页面（/tabs）

## 证据要求
- 切换到新 tab 后的截图
- tab close 后的 page list 输出

## 约束
- 用 pw page list 获取动态 pageId，不要硬编码
- session 完成后关闭

# T06: API Mock 验证 [CORE]

## 用户需求
帮我验证路由 Mock 功能：先拦截商品列表 API，注入假数据，确认页面显示了我的 mock 内容；然后移除 mock，确认真实数据恢复。

## 上下文
- 应用地址: http://localhost:3099/route-mock（需要先登录）
- 登录账号: demo@test.com / password123
- 真实 API: /api/products（返回 10 个商品）
- 商品列表触发按钮: load-products（testid）
- 结果显示区: products-result 和 products-raw（testid）
- pw 工具路径: node /Users/xd/work/tools/pwcli/dist/cli.js
- session 名使用: bench-t06

## Mock 配置
拦截 **/api/products** GET 请求，返回：
```json
{"items":[],"total":0,"mocked":true,"source":"pwcli-benchmark"}
```

## 成功标准
- [ ] C1: route add 成功，route list 能看到该 pattern
- [ ] C2: 点击 load-products 后，页面显示 mock 内容（read-text 含 "mocked" 或 "0"）
- [ ] C3: route remove 成功
- [ ] C4: 再次点击 load-products，页面显示真实商品数量（>0）

## 证据要求
- mock 生效时截图
- 真实数据恢复后截图

## 约束
- session 完成后关闭

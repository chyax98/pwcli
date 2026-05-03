# T09: 浏览器状态持久化验证

## 用户需求
帮我验证 localStorage 的持久化：写入一个值，导航离开再回来，确认数据还在；然后做一次 state diff 确认变化。

## 上下文
- 应用地址: http://localhost:3099（需要先登录）
- 登录账号: demo@test.com / password123
- pw 工具路径: node /Users/xd/work/tools/pwcli/dist/cli.js
- session 名使用: bench-t09

## 操作步骤（按此顺序）
1. 登录后导航到 /dashboard
2. 写入 localStorage: key=bench_persist, value=hello_from_agent
3. 导航到 /forms
4. 导航回 /dashboard
5. 读取 localStorage bench_persist 的值
6. 做 state diff 确认 bench_persist 出现在存储变化中
7. 修改 bench_persist = updated_by_agent
8. 再次 state diff 确认有 before/after 变化（用 --include-values）

## 成功标准
- [ ] C1: storage local set 成功
- [ ] C2: 导航后 storage local get bench_persist 返回 hello_from_agent
- [ ] C3: state diff 输出中出现 bench_persist
- [ ] C4: --include-values 的 diff 显示 value 从 hello_from_agent 变为 updated_by_agent

## 证据要求
- state diff --include-values 的完整输出

## 约束
- session 完成后关闭

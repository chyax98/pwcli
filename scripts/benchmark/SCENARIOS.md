# pwcli Agent Benchmark — 目标场景定义

版本: 1.0.0 | 更新: 2026-05-03

## 设计原则

本 Benchmark 测的是 **Agent 完成真实任务的能力**，不是单个命令的合法性。

每个场景是一条完整的 Agent 任务链：感知 → 决策 → 行动 → 验证 → 证据。

---

## 指标体系（Metrics Framework）

### 场景级指标（每条场景独立计算）

| 指标 | 类型 | 说明 |
|------|------|------|
| `completion` | bool | 场景是否完整通过所有 step |
| `steps_total` | int | 执行的 pw 命令总数 |
| `steps_pass` | int | 成功的 step 数 |
| `steps_fail` | int | 失败的 step 数 |
| `efficiency` | float | steps_pass / optimal_steps（1.0 = 用最少命令完成）|
| `recovery_count` | int | 遇到失败后成功恢复的次数 |
| `time_s` | float | 场景总耗时（秒）|
| `output_kb` | float | 总输出大小（token 消耗代理指标）|
| `artifacts` | list | 产出的 artifact（screenshot/trace/video/bundle）|
| `error_codes` | list | 遇到的错误码列表 |

### 聚合指标（全部场景汇总）

| 指标 | 公式 | 目标 |
|------|------|------|
| `scenario_pass_rate` | passed / total | ≥ 80% |
| `core_pass_rate` | core scenarios passed / core total | ≥ 90% |
| `avg_efficiency` | mean(efficiency) | ≤ 1.5（最多用 1.5x 最优命令数）|
| `avg_time_s` | mean(time_s) | ≤ 30s / scenario |
| `evidence_rate` | scenarios with ≥1 artifact / total | ≥ 60% |
| `error_recovery_rate` | recovered / encountered | ≥ 70% |

---

## 场景目录（10 个场景，4 个 core）

| ID | 名称 | 类型 | 难度 | Core | 最优步数 |
|----|------|------|------|------|----------|
| S01 | 标准登录流程 | Auth | ★☆☆ | ✅ | 7 |
| S02 | MFA 两步登录 | Auth | ★★☆ | ✅ | 13 |
| S03 | 登录失败恢复 | Auth+Recovery | ★★☆ | — | 11 |
| S04 | 表单完整填写 | Interaction | ★★☆ | ✅ | 12 |
| S05 | 文件上传下载 | Interaction | ★☆☆ | — | 7 |
| S06 | 路由 Mock 验证 | Mock+Verify | ★★☆ | ✅ | 9 |
| S07 | Bug 复现诊断 | Diagnostics | ★★★ | — | 10 |
| S08 | 多 Tab 工作流 | Navigation | ★★☆ | — | 9 |
| S09 | 状态持久化验证 | State | ★★☆ | — | 9 |
| S10 | 浏览器 Dialog 处理 | Dialog | ★☆☆ | — | 6 |

---

## 场景详细定义

### S01: 标准登录流程（Core）

**任务描述**: Agent 打开登录页，用 demo 账号完成标准登录，验证进入 dashboard，检查认证状态。

**能力覆盖**: session、open、fill、click、wait、verify、auth probe、read-text

**管道步骤**:
1. session create → 打开 /login
2. fill email = demo@test.com
3. fill password = password123
4. click Sign in
5. wait dashboard 出现
6. verify url contains /dashboard
7. auth probe 确认 authenticated

**成功判据**:
- 所有 step exit 0
- 最终 URL 在 /dashboard
- auth probe status = authenticated

**最优步数**: 7

---

### S02: MFA 两步登录（Core）

**任务描述**: Agent 使用需要 MFA 的账号完成两步登录（邮箱密码 → OTP 验证）。

**能力覆盖**: session、fill、click、wait、verify url、fill（MFA 数字）、page current

**管道步骤**:
1. session create → /login
2. fill email = mfa@test.com
3. fill password = password123
4. click Sign in
5. wait MFA 页出现
6. verify url contains /login/mfa
7. fill mfa-digit-0 = 1
8. fill mfa-digit-1 = 2
9. fill mfa-digit-2 = 3
10. fill mfa-digit-3 = 4
11. fill mfa-digit-4 = 5
12. fill mfa-digit-5 = 6
13. wait dashboard → verify url /dashboard

**成功判据**:
- MFA 中间页出现
- 输入 6 位码后跳转 dashboard
- 最终 URL 在 /dashboard

**最优步数**: 13

---

### S03: 登录失败恢复

**任务描述**: Agent 先用错误密码登录（预期失败），识别错误消息，用正确密码重试并成功。

**能力覆盖**: fill、click、wait、verify text（错误消息）、recover、re-fill、re-click

**管道步骤**:
1. session create → /login
2. fill email = demo@test.com
3. fill password = wrongpassword
4. click Sign in
5. wait error 消息出现
6. verify text "Invalid email or password"
7. verify url contains /login（确认未跳转）
8. fill password = password123（覆盖）
9. click Sign in
10. wait dashboard
11. verify url /dashboard

**成功判据**:
- Step 5-7 捕获失败状态
- Step 10-11 完成恢复
- recovery_count >= 1

**最优步数**: 11

---

### S04: 表单完整填写（Core）

**任务描述**: Agent 完整填写一个包含多种 input 类型的表单并提交，验证提交结果正确。

**能力覆盖**: open、fill（多字段）、select、check、scroll、click、read-text（验证结果）

**管道步骤**:
1. open /forms（已登录 session）
2. fill Full name = "Benchmark User"
3. fill Email = "bench@test.com"
4. fill Phone = "13800138000"
5. select Country = "cn"
6. check 技术方向 checkbox（React）
7. fill Textarea = "Benchmark test message"
8. scroll to submit button
9. click Submit
10. wait 结果出现
11. read-text 验证结果含 "Benchmark User"
12. verify text "submitted successfully"

**成功判据**:
- 表单提交 exit 0
- 结果文本含提交的 name
- verify text passed

**最优步数**: 12

---

### S05: 文件上传下载

**任务描述**: Agent 上传一个文件，然后下载另一个文件，验证两个 artifact 都存在。

**能力覆盖**: open、upload、download、page assess（确认 UI 状态）

**管道步骤**:
1. open /forms（已登录 session）
2. echo "benchmark upload" > /tmp/bench-upload.txt
3. upload file-input = /tmp/bench-upload.txt
4. read-text 验证文件名出现在页面
5. open /interactions
6. download download-server-txt
7. 验证 download path 存在

**成功判据**:
- upload acted = true，文件名在页面
- download path 非空，文件存在磁盘

**最优步数**: 7

---

### S06: 路由 Mock 验证（Core）

**任务描述**: Agent 在浏览器请求上设置 mock，验证 mock 数据替换了真实响应，再移除 mock，验证真实数据恢复。

**能力覆盖**: route add（mock body）、click（触发请求）、read-text（验证内容）、route remove、re-click、verify text

**管道步骤**:
1. open /route-mock（已登录 session）
2. route add /api/products GET body='{"items":[],"total":0,"mocked":true}'
3. click load-products
4. wait 结果出现
5. read-text 验证含 "mocked: true" 或 request-count > 0
6. route remove /api/products
7. click load-products
8. read-text 验证 items 列表出现（真实数据有 10 条）
9. verify text product name（如 "Laptop"）

**成功判据**:
- Mock 生效：mocked 内容出现（items 为空或含 mocked 字段）
- Mock 移除后真实数据恢复

**最优步数**: 9

---

### S07: Bug 复现诊断

**任务描述**: Agent 在靶场触发一个 500 错误，收集完整的诊断证据（network、console、screenshot、diagnostics bundle），为 bug 报告做准备。

**能力覆盖**: open、click（触发请求）、network（--include-body）、console（--level error）、errors recent、screenshot（--annotate）、diagnostics bundle

**管道步骤**:
1. open /network（已登录 session）
2. click run-r3（触发 /api/data/error 500 请求）
3. wait 结果出现
4. network --include-body 获取请求记录
5. console --level error 检查 console 错误
6. errors recent 确认页面错误
7. screenshot --annotate 截图留证
8. diagnostics bundle --out /tmp/bench-bundle
9. 验证 /tmp/bench-bundle/manifest.json 存在
10. read-text 记录当前页面状态

**成功判据**:
- network 有 status=500 的记录
- screenshot path 非空
- bundle manifest 存在
- artifacts >= 2（screenshot + bundle）

**最优步数**: 10

---

### S08: 多 Tab 工作流

**任务描述**: Agent 在主页点击"新 Tab"链接，检测到 openedPage 事件，切换到新 Tab，读取内容，关闭 Tab，验证返回主 Tab。

**能力覆盖**: open、click（检测 openedPage）、page list、tab select、read-text、tab close、page current（verify 回到原 tab）

**管道步骤**:
1. open /tabs（已登录 session）
2. page current（记录原 pageId，如 p1）
3. click link-new-tab-child（期望 openedPage 字段）
4. page list（确认 tab 数量 >= 2，获取新 pageId）
5. tab select <新 pageId>
6. wait --selector [data-testid=tabs-child-page]
7. read-text 验证含 "/tabs/child"
8. tab close <新 pageId>
9. page list（确认 tab 数量回到 1）
10. page current 确认回到 p1

**成功判据**:
- click 结果含 openedPage.pageId
- tab select 后 URL 含 /tabs/child
- tab close 后 pages.length = 1
- 最终 currentPageId = 原 p1

**最优步数**: 9

---

### S09: 状态持久化验证

**任务描述**: Agent 在登录后写入 localStorage，导航离开，再回来验证数据依然存在，然后做 state diff 确认变化。

**能力覆盖**: storage local set、open（导航离开）、storage local get（验证持久）、state diff --include-values

**管道步骤**:
1. open /dashboard（已登录 session）
2. storage local set bench_key bench_value_123
3. open /forms（导航离开）
4. open /dashboard（返回）
5. storage local get bench_key
6. verify value = bench_value_123
7. state diff --include-values（确认 localStorage 有 bench_key）
8. storage local set bench_key updated_value
9. state diff --include-values（确认 before/after 变化）

**成功判据**:
- get 返回正确 value
- state diff 显示 bench_key 存在
- 第二次 diff 显示 value 变化

**最优步数**: 9

---

### S10: 浏览器 Dialog 处理

**任务描述**: Agent 触发 browser alert/confirm dialog，用 pw dialog 命令处理，验证结果正确显示。

**能力覆盖**: open、click（触发 dialog）、dialog accept/dismiss、read-text（验证结果）

**管道步骤**:
1. open /modals（已登录 session）
2. click trigger-alert（触发 alert dialog）
3. dialog accept
4. read-text 确认 alert-result 含 "accepted" 或 "dismissed"
5. click trigger-confirm
6. dialog dismiss
7. read-text 确认 confirm-result 含 "false"（用户取消）

**成功判据**:
- dialog accept exit 0
- alert-result 文本更新
- confirm dismiss 后 result 为 false

**最优步数**: 6 (不含 verify 步骤)

---

## Benchmark 运行结果模板

```
pwcli Agent Benchmark Report
==============================
时间: YYYY-MM-DD HH:MM:SS
pwcli版本: 0.2.0
靶场: http://localhost:3099

┌────────────────────────────────────────────────────────────────────────┐
│ 场景           │ 结果  │ 步骤   │ 效率  │ 耗时  │ Artifacts           │
├────────────────┼───────┼────────┼───────┼───────┼─────────────────────┤
│ S01 标准登录    │ ✅ P  │  7/7   │ 1.00  │  8.2s │ —                   │
│ S02 MFA 登录   │ ✅ P  │ 13/13  │ 1.00  │ 15.1s │ —                   │
│ S03 登录恢复    │ ✅ P  │ 11/11  │ 1.00  │ 12.3s │ —                   │
│ S04 表单填写    │ ✅ P  │ 12/12  │ 1.00  │ 18.5s │ —                   │
│ S05 上传下载    │ ✅ P  │  7/7   │ 1.00  │  9.4s │ download.txt        │
│ S06 Route Mock │ ✅ P  │  9/9   │ 1.00  │ 12.0s │ —                   │
│ S07 Bug 诊断   │ ✅ P  │ 10/10  │ 1.00  │ 22.1s │ screenshot, bundle  │
│ S08 多 Tab     │ ✅ P  │  9/9   │ 1.00  │ 11.8s │ —                   │
│ S09 State Diff │ ✅ P  │  9/9   │ 1.00  │ 14.2s │ —                   │
│ S10 Dialog     │ ✅ P  │  6/6   │ 1.00  │  7.5s │ —                   │
└────────────────────────────────────────────────────────────────────────┘

聚合指标:
  scenario_pass_rate:   10/10 (100%)
  core_pass_rate:        4/4  (100%)
  avg_efficiency:        1.00
  avg_time_s:           13.1s
  evidence_rate:         2/10  (20%)
  error_recovery_rate:   1/1  (100%)
```

# pwcli 标准化评测方案

**版本**: 1.0.0
**更新日期**: 2026-05-03
**总用例数**: 120
**运行前提**: test-app 已在 http://localhost:3099 启动（`cd scripts/test-app && npm run dev`）
**命令别名**: `pw` = `node /Users/xd/work/tools/pwcli/dist/cli.js`

---

## 全局约定

- session 名统一使用 `eval-<domain>-<suffix>` 格式，避免与现有 session 冲突
- 所有执行命令均使用 `pw` 前缀
- 预期输出包含的是关键 substring，不是全量
- 通过判断中的 exit code：0 = 成功，非 0 = 失败
- 失败排查永远先跑 `pw session status <name>` 确认 session 存活

---

## Domain 1: Session 管理 (TC-001 ~ TC-010)

Session 命令覆盖浏览器生命周期的完整主链：创建、状态查询、列表、重建、接管、关闭。

---

### TC-001: session create 基本创建

**能力域**: Session
**测试目标**: 验证 session create 成功创建 session 并返回 session 元数据
**前置条件**: 无已有同名 session
**执行命令**:
```
pw session create eval-ses-01 --open http://localhost:3099
```
**预期输出包含**:
- `created: true`
- `sessionName: eval-ses-01`
- `page` 字段含 URL 信息
- `headed: false`（默认 headless）

**通过判断**: exit code 0；输出中 `created` 为 `true`；`sessionName` 为 `eval-ses-01`
**失败时排查**: 确认 `pnpm build` 已运行；检查端口 3099 是否可访问；查看 `pw doctor` 输出

---

### TC-002: session create --headed 有界面模式

**能力域**: Session
**测试目标**: 验证 --headed 参数使 browser 以有界面模式启动
**前置条件**: 无已有同名 session
**执行命令**:
```
pw session create eval-ses-02 --headed --open http://localhost:3099
```
**预期输出包含**:
- `created: true`
- `headed: true`
- `sessionName: eval-ses-02`

**通过判断**: exit code 0；`headed: true`
**失败时排查**: 检查是否有显示环境（headless CI 中此测试可跳过）；`pw session close eval-ses-02`

---

### TC-003: session create --open URL 跳转

**能力域**: Session
**测试目标**: 验证 --open 参数使 session 启动后直接导航到目标 URL
**前置条件**: 无已有同名 session
**执行命令**:
```
pw session create eval-ses-03 --open http://localhost:3099/login
```
**预期输出包含**:
- `created: true`
- page URL 包含 `/login`

**通过判断**: exit code 0；page.url 包含 `localhost:3099/login`
**失败时排查**: 检查 test-app 是否运行；确认路由 `/login` 可访问

---

### TC-004: session status 查询存活 session

**能力域**: Session
**测试目标**: 验证对已存活 session 查询 status 返回正确元数据
**前置条件**: TC-001 中 eval-ses-01 已创建
**执行命令**:
```
pw session status eval-ses-01
```
**预期输出包含**:
- `active: true`
- `socketPath`
- `version`
- session name `eval-ses-01`

**通过判断**: exit code 0；`active: true`
**失败时排查**: 先运行 TC-001 确保 session 存在；`pw session list`

---

### TC-005: session status 查询不存在的 session

**能力域**: Session
**测试目标**: 验证对不存在 session 查询返回 SESSION_NOT_FOUND 错误
**前置条件**: 不存在名为 eval-ses-nonexistent 的 session
**执行命令**:
```
pw session status eval-ses-nonexistent
```
**预期输出包含**:
- `SESSION_NOT_FOUND` 或 `SESSION_STATUS_FAILED`
- suggestions 包含 `pw session list`

**通过判断**: exit code 非 0；输出包含 NOT_FOUND 相关错误码
**失败时排查**: 确认该 session 名确实不存在；`pw session list`

---

### TC-006: session list 列出所有 session

**能力域**: Session
**测试目标**: 验证 session list 列出所有 managed session 并包含 count 字段
**前置条件**: 至少有 eval-ses-01 存活
**执行命令**:
```
pw session list
```
**预期输出包含**:
- `count`
- sessions 数组
- 每个 session 含 `name`、`alive` 字段

**通过判断**: exit code 0；`count >= 1`；sessions 数组非空
**失败时排查**: `pw session create eval-ses-01 --open http://localhost:3099`

---

### TC-007: session list --with-page 含页面摘要

**能力域**: Session
**测试目标**: 验证 --with-page 为每个 live session 补充页面摘要
**前置条件**: TC-001 中 eval-ses-01 已创建并存活
**执行命令**:
```
pw session list --with-page
```
**预期输出包含**:
- `withPage: true`
- 至少一个 session 含 `page` 字段

**通过判断**: exit code 0；`withPage: true`；存活 session 有 `page` 对象
**失败时排查**: 确认 eval-ses-01 存活；`pw session status eval-ses-01`

---

### TC-008: session recreate 重建 session

**能力域**: Session
**测试目标**: 验证 session recreate 关闭后重建 session 并自动恢复状态
**前置条件**: eval-ses-01 已创建
**执行命令**:
```
pw session recreate eval-ses-01 --open http://localhost:3099/login
```
**预期输出包含**:
- `recreated: true`
- page URL 含 `/login`

**通过判断**: exit code 0；`recreated: true`
**失败时排查**: `pw session status eval-ses-01`；如报 SESSION_RECREATE_STARTUP_TIMEOUT 则换名 create

---

### TC-009: session attach --attachable 发现可接管 browser

**能力域**: Session
**测试目标**: 验证 session list --attachable 能列出当前 workspace 的可接管 browser servers
**前置条件**: 有存活 session
**执行命令**:
```
pw session list --attachable
```
**预期输出包含**:
- `capability.capability: "existing-browser-attach"`
- `capability.supported`
- `attachable.servers`（可以是空数组）

**通过判断**: exit code 0；capability 字段存在
**失败时排查**: 检查 Playwright workspace 目录是否正常；`pw doctor`

---

### TC-010: session close 关闭单个 session

**能力域**: Session
**测试目标**: 验证 session close 正确关闭指定 session
**前置条件**: eval-ses-02 已创建（TC-002）
**执行命令**:
```
pw session close eval-ses-02
```
**预期输出包含**:
- `closed: true` 或 `name: eval-ses-02`

**通过判断**: exit code 0；后续 `pw session status eval-ses-02` 返回错误
**失败时排查**: 确认 session 名正确；`pw session list` 查看当前存活列表

---

## Domain 2: 页面读取 (TC-011 ~ TC-025)

覆盖页面内容观察的全部命令，从 observe 摘要到 read-text 文本、snapshot 结构树、accessibility、screenshot、pdf。

---

### TC-011: observe status 页面状态全字段

**能力域**: Page Reading
**测试目标**: 验证 observe status 返回完整页面状态摘要（URL、dialogs、routes、console 等）
**前置条件**: eval-ses-01 已创建，导航到 http://localhost:3099/dashboard
**执行命令**:
```
pw open http://localhost:3099/dashboard --session eval-ses-01
pw observe status --session eval-ses-01
```
**预期输出包含**:
- `summary`
- `currentPage`（含 url、title）
- `dialogs`
- `routes`
- `pageErrors`
- `console`
- `network`

**通过判断**: exit code 0；summary、currentPage、dialogs 等字段均存在
**失败时排查**: `pw page current --session eval-ses-01`；确认页面已加载

---

### TC-012: read-text 默认全页文本

**能力域**: Page Reading
**测试目标**: 验证 read-text 默认返回 15000 字符以内的页面可见文本
**前置条件**: eval-ses-01 已登录并在 dashboard 页面
**执行命令**:
```
pw read-text --session eval-ses-01
```
**预期输出包含**:
- 非空文本内容
- dashboard 相关文字（如 "Total Users"、"Active Sessions"）

**通过判断**: exit code 0；返回文本非空，长度 > 0，包含页面可见内容
**失败时排查**: `pw observe status --session eval-ses-01` 确认页面状态；`pw page current --session eval-ses-01`

---

### TC-013: read-text --max-chars 限制字符数

**能力域**: Page Reading
**测试目标**: 验证 --max-chars 参数限制返回文本长度
**前置条件**: eval-ses-01 在任意内容页面
**执行命令**:
```
pw read-text --session eval-ses-01 --max-chars 500
```
**预期输出包含**:
- 文本内容不超过 500 字符加元数据

**通过判断**: exit code 0；返回文本内容部分 <= 500 字符
**失败时排查**: 检查 session 是否存活；`pw session status eval-ses-01`

---

### TC-014: read-text --selector 局部文本读取

**能力域**: Page Reading
**测试目标**: 验证 --selector 参数只读取指定选择器范围内的文本
**前置条件**: eval-ses-01 已导航到 http://localhost:3099/dashboard
**执行命令**:
```
pw read-text --session eval-ses-01 --selector '[data-testid="stat-users"]'
```
**预期输出包含**:
- `Total Users` 或 `12842`

**通过判断**: exit code 0；文本包含 stat-users 区域的内容
**失败时排查**: `pw locate --session eval-ses-01 --selector '[data-testid="stat-users"]'`

---

### TC-015: snapshot 完整结构树

**能力域**: Page Reading
**测试目标**: 验证 snapshot 返回完整 ARIA 结构树
**前置条件**: eval-ses-01 在任意页面
**执行命令**:
```
pw snapshot --session eval-ses-01
```
**预期输出包含**:
- ARIA 树结构文本（含 role、name 信息）

**通过判断**: exit code 0；输出包含 ARIA role 描述（如 `heading`、`button`、`link`）
**失败时排查**: `pw observe status --session eval-ses-01`；确认页面已稳定加载

---

### TC-016: snapshot -i 只输出可交互节点

**能力域**: Page Reading
**测试目标**: 验证 --interactive/-i 只返回可交互的 ARIA 节点及 ref
**前置条件**: eval-ses-01 在含表单或按钮的页面（/login 或 /forms）
**执行命令**:
```
pw open http://localhost:3099/login --session eval-ses-01
pw snapshot -i --session eval-ses-01
```
**预期输出包含**:
- 交互元素（button、input、link）
- 每个节点有 ref（如 `e12`）

**通过判断**: exit code 0；输出含 button/input/link 节点和 ref
**失败时排查**: `pw read-text --session eval-ses-01` 确认页面有内容

---

### TC-017: snapshot -c 紧凑模式

**能力域**: Page Reading
**测试目标**: 验证 --compact/-c 移除低信号结构节点，输出更紧凑
**前置条件**: eval-ses-01 在任意页面
**执行命令**:
```
pw snapshot -c --session eval-ses-01
```
**预期输出包含**:
- 精简 ARIA 结构，去除 generic/none role 节点

**通过判断**: exit code 0；输出比全量 snapshot 更短
**失败时排查**: 先确认 `pw snapshot --session eval-ses-01` 成功

---

### TC-018: accessibility 基本 ARIA 树

**能力域**: Page Reading
**测试目标**: 验证 accessibility 命令返回 ARIA accessibility tree
**前置条件**: eval-ses-01 在 /dashboard
**执行命令**:
```
pw accessibility --session eval-ses-01
```
**预期输出包含**:
- ARIA 树（含 role、name 字段）

**通过判断**: exit code 0；输出包含 role 字段描述
**失败时排查**: `pw doctor --session eval-ses-01`；确认 Playwright 版本支持 ariaSnapshot

---

### TC-019: accessibility --interactive-only 仅交互节点

**能力域**: Page Reading
**测试目标**: 验证 --interactive-only/-i 只返回可交互节点
**前置条件**: eval-ses-01 在 /login（含 input 和 button）
**执行命令**:
```
pw open http://localhost:3099/login --session eval-ses-01
pw accessibility -i --session eval-ses-01
```
**预期输出包含**:
- 仅 button、input、link 等可交互节点

**通过判断**: exit code 0；输出节点均为可交互类型
**失败时排查**: 对比 `pw accessibility --session eval-ses-01` 输出

---

### TC-020: screenshot 基本截图

**能力域**: Page Reading
**测试目标**: 验证 screenshot 生成截图文件并返回 artifact 路径
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw screenshot --session eval-ses-01
```
**预期输出包含**:
- `path` 字段（截图文件路径，.png）

**通过判断**: exit code 0；path 字段非空；文件存在于磁盘
**失败时排查**: `pw observe status --session eval-ses-01`；检查磁盘空间

---

### TC-021: screenshot --full-page 全页截图

**能力域**: Page Reading
**测试目标**: 验证 --full-page 生成完整页面截图（不裁剪）
**前置条件**: eval-ses-01 在有内容的页面
**执行命令**:
```
pw screenshot --session eval-ses-01 --full-page
```
**预期输出包含**:
- `path` 字段（截图文件路径）

**通过判断**: exit code 0；path 存在；文件大小通常比 viewport 截图大
**失败时排查**: 同 TC-020

---

### TC-022: pdf 生成 PDF 文件

**能力域**: Page Reading
**测试目标**: 验证 pdf 命令将当前页面导出为 PDF 文件
**前置条件**: eval-ses-01 在 /dashboard
**执行命令**:
```
pw pdf --session eval-ses-01 --path /tmp/eval-test.pdf
```
**预期输出包含**:
- `path: /tmp/eval-test.pdf` 或等效路径

**通过判断**: exit code 0；PDF 文件存在于 /tmp/eval-test.pdf
**失败时排查**: 确认 Chromium 支持 PDF 导出；`pw doctor --session eval-ses-01`

---

### TC-023: page current 字段验证

**能力域**: Page Reading
**测试目标**: 验证 page current 返回完整的当前页面元数据字段
**前置条件**: eval-ses-01 已导航到任意 URL
**执行命令**:
```
pw page current --session eval-ses-01
```
**预期输出包含**:
- `pageId`（如 `p1`）
- `url`
- `title`
- `navigationId`

**通过判断**: exit code 0；pageId、url、title、navigationId 均存在
**失败时排查**: `pw session status eval-ses-01`

---

### TC-024: page frames 列出 iframe

**能力域**: Page Reading
**测试目标**: 验证 page frames 列出页面的所有 frame 信息
**前置条件**: eval-ses-01 在任意页面（即使无 iframe 也应返回 main frame）
**执行命令**:
```
pw page frames --session eval-ses-01
```
**预期输出包含**:
- frames 数组
- 每个 frame 含 `url`、`name` 字段
- 至少有一个 main frame

**通过判断**: exit code 0；frames 数组长度 >= 1
**失败时排查**: `pw page current --session eval-ses-01`

---

### TC-025: page assess 页面评估摘要

**能力域**: Page Reading
**测试目标**: 验证 page assess 返回 compact 页面评估摘要和 nextSteps
**前置条件**: eval-ses-01 在 /dashboard
**执行命令**:
```
pw page assess --session eval-ses-01
```
**预期输出包含**:
- `summary`
- `nextSteps`（建议下一步命令）
- `dataHints` 或 `complexityHints`

**通过判断**: exit code 0；summary 和 nextSteps 字段均存在
**失败时排查**: `pw read-text --session eval-ses-01` 确认页面有内容；`pw page current --session eval-ses-01`

---

## Domain 3: 导航与 Workspace (TC-026 ~ TC-035)

覆盖 open 导航、tab 多页面管理（select/close）、wait 的各种等待条件。

---

### TC-026: open 导航到新 URL

**能力域**: Navigation & Workspace
**测试目标**: 验证 open 命令在已有 session 中导航到新 URL
**前置条件**: eval-ses-01 已创建
**执行命令**:
```
pw open http://localhost:3099/login --session eval-ses-01
```
**预期输出包含**:
- URL 包含 `/login`
- `page` 字段含 url

**通过判断**: exit code 0；page.url 包含 `localhost:3099/login`
**失败时排查**: `pw session status eval-ses-01`；确认 test-app 运行

---

### TC-027: tab list 多 tab 场景

**能力域**: Navigation & Workspace
**测试目标**: 验证打开多 tab 后 page list 能列出所有 pageId
**前置条件**: eval-ses-01 在 /tabs 页面（含新 tab 链接）
**执行命令**:
```
pw open http://localhost:3099/tabs --session eval-ses-01
pw click --session eval-ses-01 --test-id link-new-tab-child
pw page list --session eval-ses-01
```
**预期输出包含**:
- pages 数组，长度 >= 2
- 每个 page 含 `pageId`、`url`、`current`

**通过判断**: exit code 0；pages 数组 length >= 2；每个 page 有 pageId
**失败时排查**: `pw observe status --session eval-ses-01` 检查 tab 数量

---

### TC-028: tab select 按 pageId 切换

**能力域**: Navigation & Workspace
**测试目标**: 验证 tab select 使用 pageId 正确切换 active tab
**前置条件**: TC-027 已执行，有多个 tab，已知第二个 tab 的 pageId
**执行命令**:
```
pw page list --session eval-ses-01 --output json
# 取第二个 page 的 pageId（假设为 p2）
pw tab select p2 --session eval-ses-01
pw page current --session eval-ses-01
```
**预期输出包含**:
- tab select 成功
- page current 返回 p2 的 URL（`/tabs/child`）

**通过判断**: exit code 0；切换后 page.current 的 pageId 等于目标 pageId
**失败时排查**: `pw page list --session eval-ses-01`；确认 pageId 正确

---

### TC-029: tab close 关闭 tab 并验证 fallback

**能力域**: Navigation & Workspace
**测试目标**: 验证 tab close 关闭非 active tab 后正确回退到另一个 tab
**前置条件**: 有多个 tab 的 session，已知要关闭的 pageId
**执行命令**:
```
# 假设 p2 是子 tab
pw tab close p2 --session eval-ses-01
pw page list --session eval-ses-01
```
**预期输出包含**:
- tab close 成功
- page list 返回的 pages 数量减少

**通过判断**: exit code 0；pages 数组减少一个
**失败时排查**: `pw page list --session eval-ses-01` 确认 pageId 有效

---

### TC-030: wait --navigation 等待导航完成

**能力域**: Navigation & Workspace
**测试目标**: 验证 wait network-idle（--networkidle）等待页面加载稳定
**前置条件**: eval-ses-01 已存活
**执行命令**:
```
pw open http://localhost:3099/dashboard --session eval-ses-01
pw wait network-idle --session eval-ses-01
```
**预期输出包含**:
- 等待成功完成，无 timeout 错误

**通过判断**: exit code 0；无 timeout 错误
**失败时排查**: 如 timeout，检查 /dashboard 是否有长时间 pending 请求

---

### TC-031: wait --selector 等待元素出现

**能力域**: Navigation & Workspace
**测试目标**: 验证 wait --selector 等待指定选择器出现
**前置条件**: eval-ses-01 已导航到 /dashboard
**执行命令**:
```
pw open http://localhost:3099/dashboard --session eval-ses-01
pw wait --selector '[data-testid="stat-users"]' --session eval-ses-01
```
**预期输出包含**:
- 等待成功，无超时错误

**通过判断**: exit code 0；selector 等待成功
**失败时排查**: `pw locate --session eval-ses-01 --selector '[data-testid="stat-users"]'` 确认元素存在

---

### TC-032: wait --text 等待文本出现

**能力域**: Navigation & Workspace
**测试目标**: 验证 wait --text 等待页面出现指定文本
**前置条件**: eval-ses-01 已导航到 /dashboard
**执行命令**:
```
pw wait --text 'Total Users' --session eval-ses-01
```
**预期输出包含**:
- 等待成功

**通过判断**: exit code 0
**失败时排查**: `pw read-text --session eval-ses-01` 确认文本存在

---

### TC-033: wait --idle 网络空闲等待

**能力域**: Navigation & Workspace
**测试目标**: 验证 wait --networkidle 等待网络请求静止
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw open http://localhost:3099/network --session eval-ses-01
pw wait --networkidle --session eval-ses-01
```
**预期输出包含**:
- 等待完成，无错误

**通过判断**: exit code 0
**失败时排查**: 如超时，检查 /network 页面是否有持续轮询请求

---

### TC-034: page dialogs 查看 dialog 投影

**能力域**: Navigation & Workspace
**测试目标**: 验证 page dialogs 返回当前 session 的 dialog 事件投影
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw page dialogs --session eval-ses-01
```
**预期输出包含**:
- dialogs 字段（可能为空数组）
- 无错误

**通过判断**: exit code 0；dialogs 字段存在
**失败时排查**: `pw session status eval-ses-01`

---

### TC-035: resize viewport 调整视口

**能力域**: Navigation & Workspace
**测试目标**: 验证 resize 调整浏览器视口尺寸
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw resize --session eval-ses-01 --view 1280x800
```
**预期输出包含**:
- resize 成功
- width、height 字段

**通过判断**: exit code 0；输出包含新的 viewport 尺寸
**失败时排查**: `pw session status eval-ses-01`；确认 session 存活

---

## Domain 4: 交互操作 (TC-036 ~ TC-055)

覆盖 click、fill、type、press、hover、select、check/uncheck、drag、upload、download、scroll、mouse 等全部交互命令。

---

### TC-036: click selector 按选择器点击

**能力域**: Interaction
**测试目标**: 验证 click --selector 能正确点击指定元素
**前置条件**: eval-ses-01 在 /login 页面
**执行命令**:
```
pw open http://localhost:3099/login --session eval-ses-01
pw click --session eval-ses-01 --selector '[data-testid="login-submit"]'
```
**预期输出包含**:
- `acted: true` 或 click 成功
- `target` 字段

**通过判断**: exit code 0；`acted: true`
**失败时排查**: `pw locate --session eval-ses-01 --selector '[data-testid="login-submit"]'`

---

### TC-037: click role/name 语义定位点击

**能力域**: Interaction
**测试目标**: 验证 click --role --name 使用语义定位点击按钮
**前置条件**: eval-ses-01 在 /login 页面
**执行命令**:
```
pw click --session eval-ses-01 --role button --name 'Sign in'
```
**预期输出包含**:
- `acted: true`

**通过判断**: exit code 0；`acted: true`
**失败时排查**: `pw locate --session eval-ses-01 --role button --name 'Sign in'`

---

### TC-038: click ref 使用 aria ref 点击

**能力域**: Interaction
**测试目标**: 验证使用 snapshot 返回的 ref 执行精确点击
**前置条件**: eval-ses-01 在 /login 页面，已获取 ref
**执行命令**:
```
pw snapshot -i --session eval-ses-01 --output json
# 取 Sign in 按钮的 ref（如 e5）
pw click e5 --session eval-ses-01
```
**预期输出包含**:
- `acted: true`

**通过判断**: exit code 0；`acted: true`
**失败时排查**: 确认 ref 来自最新 snapshot；如报 REF_STALE 则重新取 ref

---

### TC-039: fill 填充各类 input

**能力域**: Interaction
**测试目标**: 验证 fill 能正确填充 text、email、password 等类型的 input
**前置条件**: eval-ses-01 在 /login 页面
**执行命令**:
```
pw fill --session eval-ses-01 --label 'Email address' 'demo@test.com'
pw fill --session eval-ses-01 --label 'Password' 'password123'
```
**预期输出包含**:
- 两次 fill 均成功，`acted: true`

**通过判断**: exit code 0（两次均）；`acted: true`
**失败时排查**: `pw snapshot -i --session eval-ses-01` 确认 label 存在

---

### TC-040: type 逐字符输入

**能力域**: Interaction
**测试目标**: 验证 type 命令模拟逐字符键盘输入
**前置条件**: eval-ses-01 在 /forms 页面
**执行命令**:
```
pw open http://localhost:3099/forms --session eval-ses-01
pw type --session eval-ses-01 --label 'Full name' 'John Doe'
```
**预期输出包含**:
- `acted: true`

**通过判断**: exit code 0；`acted: true`
**失败时排查**: `pw locate --session eval-ses-01 --label 'Full name'`

---

### TC-041: press 按键（Enter/Tab/Escape）

**能力域**: Interaction
**测试目标**: 验证 press 命令触发特殊按键事件
**前置条件**: eval-ses-01 在 /login 页面，表单已填好
**执行命令**:
```
pw press Enter --session eval-ses-01
```
**预期输出包含**:
- `acted: true`

**通过判断**: exit code 0；`acted: true`
**失败时排查**: 确认页面有 focused element 或 active 表单

---

### TC-042: hover 触发 tooltip

**能力域**: Interaction
**测试目标**: 验证 hover 命令触发 hover 效果，tooltip 出现
**前置条件**: eval-ses-01 在 /interactions 页面
**执行命令**:
```
pw open http://localhost:3099/interactions --session eval-ses-01
pw hover --session eval-ses-01 --test-id hover-target
pw read-text --session eval-ses-01
```
**预期输出包含**:
- hover 成功，`acted: true`
- read-text 返回 "Tooltip visible!"

**通过判断**: exit code 0；hover 成功；随后 read-text 含 "Tooltip visible!"
**失败时排查**: `pw locate --session eval-ses-01 --test-id hover-target`

---

### TC-043: select 下拉选项

**能力域**: Interaction
**测试目标**: 验证 select 命令选择 `<select>` 下拉的指定 option
**前置条件**: eval-ses-01 在 /forms 页面
**执行命令**:
```
pw open http://localhost:3099/forms --session eval-ses-01
pw select --session eval-ses-01 --label 'Country' 'us'
```
**预期输出包含**:
- `value: "us"` 或 select 成功

**通过判断**: exit code 0；`value` 或 `values` 字段包含 `us`
**失败时排查**: `pw locate --session eval-ses-01 --label 'Country'`

---

### TC-044: check checkbox

**能力域**: Interaction
**测试目标**: 验证 check 命令勾选 checkbox
**前置条件**: eval-ses-01 在 /login 页面（含 Remember me 复选框）
**执行命令**:
```
pw open http://localhost:3099/login --session eval-ses-01
pw check --session eval-ses-01 --label 'Remember me'
```
**预期输出包含**:
- `acted: true`

**通过判断**: exit code 0；`acted: true`
**失败时排查**: `pw locate --session eval-ses-01 --label 'Remember me'`

---

### TC-045: uncheck checkbox

**能力域**: Interaction
**测试目标**: 验证 uncheck 命令取消勾选已选中的 checkbox
**前置条件**: eval-ses-01 在 /login，Remember me 已勾选（TC-044 后）
**执行命令**:
```
pw uncheck --session eval-ses-01 --label 'Remember me'
```
**预期输出包含**:
- `acted: true`

**通过判断**: exit code 0；`acted: true`；后续 `pw is checked --label 'Remember me'` 返回 false
**失败时排查**: `pw is checked --session eval-ses-01 --label 'Remember me'` 确认当前状态

---

### TC-046: drag 拖拽排序

**能力域**: Interaction
**测试目标**: 验证 drag --from-selector --to-selector 执行拖拽排序
**前置条件**: eval-ses-01 在 /interactions 页面（含 Drag & Drop Sort）
**执行命令**:
```
pw open http://localhost:3099/interactions --session eval-ses-01
pw drag --session eval-ses-01 --from-selector '[data-testid="drag-item-0"]' --to-selector '[data-testid="drag-item-2"]'
```
**预期输出包含**:
- `acted: true`

**通过判断**: exit code 0；`acted: true`
**失败时排查**: `pw locate --session eval-ses-01 --selector '[data-testid="drag-item-0"]'`

---

### TC-047: upload 文件上传

**能力域**: Interaction
**测试目标**: 验证 upload 命令设置文件 input 并返回上传反馈
**前置条件**: eval-ses-01 在 /forms 页面；本地有测试文件 /tmp/eval-upload.txt
**执行命令**:
```
echo "eval upload test" > /tmp/eval-upload.txt
pw open http://localhost:3099/forms --session eval-ses-01
pw upload --session eval-ses-01 --selector '[data-testid="file-input"]' /tmp/eval-upload.txt
```
**预期输出包含**:
- `uploaded: true` 或 `acted: true`
- 文件名 `eval-upload.txt`

**通过判断**: exit code 0；文件名出现在输出中
**失败时排查**: 确认 /tmp/eval-upload.txt 存在；`pw locate --session eval-ses-01 --selector '[data-testid="file-input"]'`

---

### TC-048: download 文件下载并验证 artifact

**能力域**: Interaction
**测试目标**: 验证 download 命令触发文件下载并返回 artifact 路径
**前置条件**: eval-ses-01 在 /interactions 页面（含 Download server file）
**执行命令**:
```
pw open http://localhost:3099/interactions --session eval-ses-01
pw download --session eval-ses-01 --selector '[data-testid="download-server-txt"]'
```
**预期输出包含**:
- `path` 字段（下载文件路径）
- 文件后缀 `.txt`

**通过判断**: exit code 0；path 字段非空；文件存在于磁盘
**失败时排查**: `pw observe status --session eval-ses-01` 确认页面加载；`pw locate --session eval-ses-01 --selector '[data-testid="download-server-txt"]'`

---

### TC-049: scroll 向下滚动

**能力域**: Interaction
**测试目标**: 验证 scroll down 命令滚动页面
**前置条件**: eval-ses-01 在有内容可滚动的页面
**执行命令**:
```
pw open http://localhost:3099/dynamic --session eval-ses-01
pw scroll down 500 --session eval-ses-01
```
**预期输出包含**:
- `acted: true` 或 scroll 成功

**通过判断**: exit code 0；无错误
**失败时排查**: 确认页面高度 > viewport；`pw observe status --session eval-ses-01`

---

### TC-050: scroll up 向上滚动

**能力域**: Interaction
**测试目标**: 验证 scroll up 命令向上滚动页面
**前置条件**: eval-ses-01 页面已向下滚动
**执行命令**:
```
pw scroll up 500 --session eval-ses-01
```
**预期输出包含**:
- `acted: true` 或 scroll 成功

**通过判断**: exit code 0；无错误
**失败时排查**: 同 TC-049

---

### TC-051: mouse move 移动鼠标

**能力域**: Interaction
**测试目标**: 验证 mouse move --x --y 将鼠标移动到指定坐标
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw mouse move --session eval-ses-01 --x 400 --y 300
```
**预期输出包含**:
- 无错误，move 成功

**通过判断**: exit code 0
**失败时排查**: `pw session status eval-ses-01`

---

### TC-052: mouse click 坐标点击

**能力域**: Interaction
**测试目标**: 验证 mouse click --x --y 在指定坐标点击
**前置条件**: eval-ses-01 在 /interactions 页面，已知 Primary 按钮坐标
**执行命令**:
```
pw open http://localhost:3099/interactions --session eval-ses-01
pw mouse click --session eval-ses-01 --x 400 --y 300
```
**预期输出包含**:
- 无错误

**通过判断**: exit code 0；无错误
**失败时排查**: 使用 `pw snapshot -i --session eval-ses-01` 确认元素位置

---

### TC-053: mouse wheel 滚动滚轮

**能力域**: Interaction
**测试目标**: 验证 mouse wheel --delta-y 触发滚轮事件
**前置条件**: eval-ses-01 在可滚动页面
**执行命令**:
```
pw mouse wheel --session eval-ses-01 --delta-x 0 --delta-y 300
```
**预期输出包含**:
- 无错误

**通过判断**: exit code 0
**失败时排查**: `pw session status eval-ses-01`

---

### TC-054: click 触发 popup 新页面

**能力域**: Interaction
**测试目标**: 验证 click 触发新 tab/popup 时输出包含 openedPage 字段
**前置条件**: eval-ses-01 在 /tabs 页面
**执行命令**:
```
pw open http://localhost:3099/tabs --session eval-ses-01
pw click --session eval-ses-01 --test-id link-new-tab-child
```
**预期输出包含**:
- `openedPage` 字段
- `openedPage.pageId`
- `openedPage.url` 含 `/tabs/child`

**通过判断**: exit code 0；`openedPage.pageId` 非空
**失败时排查**: `pw observe status --session eval-ses-01`；确认 tab 数量变化

---

### TC-055: mouse dblclick 双击

**能力域**: Interaction
**测试目标**: 验证 mouse dblclick 在指定坐标执行双击
**前置条件**: eval-ses-01 在 /interactions 页面，双击目标可见
**执行命令**:
```
pw open http://localhost:3099/interactions --session eval-ses-01
pw locate --session eval-ses-01 --test-id dblclick-target --output json
# 记录坐标或直接用 mouse dblclick
pw mouse dblclick --session eval-ses-01 --x 400 --y 400
```
**预期输出包含**:
- 无错误

**通过判断**: exit code 0；无错误
**失败时排查**: 改用 `pw click --test-id dblclick-target --session eval-ses-01` 确认目标可点击

---

## Domain 5: Batch (TC-056 ~ TC-062)

Batch 接受 `string[][]` 格式的步骤列表，在单个 session 上串行执行。

---

### TC-056: batch 单命令执行

**能力域**: Batch
**测试目标**: 验证 batch 执行单个命令并返回结果摘要
**前置条件**: eval-ses-01 存活
**执行命令**:
```
echo '[["observe", "status"]]' | pw batch --session eval-ses-01 --stdin-json
```
**预期输出包含**:
- `summary`
- `stepsTotal: 1`
- `successCount: 1`

**通过判断**: exit code 0；successCount = 1
**失败时排查**: 检查 JSON 格式；`pw observe status --session eval-ses-01` 单独运行

---

### TC-057: batch 混合 fill + press + click

**能力域**: Batch
**测试目标**: 验证 batch 串行执行多步 fill、press、click，完成登录流程
**前置条件**: eval-ses-02 在 /login 页面
**执行命令**:
```
pw session create eval-ses-b1 --open http://localhost:3099/login
printf '[["fill", "--label", "Email address", "demo@test.com"], ["fill", "--label", "Password", "password123"], ["click", "--role", "button", "--name", "Sign in"]]' | pw batch --session eval-ses-b1 --stdin-json
```
**预期输出包含**:
- `stepsTotal: 3`
- `successCount: 3`

**通过判断**: exit code 0；三步均成功
**失败时排查**: `pw observe status --session eval-ses-b1`；单独测试每个命令

---

### TC-058: batch 表单填写完整流程

**能力域**: Batch
**测试目标**: 验证 batch 完成包含多字段的表单填写
**前置条件**: eval-ses-b1 已登录，导航到 /forms
**执行命令**:
```
pw open http://localhost:3099/forms --session eval-ses-b1
printf '[["fill", "--label", "Full name", "Alice Test"], ["fill", "--label", "Email address", "alice@test.com"], ["select", "--label", "Country", "us"]]' | pw batch --session eval-ses-b1 --stdin-json
```
**预期输出包含**:
- `stepsTotal: 3`
- `successCount: 3`

**通过判断**: exit code 0；3 步均成功
**失败时排查**: `pw observe status --session eval-ses-b1`

---

### TC-059: batch 错误处理 SESSION_NOT_FOUND

**能力域**: Batch
**测试目标**: 验证对不存在的 session 执行 batch 返回 SESSION_NOT_FOUND 错误
**前置条件**: 不存在名为 eval-ses-ghost 的 session
**执行命令**:
```
echo '[["observe", "status"]]' | pw batch --session eval-ses-ghost --stdin-json
```
**预期输出包含**:
- `SESSION_NOT_FOUND` 或相关错误码

**通过判断**: exit code 非 0；错误码包含 NOT_FOUND
**失败时排查**: 确认该 session 名不存在；`pw session list`

---

### TC-060: batch --continue-on-error 部分失败继续

**能力域**: Batch
**测试目标**: 验证 --continue-on-error 在步骤失败后继续执行后续步骤
**前置条件**: eval-ses-b1 存活
**执行命令**:
```
printf '[["click", "--selector", "#nonexistent-element-xyz"], ["observe", "status"]]' | pw batch --session eval-ses-b1 --stdin-json --continue-on-error
```
**预期输出包含**:
- `stepsTotal: 2`
- `successCount: 1`（observe status 成功）
- `failureCount: 1`（click 失败）

**通过判断**: exit code 0（continue-on-error 不因单步失败终止）；failureCount = 1；successCount = 1
**失败时排查**: 确认 `--continue-on-error` flag 正确传递

---

### TC-061: batch --summary-only 只看汇总

**能力域**: Batch
**测试目标**: 验证 --summary-only 只返回汇总信息，不展开每步结果
**前置条件**: eval-ses-b1 存活
**执行命令**:
```
printf '[["observe", "status"], ["read-text"]]' | pw batch --session eval-ses-b1 --stdin-json --output json --summary-only
```
**预期输出包含**:
- `data.summary`（含 stepsTotal、successCount）
- 不含完整 step results

**通过判断**: exit code 0；data.summary 存在；data.results 不含完整 payload
**失败时排查**: 去掉 `--summary-only` 后重跑，确认 results 正常

---

### TC-062: batch --include-results 包含完整步骤结果

**能力域**: Batch
**测试目标**: 验证 --include-results 在 JSON 输出中包含每步完整结果
**前置条件**: eval-ses-b1 存活
**执行命令**:
```
printf '[["observe", "status"]]' | pw batch --session eval-ses-b1 --stdin-json --output json --include-results
```
**预期输出包含**:
- `data.results[0]`（含完整 step 输出）

**通过判断**: exit code 0；data.results 数组非空，results[0] 含命令详情
**失败时排查**: 去掉 `--include-results` 确认 batch 基本功能正常

---

## Domain 6: Verify & Get (TC-063 ~ TC-072)

read-only 断言命令家族，用于 Agent 循环中验证页面状态。

---

### TC-063: verify text 文本断言通过

**能力域**: Verify & Get
**测试目标**: 验证 verify text 在文本存在时返回 passed: true
**前置条件**: eval-ses-01 在 /dashboard（含 "Total Users"）
**执行命令**:
```
pw open http://localhost:3099/dashboard --session eval-ses-01
pw verify text --session eval-ses-01 --text 'Total Users'
```
**预期输出包含**:
- `passed: true`
- `assertion: "text"`

**通过判断**: exit code 0；`passed: true`
**失败时排查**: `pw read-text --session eval-ses-01` 确认文本存在

---

### TC-064: verify text-absent 文本不存在断言

**能力域**: Verify & Get
**测试目标**: 验证 verify text-absent 在文本不存在时返回 passed: true
**前置条件**: eval-ses-01 在 /dashboard
**执行命令**:
```
pw verify text-absent --session eval-ses-01 --text 'THIS_VERY_UNIQUE_STRING_SHOULDNOTEXIST'
```
**预期输出包含**:
- `passed: true`

**通过判断**: exit code 0；`passed: true`
**失败时排查**: 确认该字符串确实不在页面上；`pw read-text --session eval-ses-01`

---

### TC-065: verify visible 元素可见断言

**能力域**: Verify & Get
**测试目标**: 验证 verify visible 对可见元素返回 passed: true
**前置条件**: eval-ses-01 在 /dashboard
**执行命令**:
```
pw verify visible --session eval-ses-01 --selector '[data-testid="stat-users"]'
```
**预期输出包含**:
- `passed: true`
- `assertion: "visible"`

**通过判断**: exit code 0；`passed: true`
**失败时排查**: `pw locate --session eval-ses-01 --selector '[data-testid="stat-users"]'`

---

### TC-066: verify enabled/disabled 按钮状态

**能力域**: Verify & Get
**测试目标**: 验证 verify disabled 对禁用按钮返回 passed: true
**前置条件**: eval-ses-01 在 /interactions（含 disabled button）
**执行命令**:
```
pw open http://localhost:3099/interactions --session eval-ses-01
pw verify disabled --session eval-ses-01 --selector '[data-testid="btn-disabled"]'
```
**预期输出包含**:
- `passed: true`

**通过判断**: exit code 0；`passed: true`
**失败时排查**: `pw is enabled --session eval-ses-01 --selector '[data-testid="btn-disabled"]'`

---

### TC-067: verify url 包含断言

**能力域**: Verify & Get
**测试目标**: 验证 verify url --contains 对当前 URL 进行子串断言
**前置条件**: eval-ses-01 在 /dashboard
**执行命令**:
```
pw open http://localhost:3099/dashboard --session eval-ses-01
pw verify url --session eval-ses-01 --contains '/dashboard'
```
**预期输出包含**:
- `passed: true`

**通过判断**: exit code 0；`passed: true`
**失败时排查**: `pw page current --session eval-ses-01` 确认 URL

---

### TC-068: verify count 元素数量断言

**能力域**: Verify & Get
**测试目标**: 验证 verify count --equals 对元素数量进行精确断言
**前置条件**: eval-ses-01 在 /dashboard（含 4 个 stat 卡片）
**执行命令**:
```
pw verify count --session eval-ses-01 --selector '[data-testid^="stat-"]' --equals 4
```
**预期输出包含**:
- `passed: true`
- `count: 4`

**通过判断**: exit code 0；`passed: true`；count = 4
**失败时排查**: `pw get count --session eval-ses-01 --selector '[data-testid^="stat-"]'`

---

### TC-069: get text 获取元素文本

**能力域**: Verify & Get
**测试目标**: 验证 get text --selector 返回元素的 textContent
**前置条件**: eval-ses-01 在 /dashboard
**执行命令**:
```
pw get text --session eval-ses-01 --selector '[data-testid="stat-users"] .text-2xl'
```
**预期输出包含**:
- `text` 字段（包含数字文本）
- `count: 1`

**通过判断**: exit code 0；text 字段非空
**失败时排查**: `pw locate --session eval-ses-01 --selector '[data-testid="stat-users"]'`；使用更宽泛的选择器

---

### TC-070: locate 语义定位

**能力域**: Verify & Get
**测试目标**: 验证 locate --text 返回匹配元素列表和 metadata
**前置条件**: eval-ses-01 在 /dashboard
**执行命令**:
```
pw locate --session eval-ses-01 --text 'Total Users'
```
**预期输出包含**:
- `count >= 1`
- candidates 含 `text`、`tagName`、`visible`

**通过判断**: exit code 0；count >= 1
**失败时排查**: `pw read-text --session eval-ses-01` 确认文本存在

---

### TC-071: is visible/enabled/checked 状态查询

**能力域**: Verify & Get
**测试目标**: 验证 is visible 命令对存在元素返回 value: true
**前置条件**: eval-ses-01 在 /login
**执行命令**:
```
pw open http://localhost:3099/login --session eval-ses-01
pw is visible --session eval-ses-01 --selector '[data-testid="login-submit"]'
```
**预期输出包含**:
- `value: true`

**通过判断**: exit code 0；`value: true`
**失败时排查**: `pw locate --session eval-ses-01 --selector '[data-testid="login-submit"]'`

---

### TC-072: verify VERIFY_FAILED 断言失败

**能力域**: Verify & Get
**测试目标**: 验证 verify 断言失败时 exit code 非 0，输出包含 VERIFY_FAILED
**前置条件**: eval-ses-01 在 /dashboard
**执行命令**:
```
pw verify text --session eval-ses-01 --text 'THIS_VERY_UNIQUE_ABSENT_TEXT_123'
```
**预期输出包含**:
- `VERIFY_FAILED`
- `passed: false`

**通过判断**: exit code 非 0；错误包含 VERIFY_FAILED；passed: false
**失败时排查**: 确认该文本确实不存在；`pw read-text --session eval-ses-01`

---

## Domain 7: 诊断 (TC-073 ~ TC-088)

覆盖 network、console、errors、diagnostics runs/show/bundle/digest/timeline、trace、video、doctor。

---

### TC-073: network list 有请求后列出

**能力域**: Diagnostics
**测试目标**: 验证 network 命令在页面有请求后列出捕获的 network 记录
**前置条件**: eval-ses-01 已访问 /network 页面并触发请求
**执行命令**:
```
pw open http://localhost:3099/network --session eval-ses-01
pw click --session eval-ses-01 --selector '[data-testid="run-all"]' 2>/dev/null || true
pw network --session eval-ses-01
```
**预期输出包含**:
- network 事件列表（request/response）
- 含 url、method、status

**通过判断**: exit code 0；至少有一条 network 记录
**失败时排查**: `pw observe status --session eval-ses-01` 查看 network 计数

---

### TC-074: network --include-body 包含完整 body

**能力域**: Diagnostics
**测试目标**: 验证 --include-body 返回 request/response 完整 body（不只是 snippet）
**前置条件**: eval-ses-01 在 /network 页面，有 POST 请求记录
**执行命令**:
```
pw network --session eval-ses-01 --include-body --limit 5
```
**预期输出包含**:
- `requestBody` 或 `responseBody` 字段（非 snippet）

**通过判断**: exit code 0；response/request body 字段存在
**失败时排查**: 先确认有请求记录；`pw network --session eval-ses-01 --limit 5`

---

### TC-075: console list 查看 console 记录

**能力域**: Diagnostics
**测试目标**: 验证 console 命令列出当前 session 的 console 记录
**前置条件**: eval-ses-01 已访问产生 console 的页面
**执行命令**:
```
pw console --session eval-ses-01
```
**预期输出包含**:
- console 记录列表（可能为空）
- 无错误

**通过判断**: exit code 0；输出格式正确
**失败时排查**: `pw observe status --session eval-ses-01` 查看 console 计数

---

### TC-076: errors list 查看页面错误

**能力域**: Diagnostics
**测试目标**: 验证 errors recent 命令列出当前 session 的页面错误
**前置条件**: eval-ses-01 已访问会产生错误的 URL（/api/data/error 的触发页）
**执行命令**:
```
pw errors recent --session eval-ses-01
```
**预期输出包含**:
- errors 记录列表（可能为空）
- 无错误

**通过判断**: exit code 0；输出格式正确
**失败时排查**: `pw observe status --session eval-ses-01` 查看 errors 计数

---

### TC-077: diagnostics runs 列出 run 摘要

**能力域**: Diagnostics
**测试目标**: 验证 diagnostics runs 列出 .pwcli/runs/ 下的 run 摘要列表
**前置条件**: 已有任意命令执行产生 run 记录
**执行命令**:
```
pw diagnostics runs --session eval-ses-01
```
**预期输出包含**:
- runs 列表（compact 格式：runId session= commands= failures=）

**通过判断**: exit code 0；至少有一条 run 摘要
**失败时排查**: 先执行一次 `pw click` 或 `pw fill` 产生 run；再重试

---

### TC-078: diagnostics show 查看单个 run 详情

**能力域**: Diagnostics
**测试目标**: 验证 diagnostics show --run <runId> 返回单次 run 的事件详情
**前置条件**: 已有 runId（从 TC-077 获取）
**执行命令**:
```
pw diagnostics runs --session eval-ses-01 --output json
# 取第一个 runId
pw diagnostics show --run <runId>
```
**预期输出包含**:
- run 事件列表
- 含 command、timestamp、status 等字段

**通过判断**: exit code 0；events 数组非空
**失败时排查**: 确认 runId 正确；`pw diagnostics runs --limit 10`

---

### TC-079: diagnostics bundle 导出证据包

**能力域**: Diagnostics
**测试目标**: 验证 diagnostics bundle 导出包含 manifest.json 的最小证据包
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw diagnostics bundle --session eval-ses-01 --out /tmp/eval-bundle
```
**预期输出包含**:
- `/tmp/eval-bundle/manifest.json` 存在
- `auditConclusion` 字段

**通过判断**: exit code 0；/tmp/eval-bundle/manifest.json 文件存在
**失败时排查**: 确认 /tmp 可写；`pw session status eval-ses-01`

---

### TC-080: diagnostics digest session 摘要

**能力域**: Diagnostics
**测试目标**: 验证 diagnostics digest --session 返回 live session 的紧凑摘要
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw diagnostics digest --session eval-ses-01
```
**预期输出包含**:
- 当前页 URL
- console/network/error 计数
- top signals

**通过判断**: exit code 0；URL 和计数字段存在
**失败时排查**: `pw observe status --session eval-ses-01`

---

### TC-081: diagnostics timeline 统一时间线

**能力域**: Diagnostics
**测试目标**: 验证 diagnostics timeline 合并 console/network/run 事件为时间序列
**前置条件**: eval-ses-01 已执行多个命令
**执行命令**:
```
pw diagnostics timeline --session eval-ses-01 --limit 20
```
**预期输出包含**:
- 时间线条目列表
- 每条含 timestamp、kind、summary

**通过判断**: exit code 0；有条目；kind 字段存在
**失败时排查**: `pw diagnostics runs --session eval-ses-01` 确认有 run 记录

---

### TC-082: trace start/stop 录制 trace

**能力域**: Diagnostics
**测试目标**: 验证 trace start 开始录制，trace stop 结束录制并返回 artifact 路径
**前置条件**: eval-ses-01 存活，trace 未启动
**执行命令**:
```
pw trace start --session eval-ses-01
pw click --session eval-ses-01 --role button --name 'Primary' 2>/dev/null || true
pw trace stop --session eval-ses-01
```
**预期输出包含**:
- `traceArtifactPath`（.zip 文件路径）

**通过判断**: exit code 0（stop）；traceArtifactPath 非空；文件存在
**失败时排查**: 如已有 trace 在运行，先 `pw trace stop`；`pw observe status --session eval-ses-01`

---

### TC-083: trace inspect 检查 trace 内容

**能力域**: Diagnostics
**测试目标**: 验证 trace inspect --section actions 列出 trace 中的 action 记录
**前置条件**: TC-082 已产生 trace zip 文件
**执行命令**:
```
# traceArtifactPath 为 TC-082 输出的路径
pw trace inspect <traceArtifactPath> --section actions
```
**预期输出包含**:
- actions 列表（来自 Playwright trace CLI）

**通过判断**: exit code 0；action 记录存在
**失败时排查**: 确认 trace zip 文件路径正确；`pw trace inspect <path> --section requests`

---

### TC-084: har replay HAR 回放

**能力域**: Diagnostics
**测试目标**: 验证 har replay 加载 HAR 文件后请求被 mock 拦截
**前置条件**: 有可用的 HAR 文件（可用 har start/stop 录制或使用 fixtures）
**执行命令**:
```
# 先录制一个简单 HAR
pw open http://localhost:3099/api/data --session eval-ses-01
pw har start /tmp/eval-test.har --session eval-ses-01
pw open http://localhost:3099/api/data --session eval-ses-01
pw har stop --session eval-ses-01
# 回放
pw har replay /tmp/eval-test.har --session eval-ses-01
pw open http://localhost:3099/api/data --session eval-ses-01
```
**预期输出包含**:
- har replay 命令成功

**通过判断**: exit code 0（replay）；后续请求被拦截（可用 network 命令验证）
**失败时排查**: HAR 录制可能不稳定，参见 skills/pwcli/references/command-reference-diagnostics.md 中 har 说明

---

### TC-085: doctor 环境检查

**能力域**: Diagnostics
**测试目标**: 验证 doctor 命令执行环境预检并返回节点状态
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw doctor --session eval-ses-01
```
**预期输出包含**:
- 环境检查结果（Node.js 版本、浏览器安装情况）
- `diagnostics` 列表含 `kind: "environment"`

**通过判断**: exit code 0；环境检查结果字段存在
**失败时排查**: `pw doctor` 不加 session 运行基础预检

---

### TC-086: video start/stop 录制视频

**能力域**: Diagnostics
**测试目标**: 验证 video start/stop 录制页面视频并返回 videoPath
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw video start --session eval-ses-01
pw open http://localhost:3099/dashboard --session eval-ses-01
pw video stop --session eval-ses-01
```
**预期输出包含**:
- `videoPath`（视频文件路径）

**通过判断**: exit code 0（stop）；videoPath 非空；视频文件存在
**失败时排查**: `pw session status eval-ses-01`；检查工作目录权限

---

### TC-087: errors clear 清除错误基线

**能力域**: Diagnostics
**测试目标**: 验证 errors clear 清空当前错误基线
**前置条件**: eval-ses-01 存活，可能有错误记录
**执行命令**:
```
pw errors clear --session eval-ses-01
pw errors recent --session eval-ses-01
```
**预期输出包含**:
- clear 成功
- recent 返回空列表或少量记录

**通过判断**: exit code 0（两次均）；clear 后 errors 计数为 0
**失败时排查**: `pw session status eval-ses-01`

---

### TC-088: console --level 按级别过滤

**能力域**: Diagnostics
**测试目标**: 验证 console --level error 只返回 error 级别的 console 记录
**前置条件**: eval-ses-01 存活，访问过 /api/data/error（500 错误）
**执行命令**:
```
pw open http://localhost:3099/network --session eval-ses-01
pw console --session eval-ses-01 --level error --limit 10
```
**预期输出包含**:
- 过滤后的 console 记录（level = error）

**通过判断**: exit code 0；返回的记录 level 均为 error（或空）
**失败时排查**: `pw console --session eval-ses-01` 不加 level 看全部记录

---

## Domain 8: Route & Mock (TC-089 ~ TC-096)

覆盖 route add、patch-text、route list、route remove，以及验证 mock 生效。

---

### TC-089: route add 拦截 GET 请求

**能力域**: Route & Mock
**测试目标**: 验证 route add 为 GET 请求设置 mock 响应
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw route add 'http://localhost:3099/api/data' --session eval-ses-01 --method GET --body '{"mocked":true,"items":[]}' --content-type application/json --status 200
```
**预期输出包含**:
- route 添加成功
- pattern 字段

**通过判断**: exit code 0；route 成功添加
**失败时排查**: `pw route list --session eval-ses-01`；检查 pattern 格式

---

### TC-090: route add patch-text 内容替换

**能力域**: Route & Mock
**测试目标**: 验证 --patch-text 在 upstream 响应中做文本替换
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw route add 'http://localhost:3099/api/data' --session eval-ses-01 --method GET --patch-text 'items=MOCKED_ITEMS'
```
**预期输出包含**:
- route 添加成功

**通过判断**: exit code 0；route 添加成功
**失败时排查**: `pw route list --session eval-ses-01`

---

### TC-091: route list 列出 active routes

**能力域**: Route & Mock
**测试目标**: 验证 route list 返回当前 session 所有 active route metadata
**前置条件**: TC-089 已添加 route
**执行命令**:
```
pw route list --session eval-ses-01
```
**预期输出包含**:
- routes 数组（至少一条）
- 每条含 pattern、method

**通过判断**: exit code 0；routes 数组 length >= 1
**失败时排查**: 先执行 TC-089 添加 route

---

### TC-092: route remove 移除单条 route

**能力域**: Route & Mock
**测试目标**: 验证 route remove 按 pattern 移除 route
**前置条件**: eval-ses-01 有已添加的 route（TC-089）
**执行命令**:
```
pw route remove 'http://localhost:3099/api/data' --session eval-ses-01
pw route list --session eval-ses-01
```
**预期输出包含**:
- route remove 成功
- route list 返回空或减少一条

**通过判断**: exit code 0；route list 中该 pattern 已不存在
**失败时排查**: `pw route list --session eval-ses-01` 确认 pattern 名称

---

### TC-093: route remove 清空所有 routes

**能力域**: Route & Mock
**测试目标**: 验证 route remove 不带 pattern 时清空所有 managed routes
**前置条件**: eval-ses-01 有至少一条 route
**执行命令**:
```
pw route remove --session eval-ses-01
pw route list --session eval-ses-01
```
**预期输出包含**:
- routes: [] 或 count: 0

**通过判断**: exit code 0；route list 返回空数组
**失败时排查**: 先确认有 route；`pw route list --session eval-ses-01`

---

### TC-094: 验证 mock 生效（页面内容变化）

**能力域**: Route & Mock
**测试目标**: 验证添加 mock 后页面内容变化符合预期
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw route add 'http://localhost:3099/api/data' --session eval-ses-01 --method GET --body '{"mocked":true}' --content-type application/json
pw open http://localhost:3099/api/data --session eval-ses-01
pw read-text --session eval-ses-01
```
**预期输出包含**:
- 页面文本包含 `"mocked":true`

**通过判断**: exit code 0；read-text 包含 mock 内容
**失败时排查**: `pw route list --session eval-ses-01` 确认 route 生效

---

### TC-095: route add + batch 验证联合使用

**能力域**: Route & Mock
**测试目标**: 验证 route add 可在 batch 步骤中使用
**前置条件**: eval-ses-01 存活
**执行命令**:
```
printf '[["route", "add", "http://localhost:3099/api/data", "--method", "GET", "--body", "{\"batch_mocked\":true}", "--content-type", "application/json"], ["route", "list"]]' | pw batch --session eval-ses-01 --stdin-json
```
**预期输出包含**:
- `successCount: 2`

**通过判断**: exit code 0；两步均成功
**失败时排查**: 单独运行 `pw route add ...` 确认 CLI 语法正确

---

### TC-096: route load 批量加载 route specs

**能力域**: Route & Mock
**测试目标**: 验证 route load 从 JSON 文件批量加载多条 route 规则
**前置条件**: eval-ses-01 存活，准备 routes JSON 文件
**执行命令**:
```
cat > /tmp/eval-routes.json << 'EOF'
[{"pattern":"http://localhost:3099/api/data/error","status":200,"body":"{\"recovered\":true}","contentType":"application/json"}]
EOF
pw route load /tmp/eval-routes.json --session eval-ses-01
pw route list --session eval-ses-01
```
**预期输出包含**:
- route list 中包含 `/api/data/error` pattern

**通过判断**: exit code 0；route list 包含新加载的 pattern
**失败时排查**: 确认 JSON 文件格式正确；`pw route add` 单独测试

---

## Domain 9: Auth & State (TC-097 ~ TC-105)

覆盖 cookies、storage、state diff、auth probe、profile inspect。

---

### TC-097: cookies list 列出 cookies

**能力域**: Auth & State
**测试目标**: 验证 cookies list 返回当前 session 的 cookie 列表
**前置条件**: eval-ses-b1 已登录（TC-057 后），有 session cookie
**执行命令**:
```
pw cookies list --session eval-ses-b1
```
**预期输出包含**:
- cookies 数组
- 包含 `pwcli_session` cookie

**通过判断**: exit code 0；cookies 数组中有 `pwcli_session`
**失败时排查**: `pw auth probe --session eval-ses-b1` 确认登录态

---

### TC-098: cookies set 写入 cookie

**能力域**: Auth & State
**测试目标**: 验证 cookies set 向 session 写入指定 cookie
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw cookies set --session eval-ses-01 --name eval_test_cookie --value test_value_123 --domain localhost
```
**预期输出包含**:
- cookie 设置成功

**通过判断**: exit code 0；随后 `pw cookies list --session eval-ses-01` 包含 `eval_test_cookie`
**失败时排查**: 确认 domain 参数正确（与当前页面 origin 一致）

---

### TC-099: storage local get/set 读写

**能力域**: Auth & State
**测试目标**: 验证 storage local set 写入 key 后 get 能正确读回
**前置条件**: eval-ses-01 在 http://localhost:3099（有效 origin）
**执行命令**:
```
pw open http://localhost:3099/dashboard --session eval-ses-01
pw storage local set eval_test_key eval_test_value --session eval-ses-01
pw storage local get eval_test_key --session eval-ses-01
```
**预期输出包含**:
- `value: "eval_test_value"`

**通过判断**: exit code 0；get 返回正确值
**失败时排查**: 确认 origin 有效（非 about:blank）；`pw page current --session eval-ses-01`

---

### TC-100: storage session 读取 sessionStorage

**能力域**: Auth & State
**测试目标**: 验证 storage session 返回当前页 origin 的 sessionStorage 内容
**前置条件**: eval-ses-01 在有效 origin 页面
**执行命令**:
```
pw storage session --session eval-ses-01
```
**预期输出包含**:
- `accessible: true` 或 storage 内容（可能为空 {}）
- 无错误

**通过判断**: exit code 0；accessible 字段存在
**失败时排查**: 确认当前 origin 非 about:blank；`pw page current --session eval-ses-01`

---

### TC-101: state diff 创建基线并比较

**能力域**: Auth & State
**测试目标**: 验证 state diff 首次运行创建基线，后续比较显示变化
**前置条件**: eval-ses-b1 已登录
**执行命令**:
```
pw state diff --session eval-ses-b1 --before /tmp/eval-state-before.json
# 修改一些 storage
pw storage local set diff_test_key diff_test_value --session eval-ses-b1
# 再次对比
pw state diff --session eval-ses-b1 --before /tmp/eval-state-before.json
```
**预期输出包含**:
- 第一次：`baselineCreated: true`
- 第二次：`summary.changed: true` 或 localStorage.added 含新 key

**通过判断**: 第一次 baselineCreated = true；第二次 changed = true 且 localStorage.added 有内容
**失败时排查**: 确认 origin 有效；`pw storage local --session eval-ses-b1`

---

### TC-102: state diff --include-values 含 value 级变化

**能力域**: Auth & State
**测试目标**: 验证 --include-values 在 diff 输出中包含 value 级变化（before/after 对）
**前置条件**: TC-101 已有基线文件
**执行命令**:
```
pw state diff --session eval-ses-b1 --before /tmp/eval-state-before.json --include-values
```
**预期输出包含**:
- value 级变化（before/after 字符串对）

**通过判断**: exit code 0；localStorage.changed 或 added 含 value 对
**失败时排查**: 确认基线文件存在；先运行 TC-101

---

### TC-103: auth probe 验证登录态

**能力域**: Auth & State
**测试目标**: 验证 auth probe 返回 authenticated/anonymous/uncertain 状态和信号
**前置条件**: eval-ses-b1 已登录
**执行命令**:
```
pw auth probe --session eval-ses-b1
```
**预期输出包含**:
- `status: "authenticated"`
- `confidence`
- `blockedState`
- `recommendedAction`
- `capability`

**通过判断**: exit code 0；status 为 "authenticated"；confidence 为 "high" 或 "medium"
**失败时排查**: `pw cookies list --session eval-ses-b1` 确认有 session cookie

---

### TC-104: auth probe --url 访问保护路由

**能力域**: Auth & State
**测试目标**: 验证 auth probe --url 访问保护路由后返回登录态信号
**前置条件**: eval-ses-b1 已登录
**执行命令**:
```
pw auth probe --session eval-ses-b1 --url http://localhost:3099/dashboard
```
**预期输出包含**:
- `status: "authenticated"`
- `resolvedTargetUrl` 或 probe 结果

**通过判断**: exit code 0；status = "authenticated"
**失败时排查**: `pw open http://localhost:3099/dashboard --session eval-ses-b1`；确认是否真的登录

---

### TC-105: profile inspect 检查 profile 路径

**能力域**: Auth & State
**测试目标**: 验证 profile inspect 检查指定路径的 profile 可用性
**前置条件**: 有一个可测试的路径
**执行命令**:
```
pw profile inspect /tmp/eval-profile-test
```
**预期输出包含**:
- `capability.capability: "persistent-profile-path"`
- `capability.supported`
- `capability.exists`

**通过判断**: exit code 0；capability 字段完整
**失败时排查**: 确认路径可访问；`pw doctor` 查看环境状态

---

## Domain 10: Environment & Bootstrap (TC-106 ~ TC-115)

覆盖 environment 控制、bootstrap、sse、code、resize、locate ref。

---

### TC-106: environment clock install/set/resume

**能力域**: Environment & Bootstrap
**测试目标**: 验证 clock install 安装 fake timer，clock set 设定时间，clock resume 恢复
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw environment clock install --session eval-ses-01
pw environment clock set --session eval-ses-01 2026-01-01T00:00:00Z
pw environment clock resume --session eval-ses-01
```
**预期输出包含**:
- clock install 成功
- clock set 成功（目标时间设置）
- clock resume 成功

**通过判断**: exit code 0（三步均）；无 CLOCK_REQUIRES_INSTALL 错误
**失败时排查**: 确认先 install 再 set/resume；`pw session status eval-ses-01`

---

### TC-107: environment offline 离线模式切换

**能力域**: Environment & Bootstrap
**测试目标**: 验证 environment offline on 开启离线，off 关闭离线
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw environment offline on --session eval-ses-01
pw environment offline off --session eval-ses-01
```
**预期输出包含**:
- 两次命令均成功

**通过判断**: exit code 0（两次均）
**失败时排查**: `pw session status eval-ses-01`

---

### TC-108: environment geolocation set

**能力域**: Environment & Bootstrap
**测试目标**: 验证 geolocation set 设定模拟地理位置
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw environment geolocation set --session eval-ses-01 --lat 31.2304 --lng 121.4737
```
**预期输出包含**:
- geolocation 设置成功

**通过判断**: exit code 0；无错误
**失败时排查**: `pw session status eval-ses-01`

---

### TC-109: bootstrap apply 注入 init script

**能力域**: Environment & Bootstrap
**测试目标**: 验证 bootstrap apply 向已有 session 注入 init script
**前置条件**: eval-ses-01 存活；有一个简单的 init script 文件
**执行命令**:
```
echo 'window.__eval_bootstrap = true;' > /tmp/eval-init.js
pw bootstrap apply --session eval-ses-01 --init-script /tmp/eval-init.js
```
**预期输出包含**:
- `bootstrapApplied: true`

**通过判断**: exit code 0；bootstrapApplied = true
**失败时排查**: 确认 /tmp/eval-init.js 存在；`pw doctor --session eval-ses-01`

---

### TC-110: bootstrap show 查看 bootstrap 配置

**能力域**: Environment & Bootstrap
**测试目标**: 验证 doctor 报告 bootstrap 配置状态
**前置条件**: TC-109 已 apply bootstrap
**执行命令**:
```
pw doctor --session eval-ses-01
```
**预期输出包含**:
- `initScriptCount >= 1`
- `appliedAt` 字段

**通过判断**: exit code 0；initScriptCount >= 1
**失败时排查**: 先执行 TC-109；`pw session status eval-ses-01`

---

### TC-111: sse 读取 SSE 事件记录

**能力域**: Environment & Bootstrap
**测试目标**: 验证 sse 命令读取 session 捕获的 Server-Sent Events 记录
**前置条件**: eval-ses-01 已访问 /api/stream（SSE 端点）
**执行命令**:
```
pw open http://localhost:3099/api/stream --session eval-ses-01
# 等待几秒让 SSE 事件积累
pw wait 3000 --session eval-ses-01
pw sse --session eval-ses-01
```
**预期输出包含**:
- SSE 事件记录（含 count、timestamp）

**通过判断**: exit code 0；有 SSE 事件记录（或空列表，取决于注入时机）
**失败时排查**: SSE observer 只捕获 session 建立后的连接；如无记录，重建 session 后再访问 /api/stream

---

### TC-112: code 执行自定义 Playwright 脚本

**能力域**: Environment & Bootstrap
**测试目标**: 验证 pw code 能执行自定义 Playwright 脚本并返回结果
**前置条件**: eval-ses-01 在任意页面
**执行命令**:
```
pw code 'return await page.title()' --session eval-ses-01
```
**预期输出包含**:
- 页面 title 文本

**通过判断**: exit code 0；返回 string 类型的 title
**失败时排查**: `pw page current --session eval-ses-01` 确认页面可读；如 MODAL_STATE_BLOCKED 先处理 dialog

---

### TC-113: code --file 执行本地脚本文件

**能力域**: Environment & Bootstrap
**测试目标**: 验证 pw code --file 从本地文件加载并执行 Playwright 脚本
**前置条件**: eval-ses-01 存活；脚本文件存在
**执行命令**:
```
cat > /tmp/eval-code.js << 'EOF'
const url = page.url();
const title = await page.title();
return { url, title };
EOF
pw code --file /tmp/eval-code.js --session eval-ses-01
```
**预期输出包含**:
- `url` 字段
- `title` 字段

**通过判断**: exit code 0；返回 url 和 title
**失败时排查**: 确认 /tmp/eval-code.js 语法正确；单独测试 `pw code 'return await page.url()'`

---

### TC-114: locate --return-ref 返回 aria ref

**能力域**: Environment & Bootstrap
**测试目标**: 验证 locate --return-ref 返回首个匹配元素的 aria snapshot ref
**前置条件**: eval-ses-01 在 /login
**执行命令**:
```
pw open http://localhost:3099/login --session eval-ses-01
pw locate --session eval-ses-01 --text 'Sign in' --return-ref
```
**预期输出包含**:
- `ref` 字段（如 `e5`）

**通过判断**: exit code 0；ref 字段非空
**失败时排查**: `pw locate --session eval-ses-01 --text 'Sign in'`（不加 return-ref）确认匹配

---

### TC-115: environment permissions grant 权限授予

**能力域**: Environment & Bootstrap
**测试目标**: 验证 environment permissions grant 为 session 授予指定权限
**前置条件**: eval-ses-01 存活
**执行命令**:
```
pw environment permissions grant geolocation --session eval-ses-01
```
**预期输出包含**:
- 权限授予成功

**通过判断**: exit code 0；无错误
**失败时排查**: `pw session status eval-ses-01`；确认权限名称正确

---

## Domain 11: Auth Flow E2E (TC-116 ~ TC-120)

完整端到端登录流程，覆盖 demo 账号、MFA 账号、错误密码、未登录重定向、Admin 专属内容。

---

### TC-116: 完整登录流 demo 账号

**能力域**: Auth Flow E2E
**测试目标**: 验证 demo 账号完整登录流程：填写表单 -> 提交 -> 验证登录后页面
**前置条件**: 无（新 session）
**执行命令**:
```
pw session create eval-e2e-demo --open http://localhost:3099/login
pw fill --session eval-e2e-demo --label 'Email address' 'demo@test.com'
pw fill --session eval-e2e-demo --label 'Password' 'password123'
pw click --session eval-e2e-demo --role button --name 'Sign in'
pw wait --session eval-e2e-demo --url http://localhost:3099/dashboard 2>/dev/null || pw wait --text 'Total Users' --session eval-e2e-demo
pw verify url --session eval-e2e-demo --contains '/dashboard'
```
**预期输出包含**:
- fill 和 click 均 `acted: true`
- verify url passed = true
- URL 包含 `/dashboard`

**通过判断**: exit code 0（verify url）；URL 最终在 /dashboard
**失败时排查**: `pw observe status --session eval-e2e-demo`；`pw errors recent --session eval-e2e-demo`；检查 test-app 账号配置

---

### TC-117: MFA 登录流 mfa 账号

**能力域**: Auth Flow E2E
**测试目标**: 验证 MFA 账号登录：填写凭据 -> 重定向到 MFA 页 -> 输入 MFA 码 -> 登录成功
**前置条件**: 新 session
**执行命令**:
```
pw session create eval-e2e-mfa --open http://localhost:3099/login
pw fill --session eval-e2e-mfa --label 'Email address' 'mfa@test.com'
pw fill --session eval-e2e-mfa --label 'Password' 'password123'
pw click --session eval-e2e-mfa --role button --name 'Sign in'
pw wait --session eval-e2e-mfa --selector '[data-testid="mfa-code-0"]' 2>/dev/null || pw wait --text 'verification code' --session eval-e2e-mfa
pw verify url --session eval-e2e-mfa --contains '/login/mfa'
# 输入 MFA 码 123456（逐位）
pw click --session eval-e2e-mfa --selector '[data-testid="mfa-code-0"]'
pw type --session eval-e2e-mfa '1'
pw type --session eval-e2e-mfa '2'
pw type --session eval-e2e-mfa '3'
pw type --session eval-e2e-mfa '4'
pw type --session eval-e2e-mfa '5'
pw type --session eval-e2e-mfa '6'
pw wait --text 'Total Users' --session eval-e2e-mfa
pw verify url --session eval-e2e-mfa --contains '/dashboard'
```
**预期输出包含**:
- MFA 页面出现
- 输入 MFA 码后成功跳转 /dashboard

**通过判断**: exit code 0（最终 verify url）；URL 包含 `/dashboard`
**失败时排查**: `pw observe status --session eval-e2e-mfa`；确认 MFA 码 `123456` 正确；`pw snapshot -i --session eval-e2e-mfa`

---

### TC-118: 登录失败（错误密码）

**能力域**: Auth Flow E2E
**测试目标**: 验证错误密码登录时页面显示错误提示，URL 仍在 /login
**前置条件**: 新 session 在 /login
**执行命令**:
```
pw session create eval-e2e-bad --open http://localhost:3099/login
pw fill --session eval-e2e-bad --label 'Email address' 'demo@test.com'
pw fill --session eval-e2e-bad --label 'Password' 'wrongpassword'
pw click --session eval-e2e-bad --role button --name 'Sign in'
pw wait --session eval-e2e-bad --selector '[data-testid="login-error"]'
pw verify text --session eval-e2e-bad --text 'Invalid email or password'
pw verify url --session eval-e2e-bad --contains '/login'
```
**预期输出包含**:
- login-error 元素出现
- 文本包含 "Invalid email or password"
- URL 仍在 /login

**通过判断**: exit code 0（三个 verify 均）；停留在 /login
**失败时排查**: `pw read-text --session eval-e2e-bad` 确认错误消息；`pw page current --session eval-e2e-bad`

---

### TC-119: 登录保护路由（未登录重定向）

**能力域**: Auth Flow E2E
**测试目标**: 验证未登录状态访问保护路由 /dashboard 被重定向到 /login
**前置条件**: 新 session，未登录
**执行命令**:
```
pw session create eval-e2e-unauth --open http://localhost:3099/dashboard
pw wait network-idle --session eval-e2e-unauth
pw verify url --session eval-e2e-unauth --contains '/login'
```
**预期输出包含**:
- URL 最终在 /login（被重定向）

**通过判断**: exit code 0；URL 包含 `/login`
**失败时排查**: `pw page current --session eval-e2e-unauth`；`pw observe status --session eval-e2e-unauth`

---

### TC-120: Admin 专属内容（admin 账号）

**能力域**: Auth Flow E2E
**测试目标**: 验证 admin 账号登录后能看到管理员相关内容
**前置条件**: 新 session
**执行命令**:
```
pw session create eval-e2e-admin --open http://localhost:3099/login
pw fill --session eval-e2e-admin --label 'Email address' 'admin@test.com'
pw fill --session eval-e2e-admin --label 'Password' 'admin123'
pw click --session eval-e2e-admin --role button --name 'Sign in'
pw wait --text 'Total Users' --session eval-e2e-admin
pw open http://localhost:3099/api/auth/me --session eval-e2e-admin
pw read-text --session eval-e2e-admin
```
**预期输出包含**:
- `"role":"admin"` 或 `"name":"Admin User"`

**通过判断**: exit code 0；read-text 或 page text 含 admin role 信息
**失败时排查**: `pw auth probe --session eval-e2e-admin`；`pw cookies list --session eval-e2e-admin`

---

## 总用例统计表

| Domain | 范围 | 用例数 |
|---|---|---|
| Domain 1: Session 管理 | TC-001 ~ TC-010 | 10 |
| Domain 2: 页面读取 | TC-011 ~ TC-025 | 15 |
| Domain 3: 导航与 Workspace | TC-026 ~ TC-035 | 10 |
| Domain 4: 交互操作 | TC-036 ~ TC-055 | 20 |
| Domain 5: Batch | TC-056 ~ TC-062 | 7 |
| Domain 6: Verify & Get | TC-063 ~ TC-072 | 10 |
| Domain 7: 诊断 | TC-073 ~ TC-088 | 16 |
| Domain 8: Route & Mock | TC-089 ~ TC-096 | 8 |
| Domain 9: Auth & State | TC-097 ~ TC-105 | 9 |
| Domain 10: Environment & Bootstrap | TC-106 ~ TC-115 | 10 |
| Domain 11: Auth Flow E2E | TC-116 ~ TC-120 | 5 |
| **合计** | | **120** |

---

## 快速 Smoke 集（20 个核心用例）

预计运行时间：5 分钟内（需 test-app 已启动）

这 20 个用例覆盖最高频 Agent 链路，失败意味着 CLI 核心 contract 已破坏。

| 序号 | TC | 说明 |
|---|---|---|
| S-01 | TC-001 | session create 基本创建 |
| S-02 | TC-004 | session status 存活查询 |
| S-03 | TC-006 | session list |
| S-04 | TC-011 | observe status 全字段 |
| S-05 | TC-012 | read-text 默认全页 |
| S-06 | TC-016 | snapshot -i 可交互节点 |
| S-07 | TC-023 | page current 字段验证 |
| S-08 | TC-026 | open 导航 |
| S-09 | TC-036 | click selector |
| S-10 | TC-037 | click role/name 语义定位 |
| S-11 | TC-039 | fill 多类型 input |
| S-12 | TC-056 | batch 单命令 |
| S-13 | TC-063 | verify text 通过 |
| S-14 | TC-067 | verify url 断言 |
| S-15 | TC-073 | network list |
| S-16 | TC-077 | diagnostics runs |
| S-17 | TC-089 | route add 拦截 GET |
| S-18 | TC-097 | cookies list |
| S-19 | TC-112 | pw code 执行脚本 |
| S-20 | TC-116 | 完整 demo 登录 E2E |

Smoke 集快速运行脚本片段（仅供参考，实际执行需适配 session 状态）：

```bash
pw session create eval-smoke-01 --open http://localhost:3099
pw observe status --session eval-smoke-01
pw read-text --session eval-smoke-01
pw snapshot -i --session eval-smoke-01
pw page current --session eval-smoke-01
pw open http://localhost:3099/login --session eval-smoke-01
pw click --session eval-smoke-01 --role button --name 'Sign in'
echo '[["observe","status"]]' | pw batch --session eval-smoke-01 --stdin-json
pw verify text --session eval-smoke-01 --text 'Sign in'
pw verify url --session eval-smoke-01 --contains '/login'
pw diagnostics runs --session eval-smoke-01
pw route add 'http://localhost:3099/api/data' --session eval-smoke-01 --body '{"ok":true}' --content-type application/json
pw route list --session eval-smoke-01
pw cookies list --session eval-smoke-01
pw code 'return await page.title()' --session eval-smoke-01
pw session close eval-smoke-01
```

---

## Codex 执行指引

### 前置要求

1. test-app 已在 3099 端口启动：
   ```bash
   cd /Users/xd/work/tools/pwcli/scripts/test-app && npm run dev &
   ```
2. pwcli 已构建：
   ```bash
   cd /Users/xd/work/tools/pwcli && pnpm build
   ```
3. `pw` 命令解析为：
   ```bash
   alias pw='node /Users/xd/work/tools/pwcli/dist/cli.js'
   ```

### 逐个执行方式

每个 TC 独立执行，按以下模板记录结果：

```
TC-XXX: [名称]
命令: <执行的实际命令>
Exit Code: 0 / 非0
输出摘要: <关键输出字段>
通过: PASS / FAIL
失败原因: <如失败填写>
```

### 结果记录格式（机器可读）

```json
{
  "tc": "TC-001",
  "name": "session create 基本创建",
  "domain": "Session",
  "exitCode": 0,
  "pass": true,
  "actualOutput": "...",
  "failReason": null,
  "runAt": "2026-05-03T10:00:00Z"
}
```

### Session 清理策略

每个 TC 独立运行时，优先使用独立 session 名（`eval-ses-XX`）。
所有 TC 执行完毕后统一清理：
```bash
pw session close --all
```

### 并发注意事项

- 同名 session 禁止并发 lifecycle 操作
- 不同 session 可以并发执行，但会共享诊断系统
- Smoke 集建议顺序执行，总用例建议分批并发

---

## 附录 A：常见失败模式 + 排查命令

| 失败模式 | 症状 | 排查命令 |
|---|---|---|
| session 不存在 | SESSION_NOT_FOUND | `pw session list` |
| session 忙 | SESSION_BUSY | `pw session status <name>`，等待后重试 |
| test-app 未启动 | 连接拒绝 / timeout | `curl http://localhost:3099` |
| CLI 未构建 | dist/cli.js 不存在 | `pnpm build` |
| ref 过期 | REF_STALE | `pw snapshot -i --session <name>`，重取 ref |
| modal 阻塞 | MODAL_STATE_BLOCKED | `pw dialog accept/dismiss --session <name>` |
| 选择器不存在 | ACTION_TARGET_NOT_FOUND | `pw locate --session <name> --selector '<sel>'` |
| 页面未加载完 | 超时 / 内容空 | `pw wait network-idle --session <name>` |
| 权限不足 | ENVIRONMENT_LIMITATION | `pw environment permissions grant <perm> --session <name>` |
| clock 未 install | CLOCK_REQUIRES_INSTALL | `pw environment clock install --session <name>`，再 set |
| trace CLI 不可用 | TRACE_CLI_UNAVAILABLE | `pnpm install`；确认 playwright-core 安装 |
| PDF 生成失败 | 无 path 输出 | `pw doctor --session <name>`；确认 Chromium 版本 |
| 下载无 artifact | path 为空 | 确认触发下载的元素 href 是有效文件；检查 `pw download --dir` 参数 |
| batch 步骤失败 | failureCount > 0 | `--include-results --output json` 查看每步详情 |

---

## 附录 B：Session 清理命令

```bash
# 关闭单个 session
pw session close eval-ses-01

# 关闭所有 eval 前缀的 session（需要逐一关闭）
pw session list --output json | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  d.data.sessions.filter(s=>s.name.startsWith('eval-')).forEach(s=>{
    const {execSync}=require('child_process');
    try{execSync('node /Users/xd/work/tools/pwcli/dist/cli.js session close '+s.name,{stdio:'inherit'});}catch(e){}
  });
"

# 关闭所有 managed session（谨慎，会关掉所有 session）
pw session close --all
```

---

## 附录 C：Test-app 账号速查

| 账号 | 密码 | 角色 | 特殊说明 |
|---|---|---|---|
| demo@test.com | password123 | user | 标准普通用户，无 MFA |
| admin@test.com | admin123 | admin | 管理员账号，/api/auth/me 返回 role:admin |
| mfa@test.com | password123 | user | 登录后需输入 MFA 码 `123456`（6 位） |

**Session Cookie 名**: `pwcli_session`（HttpOnly，path=/，sameSite=lax）

**Test-app URL 速查**:

| 路径 | 说明 |
|---|---|
| http://localhost:3099/ | 首页（未登录时重定向到 /login） |
| http://localhost:3099/login | 登录页面 |
| http://localhost:3099/login/mfa | MFA 验证页面 |
| http://localhost:3099/dashboard | 主仪表盘（需登录） |
| http://localhost:3099/forms | 全功能表单测试页 |
| http://localhost:3099/interactions | 交互测试页（hover、dblclick、drag、download） |
| http://localhost:3099/network | 网络请求测试页 |
| http://localhost:3099/modals | 模态框、toast、drawer 测试页 |
| http://localhost:3099/tabs | 多 tab / popup 测试页 |
| http://localhost:3099/dynamic | 动态内容（accordion、paginated table、infinite scroll） |
| http://localhost:3099/api/data | JSON 数据 API |
| http://localhost:3099/api/data/error | 固定返回 500 错误的 API |
| http://localhost:3099/api/download | 文件下载 API（?format=json 返回 JSON） |
| http://localhost:3099/api/stream | SSE 流（每秒推送一个 count 事件，共 30 个） |
| http://localhost:3099/api/auth/me | 当前用户信息（需登录） |

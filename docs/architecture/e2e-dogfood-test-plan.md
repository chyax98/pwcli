# E2E Dogfood Test Plan

更新时间：2026-04-26  
状态：active

## 1. 目标

为 `pwcli` 建一套真实、可重复、可扩展的端到端 dogfood fixture。

这套 fixture 不是 demo。它的职责只有两件事：

1. 证明 `pwcli` 在真实 Agent 场景下可稳定使用
2. 当命令、diagnostics、mock、environment、skill 漂移时，第一时间把问题打出来

## 2. 核心原则

### 2.1 场景优先

测试只围绕真实 Agent 场景设计：

1. 探索页面
2. 执行动作
3. 诊断失败
4. 复现问题
5. 收集证据
6. 恢复 blocked / dirty session

### 2.2 `pwcli` 主路优先

优先验证：

- `session create|attach|recreate`
- `snapshot/page/read-text/observe`
- `click/fill/type/press/scroll/upload/download/drag/wait`
- `diagnostics digest/export/runs/show/grep`
- `route`
- `environment`
- `bootstrap`
- `batch`
- `code`

### 2.3 一个 fixture 覆盖多类能力

不继续堆很多小页面。  
后续新增深覆盖时，优先增强这套 fixture app。

### 2.4 快慢分层

保留现有 `smoke` 做快 gate。  
新的 E2E dogfood 是深 gate。

分层：

- **smoke**
  - 快
  - 覆盖主链是否还活着
- **dogfood e2e**
  - 慢
  - 覆盖真实复杂路径、真实 bug、真实诊断和恢复

## 3. 产物

这一套测试要产出 3 类东西：

1. **fixture server + web app**
2. **详细测试计划**
3. **可执行验证脚本**

建议目录：

```text
scripts/e2e/
  dogfood-server.js
  dogfood-routes.json
  dogfood-bootstrap.js
  dogfood-scenarios/
    explore.sh
    diagnostics.sh
    mock.sh
    environment.sh
    recovery.sh
    state.sh
    batch.sh
```

## 4. fixture app 设计

## 4.1 顶层信息架构

建议用一个有深路径的内部工作台模型：

```text
/login
/app
/app/projects
/app/projects/alpha
/app/projects/alpha/incidents
/app/projects/alpha/incidents/checkout-timeout
/app/projects/alpha/incidents/checkout-timeout/reproduce
```

这样有几个好处：

- 真实 URL 层级深
- 可以测 session 导航、read-text、snapshot、wait
- 可以布置不同模块的 bug 和环境依赖

## 4.2 页面结构

### A. 登录页

目标：

- 测 `auth` / `state save|load`
- 测 cookie / storage

内容：

- email / password
- “记住我” checkbox
- 登录成功后写：
  - cookie
  - localStorage
  - sessionStorage

### B. 项目列表页

目标：

- 测探索链
- 测深路径进入

内容：

- 搜索输入
- 项目列表
- 一个可进入的 `alpha` 项目

### C. Incident 详情页

目标：

- 测复杂诊断链
- 测 route/mock
- 测 environment

内容：

- 概要卡片
- 复现步骤
- “开始复现”按钮
- “模拟故障”按钮
- “打开弹窗”按钮
- “下载日志”按钮
- 上传区域
- 拖拽排序区域

### D. Reproduce 工作区

目标：

- 这是主测试页面
- 要有故意布置的 bug、请求、告警、环境依赖

内容：

- 深层 tab / panel
- stepper
- action log
- status area
- diagnostics hint area

## 5. 必测能力矩阵

### 5.1 Session / Lifecycle

必须测：

- `session create --open`
- `session recreate`
- `session close`
- `trace` default-on

补测：

- `session attach`

理由：

- attach 需要单独起外部目标，成本高
- 不是这套 dogfood 的第一阻塞项

### 5.2 Workspace / Exploration

必须测：

- `snapshot`
- `page current`
- `page list`
- `page frames`
- `page dialogs`
- `read-text`
- `observe status`

### 5.3 Interaction

必须测：

- `click`
- `fill`
- `type`
- `press`
- `scroll`
- `upload`
- `download`
- `drag`
- `wait`

要求：

- 每个动作至少有一个真实页面路径
- 每个动作至少在一个复杂页面状态下验证

### 5.4 Diagnostics

必须测：

- `diagnostics digest --session`
- `diagnostics digest --run`
- `console`
- `network`
- `errors recent`
- `diagnostics runs`
- `diagnostics show`
- `diagnostics grep`
- `diagnostics export`

### 5.5 Mock

必须测：

- `route add`
- `route list`
- `route load`
- `route remove`
- `--abort`
- `--method`
- `--body-file`
- `--headers-file`

### 5.6 Environment

必须测：

- `offline on|off`
- `geolocation set`
- `permissions grant|clear`
- `clock install`
- `clock set`
- `clock resume`

限制确认：

- `fastForward` / `runFor` / explicit pause 继续后置

### 5.7 Identity State

必须测：

- `state save`
- `state load`
- `cookies list`
- `cookies set`
- `storage local`
- `storage session`

### 5.8 Bootstrap / Code / Batch

必须测：

- `bootstrap apply --init-script --headers-file`
- `code --file`
- `batch --stdin-json`
- `batch --file`

## 6. 故意注入的 bug

这套 fixture 必须内建几类 bug。

## 6.1 网络错误

场景：

- 一个关键请求返回 500
- 一个请求返回 401
- 一个请求超时
- 一个请求被 route abort 后前端状态错误

要验证：

- `network`
- `diagnostics digest`
- `route load`
- `wait --request/--response`

## 6.2 Console / Page Error

场景：

- console warning
- console error
- uncaught page error

要验证：

- `console`
- `errors recent`
- `diagnostics digest`

## 6.3 环境依赖错误

场景：

- geolocation 权限缺失导致面板空白
- offline 导致重试逻辑异常
- clock install 后的时间显示逻辑依赖

要验证：

- `environment`
- `diagnostics`
- recovery 逻辑

## 6.4 Modal blockage

场景：

- 某个操作弹出 `alert/confirm`
- 后续 `page current` / `observe status` 被阻断

要验证：

- `MODAL_STATE_BLOCKED`
- `doctor`
- `session recreate`

## 6.5 深路径和探索问题

场景：

- 从顶层入口走多层路径才能进入故障页
- 某个导航元素文本不明显，需要先 snapshot/read-text 再走

要验证：

- `snapshot`
- `read-text`
- `page current`
- `page frames`

## 7. 场景测试清单

## 7.1 场景 A：探索进入故障页

目标：

- 验证 Agent 能从顶层入口走到深路径故障页

步骤：

1. `session create`
2. `snapshot`
3. `page current`
4. `read-text`
5. 连续 click / wait
6. 到达 `reproduce` 页
7. `observe status`

通过标准：

- URL 正确
- 页面标题 / 关键文本正确
- 中间无错误 envelope

## 7.2 场景 B：触发真实网络故障并诊断

目标：

- 验证 diagnostics 主链

步骤：

1. 进入故障页
2. 点击“开始复现”
3. 等待请求
4. 跑：
   - `diagnostics digest --session`
   - `network`
   - `errors recent`
   - `diagnostics export`

通过标准：

- digest 能把关键失败信号排到前面
- network 能查到失败请求
- export 能稳定落盘

## 7.3 场景 C：用 route 修复/控制故障

目标：

- 验证 mock 第一层

步骤：

1. route 加载 mock file
2. 再次触发复现
3. 读取页面状态
4. route list
5. route remove

通过标准：

- mock 生效
- 页面状态从 fail -> success
- route metadata 正确

## 7.4 场景 D：环境条件复现

目标：

- 验证 environment 主链

步骤：

1. offline on
2. 触发复现
3. diagnostics digest
4. offline off
5. permissions grant geolocation
6. geolocation set
7. 刷新页面并验证 UI

通过标准：

- 环境变化确实进入页面逻辑
- diagnostics 能看出影响

## 7.5 场景 E：modal recoverability

目标：

- 验证 blocked session 恢复链

步骤：

1. 点击打开 alert
2. 跑 `page current`
3. 跑 `observe status`
4. 跑 `doctor`
5. 跑 `dialog accept` 或 `dialog dismiss`
6. 再次读取页面
7. 如果仍 blocked，再走 `session recreate`

通过标准：

- `MODAL_STATE_BLOCKED` 稳定出现
- `doctor` 能识别
- dialog 级恢复主路可用
- recreate 仍然是 fallback

## 7.6 场景 F：state 复用

目标：

- 验证 `state save|load`

步骤：

1. 登录
2. `state save`
3. 关闭 session
4. 新建 session
5. `state load`
6. 进入深路径页

通过标准：

- 不需要重新登录
- cookie/storage 状态正确

## 7.7 场景 G：batch 编排

目标：

- 验证稳定 batch 子集在真实场景里可用

步骤：

1. 准备一份 file-based batch
2. 覆盖：
   - `snapshot`
   - `click`
   - `wait`
   - `observe status`
   - `route list`
3. 检查整包返回

通过标准：

- 每一步返回稳定 envelope
- 结果能被 Agent 直接消费

## 8. fixture app 细节建议

## 8.1 一个故障页里要同时具备

- 深路径入口
- 关键请求
- 可 mock 请求
- console warning/error
- page error
- modal 按钮
- upload / download / drag
- environment 依赖面板

理由：

- 避免场景碎片化
- Agent 能在一页里做连续探索和诊断

## 8.2 数据设计

建议 server 内建这些 endpoint：

- `/api/reproduce/start`
- `/api/reproduce/status`
- `/api/reproduce/fixable`
- `/api/reproduce/geo-only`
- `/api/reproduce/offline-only`
- `/api/reproduce/download`

每条接口明确：

- 默认成功
- 可切换失败
- 可 mock 接管

## 8.3 前端状态设计

页面至少显示：

- 当前 step
- 最近请求状态
- 最近错误摘要
- 当前环境状态
- route/mock 命中提示

这样 `read-text` 和 `snapshot` 才真有东西可读。

## 9. 执行策略

## 9.1 第一阶段

先落最小 dogfood app：

- 深路径导航
- 一个核心故障页
- diagnostics
- mock
- modal
- environment 面板

## 9.2 第二阶段

补：

- 登录页
- state/cookie/storage
- upload/download/drag 更复杂交互

## 9.3 第三阶段

补：

- batch file fixtures
- attach workflow target
- 更复杂的多故障场景

## 10. 验收标准

这套 E2E dogfood 完成后，至少要满足：

1. Agent 能独立从入口走到深层故障页
2. Agent 能只靠 `pw` 命令复现、定位、mock、恢复
3. diagnostics 摘要链足够高信号
4. smoke 和 dogfood 分层清楚
5. skill 里的工作流能直接映射到 dogfood 场景

## 11. 明确不做

这套测试 fixture 当前不追：

- raw CDP substrate
- observe stream
- HAR 热录制
- workspace 写操作

原因：

- 这些不属于当前最短测试闭环
- 先把主链、诊断、mock、environment 的真实 E2E 验证打透

## 12. 下一步实现顺序

1. 落 `scripts/e2e/dogfood-server.js`
2. 落故障页和深路径页面
3. 写第一批 dogfood scenario scripts
4. 把它们收成一个 `pnpm test:dogfood:e2e`
5. 同步 skill 的 workflows

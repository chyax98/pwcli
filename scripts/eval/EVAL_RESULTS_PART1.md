# pwcli 评测结果 Part1（TC-001~060）
执行时间: 2026-05-03T17:56:48.986698

## Domain 统计
| Domain | 总数 | Pass | Fail | Skip |
|--------|------|------|------|------|
| Domain 1 | 10 | 8 | 2 | 0 |
| Domain 2 | 15 | 15 | 0 | 0 |
| Domain 3 | 10 | 10 | 0 | 0 |
| Domain 4 | 20 | 19 | 1 | 0 |
| Domain 5 | 5 | 5 | 0 | 0 |
| Domain 6 | 10 | 10 | 0 | 0 |
| **总计** | **70** | **67** | **3** | **0** |

## 详细结果
### TC-001: session create 基本创建
- 状态: ✅ PASS
- 实际输出: page /login?from=%2Fdashboard (pwcli Test App) \| navigated=true created=true sessionName=eval-p1-1 defaults={"headed":false,"trace":true,"diagnosticsRecords":true,"runArtifacts":true} appliedDefaults=

### TC-002: session create --headed
- 状态: ✅ PASS
- 实际输出: page /login?from=%2Fdashboard (pwcli Test App) \| navigated=true created=true sessionName=eval-p1-2 defaults={"headed":false,"trace":true,"diagnosticsRecords":true,"runArtifacts":true} appliedDefaults=

### TC-003: session create --open URL
- 状态: ✅ PASS
- 实际输出: page /login (pwcli Test App) \| navigated=true created=true sessionName=eval-p1-3 defaults={"headed":false,"trace":true,"diagnosticsRecords":true,"runArtifacts":true} appliedDefaults={"trace":{"request

### TC-004: session status 查询存活
- 状态: ✅ PASS
- 实际输出: active=true socketPath=/var/folders/ss/cgdpql9124x9v6s72r9n1plc0000gn/T/pw-77823916/cli/e0b2d7d42bc9556d-eval-p1-1.sock version=1.59.1 workspaceDir=/Users/xd/work/tools/pwcli

### TC-005: session status 查询不存在
- 状态: ✅ PASS
- 实际输出: ERROR SESSION_NOT_FOUND \| Session 'eval-p1-ghost' not found. \| Try:

### TC-006: session list
- 状态: ✅ PASS
- 实际输出: bench-t04 alive=true \| bench-t06 alive=true \| bench-t08 alive=true

### TC-007: session list --with-page
- 状态: ✅ PASS
- 实际输出: bench-t04 alive=true /tabs (pwcli Test App) \| bench-t06 alive=true /route-mock (pwcli Test App) \| bench-t08 alive=true /tabs (pwcli Test App)

### TC-008: session recreate
- 状态: ❌ FAIL
- 实际输出: TIMEOUT
- 失败原因: exit=-1

### TC-009: session list --attachable
- 状态: ✅ PASS
- 实际输出: bench-t02 alive=true \| bench-t04 alive=true \| bench-t06 alive=true

### TC-010: session close
- 状态: ❌ FAIL
- 实际输出: TIMEOUT
- 失败原因: exit=-1

### TC-011: observe status
- 状态: ✅ PASS
- 实际输出: page /dashboard (pwcli Test App) \| { \|   "summary": {

### TC-012: read-text 默认全页
- 状态: ✅ PASS
- 实际输出: pwcli Test App Dashboard Forms Interactions Modals Dynamic Multi-Tab Network Logout pwcli-test-app v0.1.0 Demo User user Welcome back , Demo User ! Here's an overview of the pwcli test environment. us

### TC-013: read-text --max-chars
- 状态: ✅ PASS
- 实际输出: pwcli Test App Dashboard Forms Interactions Modals Dynamic Multi-Tab Network Logout pwcli-test-app v0.1.0 Demo User user Welcome back , Demo User ! Here's an overview of the pwcli test environment. us

### TC-014: read-text --selector
- 状态: ✅ PASS
- 实际输出: Total Users12,842 \| [truncated: false, chars: 17/17]

### TC-015: snapshot 完整结构树
- 状态: ✅ PASS
- 实际输出: - generic [active] [ref=e1]: \|   - generic [ref=e2]: \|     - complementary "Main navigation" [ref=e3]:

### TC-016: snapshot -i 交互节点
- 状态: ✅ PASS
- 实际输出: - generic [active] [ref=e1]: \|   - generic [ref=e3]: \|     - generic [ref=e4]:

### TC-017: snapshot -c 紧凑模式
- 状态: ✅ PASS
- 实际输出: [compact snapshot — 41 lines, max depth 12] \| - generic [active] [ref=e1]: \|   - generic [ref=e3]:

### TC-018: accessibility 基本
- 状态: ✅ PASS
- 实际输出: - complementary "Main navigation": \|   - img \|   - text: pwcli Test App

### TC-019: accessibility -i 仅交互
- 状态: ✅ PASS
- 实际输出: - textbox "Email address": \|     - /placeholder: demo@test.com \|   - textbox "Password":

### TC-020: screenshot 基本
- 状态: ✅ PASS
- 实际输出: Screenshot: /Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-50-52-754Z-eval-p1-1/screenshot-1777801852755.png

### TC-021: screenshot --full-page
- 状态: ✅ PASS
- 实际输出: Screenshot: /Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-50-53-876Z-eval-p1-1/screenshot-1777801853877.png

### TC-022: pdf 生成
- 状态: ✅ PASS
- 实际输出: pdf saved=true \| run id=2026-05-03T09-50-56-150Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-50-56-150Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-023: page current
- 状态: ✅ PASS
- 实际输出: * pageId=p1 index=0 navigationId=nav-12 current=true /dashboard (pwcli Test App)

### TC-024: page frames
- 状态: ✅ PASS
- 实际输出: { \|   "activePageId": "p1", \|   "currentNavigationId": "nav-12",

### TC-025: page assess
- 状态: ✅ PASS
- 实际输出: { \|   "page": { \|     "index": 0,

### TC-026: open 导航
- 状态: ✅ PASS
- 实际输出: open navigated=true \| page /login (pwcli Test App) \| delta console=0 network=0 pageError=0

### TC-027: tab list 多 tab
- 状态: ✅ PASS
- 实际输出: * pageId=p1 index=0 navigationId=nav-16 current=true /tabs (pwcli Test App) \| - pageId=p2 index=1 navigationId=nav-18 current=false /tabs/child (pwcli Test App)

### TC-028: tab select
- 状态: ✅ PASS
- 实际输出: - pageId=p1 index=0 navigationId=nav-16 current=false /tabs (pwcli Test App) \| * pageId=p2 index=1 navigationId=nav-18 current=true /tabs/child (pwcli Test App)

### TC-029: tab close
- 状态: ✅ PASS
- 实际输出: pages=1

### TC-030: wait network-idle
- 状态: ✅ PASS
- 实际输出: wait matched=true \| page /dashboard (pwcli Test App) \| run id=2026-05-03T09-51-38-447Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-51-38-447Z-eval-p1-1

### TC-031: wait --selector
- 状态: ✅ PASS
- 实际输出: wait matched=true \| page /dashboard (pwcli Test App) \| run id=2026-05-03T09-51-47-699Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-51-47-699Z-eval-p1-1

### TC-032: wait --text
- 状态: ✅ PASS
- 实际输出: wait matched=true \| page /dashboard (pwcli Test App) \| run id=2026-05-03T09-51-56-927Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-51-56-927Z-eval-p1-1

### TC-033: wait --networkidle
- 状态: ✅ PASS
- 实际输出: wait matched=true \| page /network (pwcli Test App) \| run id=2026-05-03T09-52-07-283Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-52-07-283Z-eval-p1-1

### TC-034: page dialogs
- 状态: ✅ PASS
- 实际输出: { \|   "activePageId": "p1", \|   "currentNavigationId": "nav-22",

### TC-035: resize viewport
- 状态: ✅ PASS
- 实际输出: { \|   "width": 1280, \|   "height": 800,

### TC-036: click selector
- 状态: ✅ PASS
- 实际输出: click acted=true \| page /login (pwcli Test App) \| run id=2026-05-03T09-52-23-346Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-52-23-346Z-eval-p1-1

### TC-037: click role/name
- 状态: ✅ PASS
- 实际输出: click acted=true \| page /login (pwcli Test App) \| run id=2026-05-03T09-52-36-058Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-52-36-058Z-eval-p1-1

### TC-038: click ref
- 状态: ✅ PASS
- 实际输出: click acted=true \| page /login (pwcli Test App) \| run id=2026-05-03T09-52-54-596Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-52-54-596Z-eval-p1-1

### TC-039: fill 填充
- 状态: ✅ PASS
- 实际输出: email=fill filled=true \| run id=2026-05-03T09-53-02-958Z-eval-p1-1 dir=/Users/xd/work/to pw=fill filled=true \| run id=2026-05-03T09-53-10-178Z-eval-p1-1 dir=/Users/xd/work/to

### TC-040: type 逐字符输入
- 状态: ✅ PASS
- 实际输出: type typed=true \| run id=2026-05-03T09-53-18-604Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-53-18-604Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-041: press Enter
- 状态: ✅ PASS
- 实际输出: press pressed=true \| page /login (pwcli Test App) \| run id=2026-05-03T09-53-26-934Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-53-26-934Z-eval-p1-1

### TC-042: hover tooltip
- 状态: ✅ PASS
- 实际输出: hover acted + tooltip visible

### TC-043: select 下拉
- 状态: ✅ PASS
- 实际输出: select selected=true \| run id=2026-05-03T09-53-47-882Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-53-47-882Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-044: check checkbox
- 状态: ✅ PASS
- 实际输出: check acted=true checked=true \| run id=2026-05-03T09-53-56-195Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-53-56-195Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-045: uncheck checkbox
- 状态: ✅ PASS
- 实际输出: uncheck acted=true checked=false \| run id=2026-05-03T09-54-03-418Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-54-03-418Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-046: drag 拖拽
- 状态: ✅ PASS
- 实际输出: drag ok \| run id=2026-05-03T09-54-11-793Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-54-11-793Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-047: upload 文件上传
- 状态: ✅ PASS
- 实际输出: upload uploaded=true \| run id=2026-05-03T09-54-20-153Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-54-20-153Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-048: download 下载
- 状态: ✅ PASS
- 实际输出: download downloaded=true \| run id=2026-05-03T09-54-21-398Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-54-21-398Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-049: scroll down
- 状态: ✅ PASS
- 实际输出: scroll ok \| run id=2026-05-03T09-54-37-005Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-54-37-005Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-050: scroll up
- 状态: ✅ PASS
- 实际输出: scroll ok \| run id=2026-05-03T09-54-44-231Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-54-44-231Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-051: mouse move
- 状态: ✅ PASS
- 实际输出: mouse move acted=true \| run id=2026-05-03T09-54-51-457Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-54-51-457Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-052: mouse click
- 状态: ✅ PASS
- 实际输出: mouse click acted=true \| run id=2026-05-03T09-54-59-862Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-54-59-862Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-053: mouse wheel
- 状态: ✅ PASS
- 实际输出: mouse wheel acted=true \| run id=2026-05-03T09-55-07-094Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-55-07-094Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-054: click popup 新页面
- 状态: ❌ FAIL
- 实际输出: ERROR CLICK_FAILED \| ReferenceError: DIAGNOSTICS_STATE_KEY is not defined \| Try:
- 失败原因: exit=1

### TC-055: mouse dblclick
- 状态: ✅ PASS
- 实际输出: mouse dblclick acted=true \| run id=2026-05-03T09-55-24-046Z-eval-p1-1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-55-24-046Z-eval-p1-1 \| delta console=0 network=0 pageError=0

### TC-056: batch 单命令
- 状态: ✅ PASS
- 实际输出: batch completed=true steps=1 success=1 failed=0 continueOnError=false

### TC-057: batch 登录流程
- 状态: ✅ PASS
- 实际输出: batch completed=true steps=3 success=3 failed=0 continueOnError=false

### TC-058: batch 表单填写
- 状态: ✅ PASS
- 实际输出: batch completed=true steps=3 success=3 failed=0 continueOnError=false

### TC-059: batch SESSION_NOT_FOUND
- 状态: ✅ PASS
- 实际输出: ERROR BATCH_STEP_FAILED \| SESSION_NOT_FOUND:eval-p1-ghost \| Details:

### TC-060: batch continue-on-error
- 状态: ✅ PASS
- 实际输出: batch completed=true steps=2 success=1 failed=1 continueOnError=true \| first failure step=1 command=click reason=- \| Error: CLICK_SELECTOR_NOT_FOUND:{"target":{"selector":"#nonexistent-element-xyz","n

### TC-063: verify text
- 状态: ✅ PASS
- 实际输出: verify text passed=true text="Total Users" count=1 actual={ \|   "count": 1, \|   "nth": 1,

### TC-064: verify text-absent
- 状态: ✅ PASS
- 实际输出: verify text-absent passed=true text="THIS_VERY_UNIQUE_STRING_SHOULDNOTEXIST" count=0 actual={ \|   "count": 0, \|   "nth": 1,

### TC-065: verify visible
- 状态: ✅ PASS
- 实际输出: verify visible passed=true selector=[data-testid="stat-users"] count=1 actual=true expected=visible

### TC-066: verify disabled
- 状态: ✅ PASS
- 实际输出: verify disabled passed=true selector=[data-testid="btn-disabled"] count=1 actual=false expected=disabled

### TC-067: verify url
- 状态: ✅ PASS
- 实际输出: verify url passed=true actual=http://localhost:3099/dashboard expected={ \|   "contains": "/dashboard" \| }

### TC-068: verify count
- 状态: ✅ PASS
- 实际输出: verify count passed=true selector=[data-testid^="stat-"] count=4 actual=4 expected={ \|   "equals": 4 \| }

### TC-069: get text
- 状态: ✅ PASS
- 实际输出: get text=12,842 count=1 selector=[data-testid="stat-users"] .text-2xl

### TC-070: locate 语义定位
- 状态: ✅ PASS
- 实际输出: locate count=1 text="Total Users" \| 1. span visible=true name="Total Users" region="section name=\"Statistics\" selector=\"section[aria-label=\\\"Statistics\\\"]\"" ancestor="div name=\"Total Users\" 

### TC-071: is visible
- 状态: ✅ PASS
- 实际输出: is visible=true count=1 selector=[data-testid="login-submit"]

### TC-072: verify VERIFY_FAILED
- 状态: ✅ PASS
- 实际输出: ERROR VERIFY_FAILED \| verify text failed \| Try:

## 失败用例列表
- TC-008: session recreate — exit=-1
- TC-010: session close — exit=-1
- TC-054: click popup 新页面 — exit=1

## Part1 通过率
67/70 (95.7%)

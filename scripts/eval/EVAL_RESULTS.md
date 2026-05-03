# pwcli 评测结果
执行时间: 2026-05-03T09:39:44.540287+00:00
pwcli 版本: 0.2.0
靶场: http://localhost:3099

## 总览
| Domain | 总数 | PASS | FAIL | WARN | SKIP |
|--------|------|------|------|------|------|
| D1 Session | 10 | 1 | 0 | 9 | 0 |
| D2 Page Reading | 15 | 11 | 2 | 2 | 0 |
| D3 Navigation | 10 | 5 | 0 | 5 | 0 |
| D4 Interaction | 20 | 7 | 4 | 9 | 0 |
| D5 Batch | 7 | 3 | 2 | 2 | 0 |
| D6 Verify & Get | 10 | 3 | 0 | 7 | 0 |
| D7 Diagnostics | 16 | 11 | 0 | 4 | 1 |
| D8 Route & Mock | 8 | 7 | 1 | 0 | 0 |
| D9 Auth & State | 9 | 7 | 0 | 2 | 0 |
| D10 Environment | 10 | 7 | 2 | 1 | 0 |
| D11 E2E | 5 | 1 | 2 | 2 | 0 |
| **合计** | 120 | 63 | 13 | 43 | 1 |


## Domain 1: Session 管理

### TC-001 ⚠️ WARN
**执行**: `session create eval-d1`
**输出摘要**: page /login?from=%2Fdashboard (pwcli Test App) navigated=true created=true sessionName=eval-d1 defaults={"headed":false,"trace":true,"diagnosticsRecords":true,"runArtifacts":true} appliedDefaults={"trace":{"requested":true,"applied":true,"data":{"action":"start","started":true,"trace":{"active":true
**判断**: exit 0 + 缺少字段 ['created: true']

### TC-002 ⚠️ WARN
**执行**: `session create eval-ses-02 --headed`
**输出摘要**: page /login?from=%2Fdashboard (pwcli Test App) navigated=true created=true sessionName=eval-ses-02 defaults={"headed":false,"trace":true,"diagnosticsRecords":true,"runArtifacts":true} appliedDefaults={"trace":{"requested":true,"applied":true,"data":{"action":"start","started":true,"trace":{"active":
**判断**: exit 0 + 缺少字段 ['headed: true']

### TC-003 ✅ PASS
**执行**: `session create eval-ses-03 --open /login`
**输出摘要**: page /login (pwcli Test App) navigated=true created=true sessionName=eval-ses-03 defaults={"headed":false,"trace":true,"diagnosticsRecords":true,"runArtifacts":true} appliedDefaults={"trace":{"requested":true,"applied":true,"data":{"action":"start","started":true,"trace":{"active":true,"supported":t
**判断**: exit 0 + page URL 含 /login

### TC-004 ⚠️ WARN
**执行**: `session status eval-d1`
**输出摘要**: active=true socketPath=/var/folders/ss/cgdpql9124x9v6s72r9n1plc0000gn/T/pw-77823916/cli/e0b2d7d42bc9556d-eval-d1.sock version=1.59.1 workspaceDir=/Users/xd/work/tools/pwcli 
**判断**: exit 0 + 缺少字段 ['active: true']

### TC-005 ⚠️ WARN
**执行**: `session status eval-ses-nonexistent`
**输出摘要**: ERROR SESSION_NAME_TOO_LONG Session 'eval-ses-nonexistent' is too long. Maximum length is 16 characters. Try: - Use a short session name like dc-main, auth-a, q1, or bug-a - Keep the session name at or below 16 characters Details: {   "session": "eval-ses-nonexistent",   "maxLength": 16 } 
**判断**: exit 1 + exit 非0 但缺少 ['SESSION_NOT_FOUND', 'NOT_FOUND']

### TC-006 ⚠️ WARN
**执行**: `session list`
**输出摘要**: eval-d1 alive=true eval-ses-02 alive=true eval-ses-03 alive=true 
**判断**: exit 0 + 缺少字段 ['count']

### TC-007 ⚠️ WARN
**执行**: `session list --with-page`
**输出摘要**: eval-d1 alive=true /login?from=%2Fdashboard (pwcli Test App) eval-ses-02 alive=true /login?from=%2Fdashboard (pwcli Test App) eval-ses-03 alive=true /login (pwcli Test App) 
**判断**: exit 0 + 缺少字段 ['withPage: true']

### TC-008 ⚠️ WARN
**执行**: `session recreate eval-d1 --open /login`
**输出摘要**: page /login (pwcli Test App) recreated=true headed=false defaults={"headed":false,"trace":true,"diagnosticsRecords":true,"runArtifacts":true} appliedDefaults={"trace":{"requested":true,"applied":true,"data":{"action":"start","started":true,"trace":{"active":true,"supported":true,"lastAction":"start"
**判断**: exit 0 + 缺少字段 ['recreated: true']

### TC-009 ⚠️ WARN
**执行**: `session list --attachable`
**输出摘要**: eval-d1 alive=true eval-p1-1 alive=true eval-p1-2 alive=true 
**判断**: exit 0 + 缺少字段 ['capability']

### TC-010 ⚠️ WARN
**执行**: `session close eval-ses-02`
**输出摘要**: name=eval-ses-02 closed=false 
**判断**: exit 0 + 缺少字段 ['closed: true', 'name: eval-ses-02']



## Domain 2: 页面读取

### TC-011 ✅ PASS
**执行**: `observe status`
**输出摘要**: page /dashboard (pwcli Test App) {   "summary": {     "pageCount": 1,     "currentPageId": "p1",     "currentNavigationId": "nav-8",     "dialogCount": 0,     "routeCount": 0,     "consoleTotal": 1,     "networkTotal": 117,     "requestCount": 58,     "responseCount": 58,     "failedRequestCount": 0
**判断**: exit 0 + summary 字段存在

### TC-012 ✅ PASS
**执行**: `read-text`
**输出摘要**: pwcli Test App Dashboard Forms Interactions Modals Dynamic Multi-Tab Network Logout pwcli-test-app v0.1.0 Demo User user Welcome back , Demo User ! Here's an overview of the pwcli test environment. user Total Users 12,842 Active Sessions 384 Orders Today 1,204 Revenue $ 98,432 Notifications 2 Quick 
**判断**: exit 0 + 文本非空含 dashboard 内容

### TC-013 ⚠️ WARN
**执行**: `read-text --max-chars 500`
**输出摘要**: pwcli Test App Dashboard Forms Interactions Modals Dynamic Multi-Tab Network Logout pwcli-test-app v0.1.0 Demo User user Welcome back , Demo User ! Here's an overview of the pwcli test environment. user Total Users 12,842 Active Sessions 384 Orders Today 1,204 Revenue $ 98,432 Notifications 2 Quick 
**判断**: exit 0 + 缺少字段 ['text']

### TC-014 ✅ PASS
**执行**: `read-text --selector stat-users`
**输出摘要**: Total Users12,842 [truncated: false, chars: 17/17] 
**判断**: exit 0 + selector 局部文本

### TC-015 ✅ PASS
**执行**: `snapshot`
**输出摘要**: - generic [active] [ref=e1]:   - generic [ref=e2]:     - complementary "Main navigation" [ref=e3]:       - generic [ref=e4]:         - img [ref=e6]         - generic [ref=e8]:           - generic [ref=e9]: pwcli           - generic [ref=e10]: Test App       - navigation "Sidebar navigation" [ref=e11
**判断**: exit 0 + ARIA 树结构

### TC-016 ✅ PASS
**执行**: `snapshot -i`
**输出摘要**: - generic [active] [ref=e1]:   - generic [ref=e3]:     - generic [ref=e4]:       - img [ref=e6]       - generic [ref=e8]:         - generic [ref=e9]: pwcli Test App         - generic [ref=e10]: Browser Automation Target     - generic [ref=e11]:       - heading "Sign in" [level=1] [ref=e12]       - p
**判断**: exit 0 + 交互元素+ref

### TC-017 ✅ PASS
**执行**: `snapshot -c`
**输出摘要**: [compact snapshot — 41 lines, max depth 12] - generic [active] [ref=e1]:   - generic [ref=e3]:     - generic [ref=e4]:       - img [ref=e6]       - generic [ref=e8]:         - generic [ref=e9]: pwcli Test App         - generic [ref=e10]: Browser Automation Target     - generic [ref=e11]:       - hea
**判断**: exit 0 + 紧凑模式

### TC-018 ⚠️ WARN
**执行**: `accessibility`
**输出摘要**: - complementary "Main navigation":   - img   - text: pwcli Test App   - navigation "Sidebar navigation":     - list:       - listitem:         - link "Dashboard":           - /url: /dashboard           - img           - text: Dashboard       - listitem:         - link "Forms":           - /url: /for
**判断**: exit 0 + 缺少字段 ['role']

### TC-019 ✅ PASS
**执行**: `accessibility -i`
**输出摘要**:   - textbox "Email address":     - /placeholder: demo@test.com   - textbox "Password":     - /placeholder: ••••••••   - button "Show password":     - img   - checkbox "Remember me"   - button "Sign in" 
**判断**: exit 0 + 仅交互节点

### TC-020 ❌ FAIL
**执行**: `screenshot`
**输出摘要**: Screenshot: /Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-25-43-412Z-eval-d1/screenshot-1777800343413.png 
**判断**: exit 0 或缺少 path

### TC-021 ❌ FAIL
**执行**: `screenshot --full-page`
**输出摘要**: Screenshot: /Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-25-44-533Z-eval-d1/screenshot-1777800344534.png 
**判断**: exit 0 或缺少 path

### TC-022 ✅ PASS
**执行**: `pdf`
**输出摘要**: pdf saved=true run id=2026-05-03T09-25-46-768Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-25-46-768Z-eval-d1 delta console=0 network=0 pageError=0 
**判断**: exit 0 + PDF 文件存在

### TC-023 ✅ PASS
**执行**: `page current`
**输出摘要**: * pageId=p1 index=0 navigationId=nav-16 current=true /dashboard (pwcli Test App) 
**判断**: exit 0 + pageId/url/title/navigationId

### TC-024 ✅ PASS
**执行**: `page frames`
**输出摘要**: {   "activePageId": "p1",   "currentNavigationId": "nav-16",   "pageId": "p1",   "navigationId": "nav-16",   "frameCount": 1,   "frames": [     {       "index": 0,       "pageId": "p1",       "navigationId": "nav-16",       "url": "http://localhost:3099/dashboard",       "name": "",       "main": tr
**判断**: exit 0 + frames 数组存在

### TC-025 ✅ PASS
**执行**: `page assess`
**输出摘要**: {   "page": {     "index": 0,     "pageId": "p1",     "navigationId": "nav-16",     "url": "http://localhost:3099/dashboard",     "title": "pwcli Test App",     "current": true,     "openerPageId": null   },   "summary": {     "pageKind": "document",     "visibleTextDensity": "high",     "hasDialog"
**判断**: exit 0 + summary+nextSteps



## Domain 3: 导航与 Workspace

### TC-026 ✅ PASS
**执行**: `open /login`
**输出摘要**: open navigated=true page /login (pwcli Test App) delta console=0 network=0 pageError=0 
**判断**: exit 0 + URL 含 /login

### TC-027 ⚠️ WARN
**执行**: `page list (multi tab)`
**输出摘要**: * pageId=p1 index=0 navigationId=nav-20 current=true /tabs (pwcli Test App) - pageId=p2 index=1 navigationId=nav-22 current=false /tabs/child (pwcli Test App) 
**判断**: exit 0 + 缺少字段 ['pages']

### TC-028 ✅ PASS
**执行**: `tab select`
**输出摘要**: - pageId=p1 index=0 navigationId=nav-20 current=false /tabs (pwcli Test App) * pageId=p2 index=1 navigationId=nav-22 current=true /tabs/child (pwcli Test App) 
**判断**: exit 0 + 切换后 URL 含 /tabs/child

### TC-029 ✅ PASS
**执行**: `tab close`
**输出摘要**: before=2 after=1
**判断**: exit 0 + pages 减少

### TC-030 ⚠️ WARN
**执行**: `wait --networkidle`
**输出摘要**: wait matched=true page /dashboard (pwcli Test App) run id=2026-05-03T09-26-35-449Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-26-35-449Z-eval-d1 delta console=0 network=0 pageError=0 last console error: Failed to load resource: the server responded with a status of 404 (Not Fou
**判断**: exit 0 + 缺少字段 ['waited', 'networkIdle']

### TC-031 ⚠️ WARN
**执行**: `wait --selector`
**输出摘要**: wait matched=true page /dashboard (pwcli Test App) run id=2026-05-03T09-26-45-869Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-26-45-869Z-eval-d1 delta console=0 network=0 pageError=0 last console error: Failed to load resource: the server responded with a status of 404 (Not Fou
**判断**: exit 0 + 缺少字段 ['waited', 'selector']

### TC-032 ⚠️ WARN
**执行**: `wait --text`
**输出摘要**: wait matched=true page /dashboard (pwcli Test App) run id=2026-05-03T09-26-55-106Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-26-55-106Z-eval-d1 delta console=0 network=0 pageError=0 last console error: Failed to load resource: the server responded with a status of 404 (Not Fou
**判断**: exit 0 + 缺少字段 ['waited', 'text']

### TC-033 ⚠️ WARN
**执行**: `wait --networkidle (network page)`
**输出摘要**: wait matched=true page /network (pwcli Test App) run id=2026-05-03T09-27-05-516Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-27-05-516Z-eval-d1 delta console=0 network=0 pageError=0 last console error: Failed to load resource: the server responded with a status of 404 (Not Found
**判断**: exit 0 + 缺少字段 ['waited', 'networkIdle']

### TC-034 ✅ PASS
**执行**: `page dialogs`
**输出摘要**: {   "activePageId": "p1",   "currentNavigationId": "nav-28",   "pageId": "p1",   "navigationId": "nav-28",   "dialogCount": 0,   "dialogs": [],   "limitation": "Observed dialog events only; Playwright Core does not expose an authoritative live dialog set on the current managed-session substrate.",  
**判断**: exit 0 + dialogs 字段存在

### TC-035 ✅ PASS
**执行**: `resize`
**输出摘要**: {   "width": 1280,   "height": 800,   "view": "1280x800",   "resized": true } 
**判断**: exit 0 + resize 成功含尺寸



## Domain 4: 交互操作

### TC-036 ⚠️ WARN
**执行**: `click selector`
**输出摘要**: click acted=true page /login (pwcli Test App) run id=2026-05-03T09-27-22-644Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-27-22-644Z-eval-d1 delta console=1 network=0 pageError=0 last console error: Failed to load resource: the server responded with a status of 400 (Bad Request)
**判断**: exit 0 + 缺少字段 ['acted: true']

### TC-037 ⚠️ WARN
**执行**: `click role/name`
**输出摘要**: click acted=true page /login (pwcli Test App) run id=2026-05-03T09-27-37-546Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-27-37-546Z-eval-d1 delta console=1 network=0 pageError=0 last console error: Failed to load resource: the server responded with a status of 400 (Bad Request)
**判断**: exit 0 + 缺少字段 ['acted: true']

### TC-038 ❌ FAIL
**执行**: `click ref`
**输出摘要**: {   "ok": true,   "command": "snapshot",   "session": {     "scope": "managed",     "name": "eval-d1",     "default": false   },   "page": {     "url": "http://localhost:3099/login",     "title": "pwcli Test App"   },   "data": {     "mode": "interactive",     "snapshot": "- generic [active] [ref=e1
**判断**: 无法获取 Sign in ref

### TC-039 ❌ FAIL
**执行**: `fill email+password`
**输出摘要**: fill filled=true run id=2026-05-03T09-27-50-193Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-27-50-193Z-eval-d1 delta console=0 network=0 pageError=0 last console error: Failed to load resource: the server responded with a status of 400 (Bad Request) last network GET /_next/stat
**判断**: exit 0/0 或缺少 acted=true

### TC-040 ⚠️ WARN
**执行**: `type`
**输出摘要**: type typed=true run id=2026-05-03T09-28-06-785Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-28-06-785Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More info: https:
**判断**: exit 0 + 缺少字段 ['acted: true']

### TC-041 ⚠️ WARN
**执行**: `press Enter`
**输出摘要**: press pressed=true page /dashboard (pwcli Test App) run id=2026-05-03T09-28-30-533Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-28-30-533Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "cu
**判断**: exit 0 + 缺少字段 ['acted: true']

### TC-042 ✅ PASS
**执行**: `hover + read-text`
**输出摘要**: hover acted=true run id=2026-05-03T09-28-43-001Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-28-43-001Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More info: https
**判断**: exit 0 + hover+tooltip 可见

### TC-043 ⚠️ WARN
**执行**: `select`
**输出摘要**: select selected=true run id=2026-05-03T09-28-53-549Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-28-53-549Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More info: h
**判断**: exit 0 + 缺少字段 ['value', 'acted']

### TC-044 ⚠️ WARN
**执行**: `check`
**输出摘要**: check acted=true checked=true run id=2026-05-03T09-29-02-946Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-29-02-946Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (Mor
**判断**: exit 0 + 缺少字段 ['acted: true']

### TC-045 ⚠️ WARN
**执行**: `uncheck`
**输出摘要**: uncheck acted=true checked=false run id=2026-05-03T09-29-10-192Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-29-10-192Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (
**判断**: exit 0 + 缺少字段 ['acted: true']

### TC-046 ⚠️ WARN
**执行**: `drag`
**输出摘要**: drag ok run id=2026-05-03T09-29-19-675Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-29-19-675Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More info: https://goo.gl
**判断**: exit 0 + 缺少字段 ['acted: true']

### TC-047 ⚠️ WARN
**执行**: `upload`
**输出摘要**: upload uploaded=true run id=2026-05-03T09-29-29-137Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-29-29-137Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More info: h
**判断**: exit 0 + exit 0 或缺少文件名

### TC-048 ❌ FAIL
**执行**: `download`
**输出摘要**: download downloaded=true run id=2026-05-03T09-29-31-410Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-29-31-410Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More inf
**判断**: exit 0 或缺少 path

### TC-049 ✅ PASS
**执行**: `scroll down`
**输出摘要**: scroll ok run id=2026-05-03T09-29-47-997Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-29-47-997Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More info: https://goo.
**判断**: exit 0 + scroll 成功

### TC-050 ✅ PASS
**执行**: `scroll up`
**输出摘要**: scroll ok run id=2026-05-03T09-29-55-225Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-29-55-225Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More info: https://goo.
**判断**: exit 0 + scroll 成功

### TC-051 ✅ PASS
**执行**: `mouse move`
**输出摘要**: mouse move acted=true run id=2026-05-03T09-30-02-432Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-30-02-432Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More info: 
**判断**: exit 0 + mouse move 成功

### TC-052 ✅ PASS
**执行**: `mouse click`
**输出摘要**: mouse click acted=true run id=2026-05-03T09-30-11-819Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-30-11-819Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More info:
**判断**: exit 0 + 无错误

### TC-053 ✅ PASS
**执行**: `mouse wheel`
**输出摘要**: mouse wheel acted=true run id=2026-05-03T09-30-19-028Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-30-19-028Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More info:
**判断**: exit 0 + mouse wheel 成功

### TC-054 ❌ FAIL
**执行**: `click popup`
**输出摘要**: ERROR CLICK_FAILED ReferenceError: DIAGNOSTICS_STATE_KEY is not defined Try: - Pass a valid aria ref from `pw snapshot` - If the page changed, refresh refs with `pw snapshot -i --session <name>` - Or use one semantic locator: --selector/--role/--text/--label/--placeholder/--test-id Details: {   "fai
**判断**: exit 1 (预期 0)

### TC-055 ✅ PASS
**执行**: `mouse dblclick`
**输出摘要**: mouse dblclick acted=true run id=2026-05-03T09-30-38-056Z-eval-d1 dir=/Users/xd/work/tools/pwcli/.pwcli/runs/2026-05-03T09-30-38-056Z-eval-d1 delta console=0 network=0 pageError=0 last console verbose: [DOM] Input elements should have autocomplete attributes (suggested: "current-password"): (More in
**判断**: exit 0 + 无错误



## Domain 5: Batch

### TC-056 ⚠️ WARN
**执行**: `batch single`
**输出摘要**: batch completed=true steps=1 success=1 failed=0 continueOnError=false 
**判断**: exit 0 + 缺少字段 ['summary', 'stepsTotal', 'successCount']

### TC-057 ❌ FAIL
**执行**: `batch login`
**输出摘要**: batch completed=true steps=3 success=3 failed=0 continueOnError=false 
**判断**: exit 0 或缺少 successCount

### TC-058 ❌ FAIL
**执行**: `batch forms`
**输出摘要**: batch completed=true steps=3 success=3 failed=0 continueOnError=false 
**判断**: exit 0 或缺少 successCount

### TC-059 ✅ PASS
**执行**: `batch ghost session`
**输出摘要**: ERROR BATCH_STEP_FAILED SESSION_NOT_FOUND:eval-ses-ghost Details: {   "completed": true,   "analysis": {     "serialOnly": true,     "requiresExistingSession": true,     "stepCount": 1,     "continueOnError": false,     "supportedTopLevel": [       "bootstrap",       "check",       "click",       "c
**判断**: exit 1 + SESSION_NOT_FOUND

### TC-060 ⚠️ WARN
**执行**: `batch continue-on-error`
**输出摘要**: batch completed=true steps=2 success=1 failed=1 continueOnError=true first failure step=1 command=click reason=- Error: CLICK_SELECTOR_NOT_FOUND:{"target":{"selector":"#nonexistent-element-xyz","nth":1}} warnings: - step 1 (click --selector #nonexistent-element-xyz) changes page state; if step 2 (ob
**判断**: exit 0 + exit 0 或缺少 failureCount

### TC-061 ✅ PASS
**执行**: `batch summary-only`
**输出摘要**: {   "ok": true,   "command": "batch",   "data": {     "completed": true,     "analysis": {       "serialOnly": true,       "requiresExistingSession": true,       "stepCount": 2,       "continueOnError": false,       "supportedTopLevel": [         "bootstrap",         "check",         "click",       
**判断**: exit 0 + summary 存在

### TC-062 ✅ PASS
**执行**: `batch include-results`
**输出摘要**: {   "ok": true,   "command": "batch",   "data": {     "completed": true,     "analysis": {       "serialOnly": true,       "requiresExistingSession": true,       "stepCount": 1,       "continueOnError": false,       "supportedTopLevel": [         "bootstrap",         "check",         "click",       
**判断**: exit 0 + results 存在



## Domain 6: Verify & Get

### TC-063 ⚠️ WARN
**执行**: `verify text`
**输出摘要**: verify text passed=true text="Total Users" count=1 actual={   "count": 1,   "nth": 1,   "matched": true } expected={   "text": "Total Users" } 
**判断**: exit 0 + 缺少字段 ['passed: true']

### TC-064 ⚠️ WARN
**执行**: `verify text-absent`
**输出摘要**: verify text-absent passed=true text="THIS_VERY_UNIQUE_STRING_SHOULDNOTEXIST" count=0 actual={   "count": 0,   "nth": 1,   "matched": false } expected={   "text": "THIS_VERY_UNIQUE_STRING_SHOULDNOTEXIST" } 
**判断**: exit 0 + 缺少字段 ['passed: true']

### TC-065 ⚠️ WARN
**执行**: `verify visible`
**输出摘要**: verify visible passed=true selector=[data-testid="stat-users"] count=1 actual=true expected=visible 
**判断**: exit 0 + 缺少字段 ['passed: true']

### TC-066 ⚠️ WARN
**执行**: `verify disabled`
**输出摘要**: verify disabled passed=true selector=[data-testid="btn-disabled"] count=1 actual=false expected=disabled 
**判断**: exit 0 + 缺少字段 ['passed: true']

### TC-067 ⚠️ WARN
**执行**: `verify url`
**输出摘要**: verify url passed=true actual=http://localhost:3099/dashboard expected={   "contains": "/dashboard" } 
**判断**: exit 0 + 缺少字段 ['passed: true']

### TC-068 ⚠️ WARN
**执行**: `verify count`
**输出摘要**: verify count passed=true selector=[data-testid^="stat-"] count=4 actual=4 expected={   "equals": 4 } 
**判断**: exit 0 + 缺少字段 ['passed: true', 'count: 4']

### TC-069 ✅ PASS
**执行**: `get text`
**输出摘要**: get text=12,842 count=1 selector=[data-testid="stat-users"] .text-2xl 
**判断**: exit 0 + text 字段非空

### TC-070 ✅ PASS
**执行**: `locate`
**输出摘要**: locate count=1 text="Total Users" 1. span visible=true name="Total Users" region="section name=\"Statistics\" selector=\"section[aria-label=\\\"Statistics\\\"]\"" ancestor="div name=\"Total Users\" selector=\"div.flex.items-center\"" selectorHint="section[aria-label=\"Statistics\"] > div[data-testid
**判断**: exit 0 + count>=1

### TC-071 ⚠️ WARN
**执行**: `is visible`
**输出摘要**: is visible=true count=1 selector=[data-testid="login-submit"] 
**判断**: exit 0 + 缺少字段 ['value: true']

### TC-072 ✅ PASS
**执行**: `verify text fail`
**输出摘要**: ERROR VERIFY_FAILED verify text failed Try: - Run `pw read-text --session <name> --max-chars 4000` to inspect visible text - Run `pw locate --session <name> --text '<text>'` to inspect text candidates - Run `pw diagnostics bundle --session <name> --out .pwcli/bundles/verify-failure --limit 20` if th
**判断**: exit 1 + VERIFY_FAILED



## Domain 7: 诊断

### TC-073 ⚠️ WARN
**执行**: `network list`
**输出摘要**: total=200 2026-05-03T09:32:15.745Z response GET fetch req-676 /api/auth/me -> 200 2026-05-03T09:32:15.745Z response GET fetch req-677 /dashboard?_rsc=tvb34 -> 200 2026-05-03T09:32:15.746Z response GET fetch req-678 /forms?_rsc=tvb34 -> 200 2026-05-03T09:32:15.746Z response GET fetch req-679 /interac
**判断**: exit 0 + 缺少字段 ['url', 'method', 'status']

### TC-074 ⚠️ WARN
**执行**: `network --include-body`
**输出摘要**: total=200 2026-05-03T09:32:15.751Z request GET script req-687 /_next/static/chunks/app/(protected)/dynamic/page-1104bcd204aa478b.js 2026-05-03T09:32:15.751Z response GET script req-687 /_next/static/chunks/app/(protected)/dynamic/page-1104bcd204aa478b.js -> 200 2026-05-03T09:32:15.752Z response GET 
**判断**: exit 0 + 缺少字段 ['requestBody', 'responseBody']

### TC-075 ⚠️ WARN
**执行**: `console`
**输出摘要**: total=6 errors=3 warnings=0 2026-05-03T09:24:48.895Z error: Failed to load resource: the server responded with a status of 404 (Not Found) 2026-05-03T09:27:13.031Z error: Failed to load resource: the server responded with a status of 400 (Bad Request) 2026-05-03T09:27:27.954Z error: Failed to load r
**判断**: exit 0 + 缺少字段 ['console', 'messages', 'level']

### TC-076 ✅ PASS
**执行**: `errors recent`
**输出摘要**: {   "action": "recent",   "summary": {     "total": 3,     "visible": 3,     "clearedCount": 0,     "matched": 3   },   "errors": [     {       "index": 1,       "kind": "pageerror",       "sessionName": "eval-d1",       "timestamp": "2026-05-03T09:26:00.778Z",       "pageId": "p2",       "navigatio
**判断**: exit 0 + errors 记录

### TC-077 ✅ PASS
**执行**: `diagnostics runs`
**输出摘要**: runs count=40 2026-05-03T09-32-24-013Z-eval-d1 session=eval-d1 commands=2 failures=2 signals=3 last=2026-05-03T09:32:25.088Z 2026-05-03T09-30-38-056Z-eval-d1 session=eval-d1 commands=1 failures=0 signals=3 last=2026-05-03T09:30:38.057Z 2026-05-03T09-30-28-619Z-eval-d1 session=eval-d1 commands=1 fail
**判断**: exit 0 + runs 列表存在

### TC-078 ✅ PASS
**执行**: `diagnostics show`
**输出摘要**: {   "runId": "2026-05-03T09-32-24-013Z-eval-d1",   "command": null,   "text": null,   "since": null,   "fields": null,   "count": 2,   "total": 2,   "events": [     {       "ts": "2026-05-03T09:32:24.013Z",       "command": "click",       "sessionName": "eval-d1",       "pageId": null,       "naviga
**判断**: exit 0 + events 数组非空

### TC-079 ✅ PASS
**执行**: `diagnostics bundle`
**输出摘要**: page /network (pwcli Test App) {   "bundled": true,   "out": "/tmp/eval-bundle",   "limit": 20,   "latestRunId": "2026-05-03T09-32-24-013Z-eval-d1",   "auditConclusion": {     "status": "failed_or_risky",     "failedAt": "2026-05-03T09:32:25.088Z",     "failedCommand": "click",     "failureKind": "A
**判断**: exit 0 + manifest.json 存在

### TC-080 ✅ PASS
**执行**: `diagnostics digest`
**输出摘要**: page /network (pwcli Test App) summary consoleErrors=3 consoleWarnings=0 httpErrors=0 failedRequests=0 pageErrors=3 signals: 2026-05-03T09:30:24.551Z pageerror Minified React error #418; visit https://react.dev/errors/418?args[]= for the full message or use the non-minified dev environment for full 
**判断**: exit 0 + URL+计数字段

### TC-081 ✅ PASS
**执行**: `diagnostics timeline`
**输出摘要**: page /network (pwcli Test App) {   "count": 20,   "total": 220,   "entries": [     {       "timestamp": "2026-05-03T09:32:15.746Z",       "kind": "response",       "summary": "GET http://localhost:3099/forms?_rsc=tvb34 -> 200",       "details": {         "kind": "response",         "sessionName": "e
**判断**: exit 0 + 时间线条目存在

### TC-082 ✅ PASS
**执行**: `trace stop`
**输出摘要**: trace stop stopped=true artifact=.pwcli/playwright/traces/trace-1777800287766.trace next=pw trace inspect ".pwcli/playwright/traces/trace-1777800287766.trace" --section actions hint=Use `pw trace inspect <traceArtifactPath> --section actions\|requests\|console\|errors` to inspect the saved trace art
**判断**: exit 0 + traceArtifactPath 存在

### TC-083 ⏭️ SKIP
**执行**: `trace inspect`
**输出摘要**: trace stop stopped=true artifact=.pwcli/playwright/traces/trace-1777800287766.trace next=pw trace inspect ".pwcli/playwright/traces/trace-1777800287766.trace" --section actions hint=Use `pw trace inspect <traceArtifactPath> --section actions\|requests\|console\|errors` to inspect the saved trace art
**判断**: 无 trace 文件可用

### TC-084 ✅ PASS
**执行**: `har start`
**输出摘要**: ERROR UNSUPPORTED_HAR_CAPTURE HAR recording is not supported on managed sessions. The Playwright BrowserContext is already open and HAR capture must be configured at context creation time. Try: - Use `pw har replay <file>` to replay a pre-recorded HAR for deterministic network stubbing - To capture 
**判断**: exit 1 + har start 返回 UNSUPPORTED_HAR_CAPTURE (exit 1 预期)

### TC-085 ⚠️ WARN
**执行**: `doctor`
**输出摘要**: {   "healthy": false,   "summary": {     "ok": 4,     "warn": 1,     "fail": 0,     "skipped": 3   },   "recovery": {     "blocked": false,     "kind": null,     "suggestions": []   } } 
**判断**: exit 0 + 缺少字段 ['diagnostics', 'environment', 'Node.js']

### TC-086 ✅ PASS
**执行**: `video stop`
**输出摘要**: video video stopped=true videoPath=.pwcli/playwright/video-2026-05-03T09-33-03-323Z.webm 
**判断**: exit 0 + videoPath 存在

### TC-087 ✅ PASS
**执行**: `errors clear+recent`
**输出摘要**: {   "action": "clear",   "summary": {     "total": 3,     "visible": 0,     "clearedCount": 3,     "matched": 0   },   "errors": [] }  / {   "action": "recent",   "summary": {     "total": 3,     "visible": 0,     "clearedCount": 3,     "matched": 0   },   "errors": [] } 
**判断**: exit 0 + clear+recent 均成功

### TC-088 ✅ PASS
**执行**: `console --level error`
**输出摘要**: total=3 errors=3 warnings=0 2026-05-03T09:24:48.895Z error: Failed to load resource: the server responded with a status of 404 (Not Found) 2026-05-03T09:27:13.031Z error: Failed to load resource: the server responded with a status of 400 (Bad Request) 2026-05-03T09:27:27.954Z error: Failed to load r
**判断**: exit 0 + console level 过滤



## Domain 8: Route & Mock

### TC-089 ✅ PASS
**执行**: `route add`
**输出摘要**: {   "action": "add",   "added": true,   "route": {     "pattern": "http://localhost:3099/api/data",     "mode": "fulfill",     "addedAt": "2026-05-03T09:33:14.285Z",     "status": 200,     "contentType": "application/json",     "method": "GET",     "hasBody": true,     "bodyPreview": "{\"mocked\":tr
**判断**: exit 0 + route 添加成功

### TC-090 ✅ PASS
**执行**: `route add patch-text`
**输出摘要**: {   "action": "add",   "added": true,   "route": {     "pattern": "http://localhost:3099/api/data",     "mode": "patch-response",     "addedAt": "2026-05-03T09:33:15.386Z",     "method": "GET",     "patchText": {       "items": "MOCKED_ITEMS"     }   },   "routeCount": 2 } 
**判断**: exit 0 + route patch-text 成功

### TC-091 ✅ PASS
**执行**: `route list`
**输出摘要**: {   "action": "list",   "routeCount": 2,   "routes": [     {       "pattern": "http://localhost:3099/api/data",       "mode": "fulfill",       "addedAt": "2026-05-03T09:33:14.285Z",       "status": 200,       "contentType": "application/json",       "method": "GET",       "hasBody": true,       "bod
**判断**: exit 0 + routes 数组存在

### TC-092 ✅ PASS
**执行**: `route remove`
**输出摘要**: {   "action": "remove",   "removed": true,   "pattern": "http://localhost:3099/api/data",   "removedCount": 2,   "routeCount": 0,   "routes": [] } 
**判断**: exit 0 + route remove 成功

### TC-093 ✅ PASS
**执行**: `route remove all`
**输出摘要**: {   "action": "list",   "routeCount": 0,   "routes": [] } 
**判断**: exit 0 + routes 清空

### TC-094 ✅ PASS
**执行**: `mock verify`
**输出摘要**: {"mocked":true} [truncated: false, chars: 15/15] 
**判断**: exit 0 + read-text 含 mock 内容

### TC-095 ❌ FAIL
**执行**: `batch route`
**输出摘要**: batch completed=true steps=2 success=2 failed=0 continueOnError=false 
**判断**: exit 0 或缺少 successCount

### TC-096 ✅ PASS
**执行**: `route load`
**输出摘要**: {   "loadedCount": 1,   "routes": [     {       "pattern": "http://localhost:3099/api/data/error",       "mode": "fulfill",       "addedAt": "2026-05-03T09:33:29.629Z",       "status": 200,       "contentType": "application/json",       "hasBody": true,       "bodyPreview": "{\"recovered\":true}"   
**判断**: exit 0 + route load 成功



## Domain 9: Auth & State

### TC-097 ✅ PASS
**执行**: `cookies list`
**输出摘要**: {   "count": 1,   "cookies": [     {       "name": "pwcli_session",       "value": "han6u1ylzhwmopkm376",       "domain": "localhost",       "path": "/",       "expires": 1777887063.475234,       "httpOnly": true,       "secure": false,       "sameSite": "Lax"     }   ] } 
**判断**: exit 0 + cookies 含 pwcli_session

### TC-098 ✅ PASS
**执行**: `cookies set`
**输出摘要**: {   "set": true,   "cookie": {     "name": "eval_test_cookie",     "value": "test_value_123",     "domain": "localhost",     "path": "/",     "expires": -1,     "httpOnly": false,     "secure": false,     "sameSite": "Lax"   } } 
**判断**: exit 0 + cookie 设置成功

### TC-099 ✅ PASS
**执行**: `storage local set+get`
**输出摘要**: {   "kind": "local",   "operation": "set",   "origin": "http://localhost:3099",   "href": "http://localhost:3099/dashboard",   "key": "eval_test_key",   "value": "eval_test_value",   "changed": true }  / {   "kind": "local",   "operation": "get",   "origin": "http://localhost:3099",   "href": "http:
**判断**: exit 0 + get 返回正确值

### TC-100 ✅ PASS
**执行**: `storage session`
**输出摘要**: {   "kind": "session",   "origin": "http://localhost:3099",   "href": "http://localhost:3099/dashboard",   "accessible": true,   "entries": {} } 
**判断**: exit 0 + accessible 字段存在

### TC-101 ⚠️ WARN
**执行**: `state diff`
**输出摘要**: ERROR STATE_DIFF_BEFORE_REQUIRED state diff requires a baseline snapshot file Try: - Run `pw state diff --session bug-a --before .pwcli/state/bug-a-before.json` to capture a baseline snapshot - Later rerun the same command after state changes to compare against the saved baseline - Or compare two sa
**判断**: exit 1 + exit 1 或缺少 summary

### TC-102 ⚠️ WARN
**执行**: `state diff --include-values`
**输出摘要**: ERROR STATE_DIFF_BEFORE_REQUIRED state diff requires a baseline snapshot file Try: - Run `pw state diff --session bug-a --before .pwcli/state/bug-a-before.json` to capture a baseline snapshot - Later rerun the same command after state changes to compare against the saved baseline - Or compare two sa
**判断**: exit 1 + exit 1 或缺少 summary

### TC-103 ✅ PASS
**执行**: `auth probe`
**输出摘要**: {   "status": "authenticated",   "confidence": "medium",   "blockedState": "none",   "recommendedAction": "continue",   "capability": {     "capability": "auth-state-probe",     "supported": true,     "available": true,     "blocked": false,     "reusableStateLikely": true,     "status": "authentica
**判断**: exit 0 + status=authenticated

### TC-104 ✅ PASS
**执行**: `auth probe --url`
**输出摘要**: page /dashboard (pwcli Test App) {   "status": "authenticated",   "confidence": "high",   "blockedState": "none",   "recommendedAction": "continue",   "capability": {     "capability": "auth-state-probe",     "supported": true,     "available": true,     "blocked": false,     "reusableStateLikely": 
**判断**: exit 0 + status=authenticated

### TC-105 ✅ PASS
**执行**: `profile list-chrome`
**输出摘要**: {   "count": 2,   "profiles": [     {       "browser": "chrome",       "directory": "Default",       "name": "xd.com",       "userDataDir": "/Users/xd/Library/Application Support/Google/Chrome",       "profilePath": "/Users/xd/Library/Application Support/Google/Chrome/Default",       "default": true
**判断**: exit 0 + capability 字段存在



## Domain 10: Environment & Bootstrap

### TC-106 ✅ PASS
**执行**: `clock install/set/resume`
**输出摘要**: {   "clock": {     "installed": true,     "paused": false,     "source": "context.clock",     "lastAction": "install",     "updatedAt": "2026-05-03T09:33:42.077Z"   } }  / {   "clock": {     "installed": true,     "paused": false,     "source": "context.clock",     "lastAction": "set",     "updatedA
**判断**: exit 0 + 三步均成功

### TC-107 ✅ PASS
**执行**: `offline on/off`
**输出摘要**: {   "mode": "on",   "offline": {     "enabled": true,     "updatedAt": "2026-05-03T09:33:45.395Z"   } }  / {   "mode": "off",   "offline": {     "enabled": false,     "updatedAt": "2026-05-03T09:33:46.392Z"   } } 
**判断**: exit 0 + 两次均成功

### TC-108 ✅ PASS
**执行**: `geolocation set`
**输出摘要**: {   "geolocation": {     "latitude": 31.2304,     "longitude": 121.4737,     "accuracy": 0,     "updatedAt": "2026-05-03T09:33:47.396Z"   },   "note": "Grant geolocation permission separately if the page needs to read navigator.geolocation." } 
**判断**: exit 0 + geolocation 设置成功

### TC-109 ✅ PASS
**执行**: `bootstrap apply`
**输出摘要**: {   "applied": true,   "initScriptCount": 1,   "initScripts": [     "/tmp/eval-init.js"   ],   "headersApplied": false,   "bootstrap": {     "applied": true,     "updatedAt": "2026-05-03T09:33:48.401Z",     "initScriptCount": 1,     "initScripts": [       "/tmp/eval-init.js"     ],     "headersAppli
**判断**: exit 0 + bootstrapApplied 存在

### TC-110 ⚠️ WARN
**执行**: `doctor bootstrap`
**输出摘要**: {   "healthy": false,   "summary": {     "ok": 4,     "warn": 1,     "fail": 0,     "skipped": 3   },   "recovery": {     "blocked": false,     "kind": null,     "suggestions": []   } } 
**判断**: exit 0 + 缺少字段 ['initScript', 'appliedAt']

### TC-111 ✅ PASS
**执行**: `sse`
**输出摘要**: page /api/stream {   "count": 0,   "records": [],   "message": "No SSE records. Ensure EventSource is used after session create." } 
**判断**: exit 0 + SSE 事件记录

### TC-112 ❌ FAIL
**执行**: `code`
**输出摘要**: ERROR CODE_EXECUTION_FAILED SyntaxError: Unexpected token 'return' Try: - Pass inline code like: pw code --session bug-a "async page => { await page.goto('https://example.com'); return await page.title(); }" - Or pass --file <path> with code that evaluates to a function taking page Details: {} 
**判断**: exit 1 (预期 0)

### TC-113 ❌ FAIL
**执行**: `code --file`
**输出摘要**: ERROR CODE_EXECUTION_FAILED Error: File access denied: /tmp/eval-code.js is outside allowed roots. Allowed roots: /Users/xd/work/tools/pwcli/.pwcli/playwright, /Users/xd/work/tools/pwcli Try: - Pass inline code like: pw code --session bug-a "async page => { await page.goto('https://example.com'); re
**判断**: exit 1 (预期 0)

### TC-114 ✅ PASS
**执行**: `locate --return-ref`
**输出摘要**: locate count=2 text="Sign in" ref=e29 1. h1 visible=true name="Sign in" ancestor="div name=\"Sign inEnter your credentials to continueEmail addressPasswordRemember meSign in\" selector=\"div[data-testid=\\\"login-card\\\"]\"" selectorHint="div[data-testid=\"login-page\"] > div.w-full.max-w-sm > div[
**判断**: exit 0 + ref 字段非空

### TC-115 ✅ PASS
**执行**: `permissions grant`
**输出摘要**: {   "permissions": {     "granted": [       "geolocation"     ],     "updatedAt": "2026-05-03T09:34:17.975Z"   } } 
**判断**: exit 0 + 权限授予成功



## Domain 11: Auth Flow E2E

### TC-116 ⚠️ WARN
**执行**: `demo login`
**输出摘要**: verify url passed=true actual=http://localhost:3099/dashboard expected={   "contains": "/dashboard" } 
**判断**: exit 0 + 缺少字段 ['passed: true']

### TC-117 ❌ FAIL
**执行**: `MFA login`
**输出摘要**: ERROR VERIFY_FAILED verify url failed Try: - Run `pw page current --session <name>` to inspect the active URL - Run `pw wait --networkidle --session <name>` before retrying the assertion Details: {   "assertion": "url",   "passed": false,   "expected": {     "contains": "/dashboard"   },   "actual":
**判断**: exit 1 (预期 0)

### TC-118 ❌ FAIL
**执行**: `bad password`
**输出摘要**: verify text passed=true text="Invalid email or password" count=1 actual={   "count": 1,   "nth": 1,   "matched": true } expected={   "text": "Invalid email or password" }  / verify url passed=true actual=http://localhost:3099/login expected={   "contains": "/login" } 
**判断**: exit 0/0 或 verify 未通过

### TC-119 ⚠️ WARN
**执行**: `unauth redirect`
**输出摘要**: verify url passed=true actual=http://localhost:3099/login?from=%2Fdashboard expected={   "contains": "/login" } 
**判断**: exit 0 + 缺少字段 ['passed: true']

### TC-120 ✅ PASS
**执行**: `admin login`
**输出摘要**: {"user":{"id":"u2","email":"admin@test.com","name":"Admin User","role":"admin"}} [truncated: false, chars: 80/80] 
**判断**: exit 0 + 含 admin role 信息



## 失败/警告汇总

### ❌ FAIL 列表
- TC-020: `screenshot` → exit 0 或缺少 path
- TC-021: `screenshot --full-page` → exit 0 或缺少 path
- TC-038: `click ref` → 无法获取 Sign in ref
- TC-039: `fill email+password` → exit 0/0 或缺少 acted=true
- TC-048: `download` → exit 0 或缺少 path
- TC-054: `click popup` → exit 1 (预期 0)
- TC-057: `batch login` → exit 0 或缺少 successCount
- TC-058: `batch forms` → exit 0 或缺少 successCount
- TC-083: `trace inspect` → SKIP: 无 trace 文件可用
- TC-095: `batch route` → exit 0 或缺少 successCount
- TC-112: `code` → exit 1 (预期 0)
- TC-113: `code --file` → exit 1 (预期 0)
- TC-117: `MFA login` → exit 1 (预期 0)
- TC-118: `bad password` → exit 0/0 或 verify 未通过


### ⚠️ WARN 列表
- TC-001: exit 0 但 缺少字段 ['created: true']
- TC-002: exit 0 但 缺少字段 ['headed: true']
- TC-004: exit 0 但 缺少字段 ['active: true']
- TC-005: exit 0 但 exit 非0 但缺少 ['SESSION_NOT_FOUND', 'NOT_FOUND']
- TC-006: exit 0 但 缺少字段 ['count']
- TC-007: exit 0 但 缺少字段 ['withPage: true']
- TC-008: exit 0 但 缺少字段 ['recreated: true']
- TC-009: exit 0 但 缺少字段 ['capability']
- TC-010: exit 0 但 缺少字段 ['closed: true', 'name: eval-ses-02']
- TC-013: exit 0 但 缺少字段 ['text']
- TC-018: exit 0 但 缺少字段 ['role']
- TC-027: exit 0 但 缺少字段 ['pages']
- TC-030: exit 0 但 缺少字段 ['waited', 'networkIdle']
- TC-031: exit 0 但 缺少字段 ['waited', 'selector']
- TC-032: exit 0 但 缺少字段 ['waited', 'text']
- TC-033: exit 0 但 缺少字段 ['waited', 'networkIdle']
- TC-036: exit 0 但 缺少字段 ['acted: true']
- TC-037: exit 0 但 缺少字段 ['acted: true']
- TC-040: exit 0 但 缺少字段 ['acted: true']
- TC-041: exit 0 但 缺少字段 ['acted: true']
- TC-043: exit 0 但 缺少字段 ['value', 'acted']
- TC-044: exit 0 但 缺少字段 ['acted: true']
- TC-045: exit 0 但 缺少字段 ['acted: true']
- TC-046: exit 0 但 缺少字段 ['acted: true']
- TC-047: exit 0 但 exit 0 或缺少文件名
- TC-056: exit 0 但 缺少字段 ['summary', 'stepsTotal', 'successCount']
- TC-060: exit 0 但 exit 0 或缺少 failureCount
- TC-063: exit 0 但 缺少字段 ['passed: true']
- TC-064: exit 0 但 缺少字段 ['passed: true']
- TC-065: exit 0 但 缺少字段 ['passed: true']
- TC-066: exit 0 但 缺少字段 ['passed: true']
- TC-067: exit 0 但 缺少字段 ['passed: true']
- TC-068: exit 0 但 缺少字段 ['passed: true', 'count: 4']
- TC-071: exit 0 但 缺少字段 ['value: true']
- TC-073: exit 0 但 缺少字段 ['url', 'method', 'status']
- TC-074: exit 0 但 缺少字段 ['requestBody', 'responseBody']
- TC-075: exit 0 但 缺少字段 ['console', 'messages', 'level']
- TC-085: exit 0 但 缺少字段 ['diagnostics', 'environment', 'Node.js']
- TC-101: exit 0 但 exit 1 或缺少 summary
- TC-102: exit 0 但 exit 1 或缺少 summary
- TC-110: exit 0 但 缺少字段 ['initScript', 'appliedAt']
- TC-116: exit 0 但 缺少字段 ['passed: true']
- TC-119: exit 0 但 缺少字段 ['passed: true']


## 评测结论
总通过率: 63/120 (52%)
核心链路通过率（D1+D2+D4+D11）: 20/45 (44%)
主要问题域: D4（FAIL=4）
质量评价: needs-work

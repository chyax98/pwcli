# 工作流剧本

## 1. 新页面上复现一个 bug

```bash
pw session create bug-a --open 'https://example.com'
pw observe status --session bug-a
pw page current --session bug-a
pw read-text --session bug-a --max-chars 1200
pw snapshot --session bug-a
pw click e6 --session bug-a
pw wait networkIdle --session bug-a
pw diagnostics digest --session bug-a
pw console --session bug-a --level warning --limit 20
pw network --session bug-a --kind response --limit 20
pw errors recent --session bug-a --limit 20
pw diagnostics show --run <runId> --command click --since 2026-04-26T00:00:00.000Z --fields at=ts,cmd=command,net=diagnosticsDelta.networkDelta
pw diagnostics export --session bug-a --section network --text checkout --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out ./diag.json
pw diagnostics runs --session bug-a --since 2026-04-26T00:00:00.000Z
```

适用场景：

- 需要拿到 DOM 真实状态
- 需要立刻拿到 diagnostics
- 需要一份稳定导出证据

补充：

- 大页面默认不要先打 `snapshot`
- 只有你真的需要 refs 时，再把 `snapshot` 提前

## 2. 用确定性 mock 复现

```bash
pw session create mock-a --open 'http://127.0.0.1:4179/blank'
pw route load ./scripts/manual/mock-routes.json --session mock-a
pw route list --session mock-a
pw click --selector '#route-only' --session mock-a
pw read-text --session mock-a --selector '#last-route-result'
pw route add '**/api/summary**' --patch-json-file ./summary-patch.json --patch-status 298 --session mock-a
```

适用场景：

- 后端响应不稳定
- 需要精确控制 status / body
- 只想 patch 一两个字段，但又保留真实 upstream response 形状
- 需要稳定 smoke 或诊断环境

## 3. 复用认证态

```bash
pw session create auth-a --open 'https://example.com'
pw auth dc-login --session auth-a --arg targetUrl='https://example.com' --save-state ./auth.json
pw session close auth-a
pw session create auth-b --open 'https://example.com' --state ./auth.json
```

适用场景：

- 登录成本高
- 后续还有稳定复查动作

## 3.1 Forge / DC 登录

```bash
pw session list
pw auth list
pw auth info dc-login
pw observe status --session dc-forge
pw page current --session dc-forge
pw read-text --session dc-forge --max-chars 1200
pw auth dc-login --session dc-forge --arg targetUrl='https://developer-.../forge'
```

适用场景：

- 任务已经明确指向 Forge / DC session
- 你想优先复用已有登录态，而不是新建重复 session
- 你需要确认登录 contract，但不想猜不存在的命令

## 4. 使用环境控制

```bash
pw session create env-a --open 'http://127.0.0.1:4179/blank'
pw environment offline on --session env-a
pw environment permissions grant geolocation --session env-a
pw environment geolocation set --session env-a --lat 37.7749 --lng -122.4194
```

适用场景：

- 复现 offline 场景
- 复现 geolocation 相关逻辑
- 复现 permission gated UI

## 5. 使用结构化 batch

stdin 模式：

```bash
printf '%s\n' '[
  ["snapshot"],
  ["click", "e6"],
  ["wait", "networkIdle"],
  ["observe", "status"]
]' | pw batch --session bug-a --json
```

文件模式：

```bash
pw batch --session bug-a --file ./steps.json
```

适用场景：

- 一个 agent turn 需要一个浏览器 turn
- 步骤序列是确定性的
- 你需要一个结构化结果 envelope

保持 batch 收窄：

- 优先使用文档里的稳定子集
- 有依赖关系的步骤必须严格按顺序写
- `open` / `click` / `press` 后，如果下一步依赖新页面状态，显式插入 `wait`
- lifecycle / auth / environment / dialog recovery 不要放进 batch
- 超出稳定子集时，直接跑普通 `pw` 命令
- 需要条件逻辑时，再转 `pw code`

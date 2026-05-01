# Command Surface

更新时间：2026-05-01
状态：active

这份文档是维护者用的命令能力地图。它从 `src/app/commands/index.ts`、各命令实现和 `node dist/cli.js --help` 对齐当前 shipped command surface。

它不是第二套使用教程。Agent 执行任务时仍然以 [`skills/pwcli/SKILL.md`](../../skills/pwcli/SKILL.md) 和 `skills/pwcli/references/` 为准。

## 1. 校验入口

每次命令面变化后，先跑：

```bash
pnpm build
node dist/cli.js --help
```

然后按影响同步：

1. `skills/pwcli/`：使用路径、参数、错误恢复。
2. `docs/architecture/domain-status.md`：领域边界、限制、扩展口。
3. 本文件：命令家族、源码入口、Agent 价值。

## 2. 命令家族

| 家族 | Commands | 主要源码 | Agent 价值 | 使用真相 |
|---|---|---|---|---|
| Lifecycle | `session create|attach|recreate|list|status|close` | `src/app/commands/session.ts` | 创建、接管、恢复、关闭 named session | `command-reference.md` |
| Navigation | `open` | `src/app/commands/open.ts` | 只在已有 session 中导航 | `SKILL.md`、`command-reference.md` |
| Human observation | `dashboard open` | `src/app/commands/dashboard.ts` | 打开 Playwright dashboard 供人观察或接管 | `command-reference-advanced.md` |
| Workspace view | `observe status`、`page current|list|frames|dialogs`、`tab select|close` | `observe.ts`、`page.ts`、`tab.ts` | 读取当前页面、tabs、frames、dialog projection，并用 stable `pageId` 切换页面 | `command-reference.md` |
| Page read | `read-text`、`snapshot`、`screenshot`、`pdf` | `read-text.ts`、`snapshot.ts`、`screenshot.ts`、`pdf.ts` | 低噪声文本、结构树、图片和 PDF 证据 | `SKILL.md`、`command-reference.md` |
| State checks | `locate`、`get`、`is`、`verify` | `locate.ts`、`get.ts`、`is.ts`、`verify.ts` | read-only 定位、事实读取、布尔检查、断言闭环 | `command-reference.md` |
| Actions | `click`、`fill`、`type`、`press`、`hover`、`scroll`、`check`、`uncheck`、`select`、`drag`、`upload`、`download`、`resize`、`dialog`、`wait` | 对应 `src/app/commands/*.ts` | 执行动作、处理弹窗、等待状态、产出 run evidence | `command-reference.md` |
| Diagnostics | `diagnostics digest|export|bundle|runs|show|grep`、`console`、`network`、`errors`、`doctor` | `diagnostics.ts`、`console.ts`、`network.ts`、`errors.ts`、`doctor.ts` | 从 live session 和 run artifacts 归因、定位、导出证据 | `command-reference-diagnostics.md` |
| Trace / HAR | `trace start|stop|inspect`、`har start|stop` | `trace.ts`、`har.ts` | trace zip 离线查询、HAR substrate 边界 | `command-reference-diagnostics.md` |
| Mock / bootstrap | `route list|add|load|remove`、`bootstrap apply` | `route.ts`、`bootstrap.ts` | 请求拦截、fulfill、abort、JSON patch、headers/init script 注入 | `command-reference-diagnostics.md`、`command-reference-advanced.md` |
| Identity state | `auth`、`state`、`cookies`、`storage`、`profile` | `auth.ts`、`state.ts`、`cookies.ts`、`storage.ts`、`profile.ts` | 登录态获取、存储导入导出、当前 origin 状态读写、本机 Chrome profile discovery | `command-reference-advanced.md` |
| Environment | `environment offline|geolocation|permissions|clock` | `environment.ts` | 受控网络、位置、权限、时间 | `command-reference-advanced.md` |
| Automation | `batch`、`code`、`skill` | `batch.ts`、`code.ts`、`skill.ts` | 结构化串行编排、Playwright escape hatch、分发 skill | `command-reference-advanced.md` |

## 3. 顶层命令清单

当前顶层 CLI help 暴露：

```text
open
code
auth
batch
bootstrap
dashboard
diagnostics
dialog
doctor
environment
errors
page
pdf
resize
snapshot
screenshot
read-text
check
locate
get
is
verify
fill
type
press
hover
scroll
select
uncheck
upload
download
drag
console
har
network
observe
click
route
wait
trace
cookies
state
storage
profile
tab
session
skill
```

如果 `src/app/commands/index.ts` 新增或删除命令，必须同步这份清单和对应 reference。

## 4. Agent 消费路径

### 常规浏览器任务

```text
session create -> observe status -> read-text/locate/snapshot -> action -> wait -> verify -> diagnostics digest
```

目标是让 Agent 在少量命令里形成“看到页面、行动、确认结果、保留证据”的闭环。

### Auth / 登录态任务

```text
profile list-chrome -> session create --from-system-chrome
```

或：

```text
session create -> auth <provider> --arg targetUrl=... -> state save
```

`auth` 不创建 session。需要哪个 URL，由 Agent 从用户目标或 provider `auth info` 解析成 `targetUrl`，provider 登录后再导航或落到目标页。

### 诊断任务

```text
errors clear -> reproduce action -> wait -> diagnostics digest -> diagnostics bundle/export -> diagnostics show/grep
```

`diagnostics bundle` 是 failure handoff 的最小包；`diagnostics show|grep --run <runId>` 用 run evidence 做细查。

### 受控测试任务

```text
route/bootstrap/environment -> action -> wait -> verify -> diagnostics export
```

Mock 和 environment 是第二层能力，只在场景需要确定性时引入。

### 人类接管

```text
dashboard open
page list
tab select <pageId>
```

dashboard 是观察面，不是 Agent 主执行链。

## 5. 不进入当前命令面的能力

- 不维护外部 auth plugin lifecycle。
- 不把 `open` 扩回 lifecycle 创建入口。
- 不把 `locate|get|is|verify` 变成 action planner。
- 不追求 `batch` 与所有 CLI flag 完全 parity。
- 不手写 Playwright 已稳定提供的 primitive，除非 Agent contract 需要更薄的输出、错误码或恢复建议。

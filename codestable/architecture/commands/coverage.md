# pw command coverage

<!-- 顶层命令覆盖矩阵。使用教程仍以 skills/pwcli/ 为准。 -->

## 是什么

这份矩阵把 `node dist/cli.js --help` 暴露的每个顶层 command 映射到 `codestable/architecture/commands/` 下的命令族 ADR，避免命令设计文档漏项。

## 生成基线

验证命令：

```bash
pnpm build
node dist/cli.js --help
```

基线日期：2026-05-04  
项目版本：`pw v1.0.0`

## 覆盖矩阵

| 顶层 command | 命令族文档 | 状态口径 |
|---|---|---|
| `snapshot` | `observe.md` | 页面事实读取 |
| `read-text` | `observe.md` | 页面事实读取 |
| `text` | `observe.md` | `read-text` 短别名 |
| `status` | `observe.md` | workspace/status |
| `observe` | `observe.md` | status 兼容入口 |
| `screenshot` | `observe.md` | 页面事实证据 |
| `pdf` | `observe.md` | 页面归档证据 |
| `accessibility` | `observe.md` | accessibility tree |
| `page` | `observe.md` | workspace/page projection |
| `tab` | `observe.md` | stable `pageId` tab 操作 |
| `click` | `interaction.md` | 标准 action |
| `fill` | `interaction.md` | 标准 action |
| `type` | `interaction.md` | 标准 action |
| `press` | `interaction.md` | 标准 action |
| `hover` | `interaction.md` | 标准 action |
| `check` | `interaction.md` | 标准 action |
| `uncheck` | `interaction.md` | 标准 action |
| `select` | `interaction.md` | 标准 action |
| `drag` | `interaction.md` | 页面级 action |
| `upload` | `interaction.md` | 页面级 action |
| `download` | `interaction.md` | 页面级 action |
| `scroll` | `interaction.md` | 坐标/页面级 action |
| `resize` | `interaction.md` | viewport action |
| `mouse` | `interaction.md` | 坐标级 action |
| `dialog` | `interaction.md` | browser dialog recovery |
| `open` | `session.md` | navigation，不是 lifecycle |
| `locate` | `wait.md` | state target discovery |
| `get` | `wait.md` | state fact read |
| `is` | `wait.md` | state predicate |
| `verify` | `wait.md` | assertion |
| `wait` | `wait.md` | wait/assertion 前置 |
| `console` | `diagnostics.md` | live diagnostics |
| `network` | `diagnostics.md` | live diagnostics |
| `errors` | `diagnostics.md` | live diagnostics |
| `diagnostics` | `diagnostics.md` | diagnostics export/run/bundle |
| `trace` | `diagnostics.md` | trace evidence |
| `har` | `diagnostics.md` | HAR substrate |
| `video` | `diagnostics.md` | video evidence |
| `route` | `tools.md` | controlled testing/mock |
| `sse` | `tools.md` / `diagnostics.md` | query 命令在 tools，证据归 diagnostics |
| `auth` | `session-advanced.md` | auth provider |
| `state` | `session-advanced.md` | storage state |
| `storage` | `session-advanced.md` | browser storage |
| `cookies` | `session-advanced.md` | cookie 操作 |
| `session` | `session.md` | lifecycle |
| `profile` | `session-advanced.md` / `tools.md` | system Chrome profile discovery |
| `environment` | `tools.md` | controlled environment |
| `doctor` | `tools.md` | health check |
| `bootstrap` | `session-advanced.md` | context bootstrap |
| `batch` | `tools.md` | structured serial batch |
| `code` | `tools.md` | Playwright escape hatch |
| `skill` | `tools.md` | packaged skill path/install |
| `dashboard` | `tools.md` | human observation surface |

## 覆盖结论

- `node dist/cli.js --help` 中的 53 个顶层 command 均已映射到命令族 ADR。
- 命令族 ADR 记录设计原理、限制和证据状态；具体使用教程仍只维护在 `skills/pwcli/`。
- 后续新增或删除顶层 command 时，必须同步本矩阵和对应命令族文档。

## 当前注意项

- `route load` 不是当前顶层 command，也不是 `pw route --help` 中注册的子命令；它只作为旧文档残留风险在 `tools.md` 中标记，不得写成 shipped 能力。

# pwcli

`pwcli` 是一个面向内部 Agent 的 Playwright 命令壳，默认命令名是 `pw`。

当前真相很收敛：

- 默认工作流围绕一条 `default managed browser`
- session 能力下沉到 Playwright CLI `session.js + registry.js`
- 页面动作优先复用 Playwright 公共 API
- 本地项目层只保留命令语义、输出整形、auth plugin、skill 分发

## 当前命令集

```text
pw open <url>
pw connect [endpoint]
pw code [source]
pw auth [plugin]
pw batch <steps...>
pw page current|list|frames
pw snapshot
pw screenshot [ref]
pw read-text
pw fill [parts...]
pw type [parts...]
pw press <key>
pw scroll <direction> [distance]
pw upload [parts...]
pw download [ref]
pw drag [parts...]
pw console
pw network
pw click [ref]
pw wait [target]
pw trace <action>
pw state <action> [file]
pw profile inspect|open
pw session status|close
pw plugin list|path
pw skill path|install
```

## 当前推荐主链

```bash
pw open https://example.com
pw wait networkIdle
pw snapshot
pw click e6
pw read-text
```

`pw code` 是一级能力，当前既可作为页面推进入口，也可作为手工 smoke 页面注入入口。

到达真实已登录页面的顺手入口现在有三条：

```bash
pw open --profile ~/.pwcli/profiles/dc2 https://dc2.example/
pw open --state ./auth.json https://dc2.example/
pw auth dc-login --profile ~/.pwcli/profiles/dc2 --open https://dc2.example/
```

## 当前值得记住的事实

- `click` 当前支持三类目标：
  - `aria-ref`
  - `--selector`
  - semantic locator：`--role` / `--text` / `--label` / `--placeholder` / `--testid`
- `fill` 支持 ref 或 `--selector`
- `type` 支持 focused element、ref、`--selector`
- `open` 支持：
  - `--profile <path>`
  - `--state <file>`
- `connect` 当前支持：
  - 位置参数 endpoint
  - `--ws-endpoint`
  - `--browser-url`
  - `--cdp`
- `auth` 支持：
  - `pw auth example-auth`
  - `pw auth --plugin ./plugins/example-auth.js`
  - `--profile <path>` / `--state <file>`：先复用已登录上下文
  - `--open <url>`：登录完成后直接落到目标页
  - `--save-state <file>`：把本轮登录态直接固化出来
- `plugin list` 会返回 `count`
- `console` / `network` 当前返回结构化摘要，不是完整诊断系统
- `download` 支持：
  - `--path <file>`：明确文件路径
  - `--dir <dir>`：保留浏览器建议文件名

## 当前没有的东西

不要把这些当成已经存在：

- 默认 artifact run 目录
- HAR / perf / video / screencast 管理
- 项目层 session log / diagnostics cache
- 完整 request/response wait 语义
- 多 session 用户面

## 当前已知限制

- `wait --request/--response/--method/--status` 已出现在参数面，但当前实现还没接上
- `session status` 只能当 best-effort 视图
- `download` 当前人工验证是基于已存在下载元素的 managed page，不把 `file://` 打开本地下载页写成稳定 contract

## 手工验证

本轮已真实执行并通过的最小集合见：

- [.claude/project/08-manual-verification.md](./.claude/project/08-manual-verification.md)

## 文档入口

- 项目真相：[.claude/project/16-project-truth.md](./.claude/project/16-project-truth.md)
- Playwright 能力映射：[.claude/project/03-playwright-capability-mapping.md](./.claude/project/03-playwright-capability-mapping.md)
- runtime state：[.claude/project/05-runtime-state-model.md](./.claude/project/05-runtime-state-model.md)
- plugin / auth：[.claude/project/06-plugin-auth-model.md](./.claude/project/06-plugin-auth-model.md)
- artifact / diagnostics：[.claude/project/07-artifacts-diagnostics.md](./.claude/project/07-artifacts-diagnostics.md)
- borrowing rules：[.claude/project/17-borrowing-rules.md](./.claude/project/17-borrowing-rules.md)

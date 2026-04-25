# Project Truth

更新时间：2026-04-25
状态：active

## 我们现在到底在做什么

`pwcli` 当前是一个面向 Agent 的 Playwright 命令壳。

核心目标只有三件事：

1. 给 Agent 一条严格可控的浏览器生命周期主链
2. 把 Playwright 能力压成低心智 CLI 命令
3. 用最薄的项目层补上 plugin / skill / 输出整形

它当前不是：

- 通用浏览器自动化平台
- Playwright CLI 的完整替代品
- 旧 forge-browser 的 runtime 复刻

## 当前真实主链

当前最可信的工作流是：

```text
pw session create bug-123 --open <url>
pw snapshot --session bug-123
pw click / fill / type ... --session bug-123
pw read-text --session bug-123
pw session close bug-123
```

理由很简单：

- 这条链和当前源码一致
- 这条链在本轮手工 smoke 里也确实跑通
- 它不会让多个 Agent 共享一个隐式 `default`

## 当前 session 真相

- 多个 managed sessions 可以并存
- 主路径必须显式带 `--session <name>`
- CLI 不再自动挑唯一 live session
- 裸命令统一报 `SESSION_REQUIRED`

当前唯一推荐入口：

```text
pw session create <name> --open <url>
```

## 当前真实命令集

```text
session create|list|status|close
open --session
connect --session
code --session
auth --session
batch --session
page current|list|frames --session
snapshot --session
screenshot --session
read-text --session
fill --session
type --session
press --session
scroll --session
upload --session
download --session
drag --session
console --session
network --session
click --session
wait --session
trace --session
state --session
profile inspect|open
plugin list|path
skill path|install
```

这就是当前文档应该描述的面。不要扩产品面，不要再掺入旧的 `default session` 心智。

## 当前项目层真正负责什么

- 语义化 CLI 命令
- named session 路由
- 返回 JSON 结构
- AI snapshot / page summary / result summary 解析
- 本地 auth plugin 发现与执行
- packaged skill 分发
- packaged plugin 分发

## 当前项目层不负责什么

- 自建浏览器后端
- 自建 daemon 协议
- 自建页面 ref 协议
- 自建 artifact 平台
- 自建 diagnostics cache 系统
- 自建复杂 session/profile/state 绑定模型
- 自动 session fallback

## 当前对 Playwright 的依赖策略

- 页面动作与等待优先公共 API
- session 生命周期优先借 `cli-client/session.js` 和 `registry.js`
- `pw code` 是一级能力
- `pwcli` 不吞 Playwright CLI 的完整产品面

## 当前 DC 2.0 入口

当前机器上更稳的路径：

```text
pw session create dc-main --open http://127.0.0.1:4110/forge
pw session create dc-main --open http://127.0.0.1:4110/forge --profile ~/.forge-browser/profiles/acceptance-login
```

如果用户给了精确 deep link：

```text
pw session create dc-main --open 'https://developer-192-168-5-18.tap.dev/forge/89347/all-app'
```

如果需要动态登录：

```text
pw auth dc-login --session dc-main --open 'https://developer-192-168-5-18.tap.dev/forge/89347/all-app'
```

## 当前已知现实限制

- `wait` 的 request/response 参数面已露出，但当前实现还没接上
- `session status` 不是强一致 liveness truth
- `download` 的稳定验证当前建立在 managed page 内已有下载元素，不把 `file://` 打开本地下载页写成项目 truth
- 当前没有默认 artifact run 目录

## 文档口径要求

后续所有文档必须遵守：

- 只写当前命令和当前行为
- 只写已验证或已在源码中落地的 contract
- 不借旧 forge-browser 心智补空白
- 不把未来想法写成现在的 truth

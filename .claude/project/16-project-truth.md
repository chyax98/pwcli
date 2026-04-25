# Project Truth

更新时间：2026-04-25
状态：active

## 我们现在到底在做什么

`pwcli` 当前是一个面向 Agent 的 Playwright 命令壳。

核心目标只有三件事：

1. 给 Agent 一条默认可用的 managed browser 主链
2. 把 Playwright 能力压成低心智 CLI 命令
3. 用最薄的项目层补上 plugin / skill / 输出整形

它当前不是：

- 通用浏览器自动化平台
- Playwright CLI 的完整替代品
- 旧 forge-browser 的 runtime 复刻

## 当前真实主链

当前最可信的工作流是：

```text
pw open <url>
pw wait ...
pw snapshot
pw click / fill / type ...
pw read-text
```

理由很简单：

- 这条链和当前源码一致
- 这条链在本轮手工 smoke 里也确实跑通

到达真实已登录页面的当前正路有三条：

1. `pw open http://127.0.0.1:4110/forge`
2. `pw open --profile <dir> <url>`
3. `pw open --state <file> <url>`
4. `pw auth <plugin> --profile/--state ... --open <url>`

对 DC 2.0，这台机器上当前最稳的真实入口是：

```text
pw open http://127.0.0.1:4110/forge
pw open --profile ~/.forge-browser/profiles/acceptance-login http://127.0.0.1:4110/forge
```

## 当前默认浏览器真相

- 默认只有一条 `default managed session`
- session substrate 下沉到 Playwright CLI `session.js + registry.js`
- Agent 不需要先理解复杂 session 概念
- `session` 命令面只保留观察和关闭

## 当前真实命令集

```text
open
connect
code
auth
batch
page current|list|frames
snapshot
screenshot
read-text
fill
type
press
scroll
upload
download
drag
console
network
click
wait
trace
state
profile inspect|open
session status|close
plugin list|path
skill path|install
```

这就是当前文档应该描述的面。不要扩产品面，不要掺入未落地子命令。

## 当前项目层真正负责什么

- 语义化 CLI 命令
- managed session 接线
- 返回 JSON 结构
- AI snapshot / page summary / result summary 解析
- 本地 auth plugin 发现与执行
- packaged skill 分发

## 当前项目层不负责什么

- 自建浏览器后端
- 自建 daemon 协议
- 自建页面 ref 协议
- 自建 artifact 平台
- 自建 diagnostics cache 系统
- 自建复杂 session/profile/state 绑定模型

## 当前对 Playwright 的依赖策略

- 页面动作与等待优先公共 API
- session 生命周期优先借 `cli-client/session.js` 和 `registry.js`
- `pw code` 是一级能力
- `pwcli` 不吞 Playwright CLI 的完整产品面

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

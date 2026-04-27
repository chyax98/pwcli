# 诊断流程

## 输入

- 页面异常：白屏、空态异常、按钮无效、跳转错误。
- 控制台异常：warning/error。
- 接口异常：4xx/5xx、requestfailed、返回数据不对。

## 1. 快速总览

```bash
pw diagnostics digest --session <name>
```

成功判断：

- 能看到当前页 URL。
- 能看到 console/http/page error 数量。
- 有 top signals 时，先处理 top signals。

## 2. 查 console

```bash
pw console --session <name> --level error --limit 20
```

需要过滤：

```bash
pw console --session <name> --level error --text '<substring>' --limit 10
```

记录：

- 错误文本
- 触发页面
- 是否 React warning、业务 API error、资源加载失败

## 3. 查 network

先查 4xx/5xx：

```bash
pw network --session <name> --status 400 --limit 20
pw network --session <name> --status 500 --limit 20
```

查具体接口：

```bash
pw network --session <name> --url '<api path>' --limit 20
```

查单请求详情：

```bash
pw network --session <name> --request-id <id>
```

记录：

- method
- url
- status
- response msg/snippet
- 是否重复 query 参数

## 4. 查 page errors

```bash
pw errors recent --session <name> --limit 20
```

## 5. 导出证据

```bash
pw diagnostics export --session <name> --section network --text '<substring>' --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out ./diag.json
```

## 6. 回放动作 run

```bash
pw diagnostics runs --session <name> --limit 20
pw diagnostics show --run <runId> --command click --limit 10
pw diagnostics grep --run <runId> --text '<substring>' --limit 10
```

## 7. 卡住时恢复

```bash
pw doctor --session <name>
pw page dialogs --session <name>
pw dialog accept --session <name>
pw dialog dismiss --session <name>
```

恢复失败再考虑：

```bash
pw session recreate <name> --open '<url>'
```

## 输出要求

报告问题时给：

- 页面 URL
- 复现动作
- console/network 证据
- 严重级别
- 是否阻塞首屏/主流程

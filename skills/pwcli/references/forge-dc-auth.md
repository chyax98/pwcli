# Forge / DC 登录

本文件只讲 Forge/DC 登录细节。核心命令已写在 `SKILL.md`。

## 主路径

本文件只处理 Forge/DC auth 的专项细节和排障。日常判断逻辑先看主 `SKILL.md`。

`auth dc` 负责解析目标 URL、执行登录、把登录态落到当前 session，并最终导航回业务目标。

### 用户给了具体 Forge/DC URL

不要要求先 open。直接创建 session，把 URL 传给 provider：

```bash
pw session create dc2 --headed
pw auth dc --session dc2 --arg targetUrl='https://developer.xdrnd.cn/forge'
```

### 用户没给 URL

不要猜本机 IP。直接创建 session，让 provider 使用默认本地 Forge：

```bash
pw session create dc2 --headed
pw auth dc --session dc2
```

### 已有 session 当前页是 Forge/DC

直接 auth，provider 会使用当前 Forge 页面作为目标：

```bash
pw auth dc --session dc2
```

## 登录步骤

1. 确定目标来源。

优先级：

1. `--arg targetUrl=<url>`
2. 当前 session 的 Forge 页面 URL
3. 默认本地 Forge URL

默认登录失败且错误要求 `targetUrl`：让用户给 Forge 链接，再重试。

2. 确定手机号。

优先使用用户本轮给的手机号。没有则用默认测试账号：

```text
19545672859
```

3. 创建 session。

用户要求看着你点，必须有头：

```bash
pw session create dc2 --headed
```

不要求有头：

```bash
pw session create dc2
```

4. 执行内置 provider。

```bash
pw auth dc --session dc2
```

不要传 `smsCode`，默认 `000000`。

5. 登录后确认。

```bash
pw read-text --session dc2 --max-chars 1200
pw observe status --session dc2
```

成功判断：

- 不在登录页。
- 可见开发者后台、游戏、Forge 页面内容。

## 禁止

- 禁止手填登录页。
- 禁止猜 `developer-p2-*`。
- 禁止把 `dc2` 或 `dc2.0` 当 `instance=2`。
- 禁止先问“怎么登录”。
- 禁止绕开 `pw auth dc` 自己写登录表单自动化。

## 失败处理

缺手机号：

```bash
pw auth dc --session dc2 --arg phone=19545672859 --arg targetUrl='<forge-url>'
```

打开了错误域名：

```bash
pw auth dc --session dc2 --arg phone='<phone>' --arg targetUrl='<correct-forge-url>'
```

自动本地 URL 打不开：

```bash
pw auth dc --session dc2 --arg targetUrl='<user-provided-forge-url>'
```

登录后仍在登录页：

```bash
pw diagnostics digest --session dc2
pw console --session dc2 --level error --limit 20
pw network --session dc2 --url '/api/auth' --limit 20
pw network --session dc2 --status 400 --limit 20
pw network --session dc2 --status 500 --limit 20
```

如果 provider 参数不确定：

```bash
pw auth info dc
```

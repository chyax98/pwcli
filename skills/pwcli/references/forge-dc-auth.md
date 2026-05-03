# Forge / DC 登录

本文件只讲 Forge/DC auth provider 的专项使用和失败分支。通用 auth 命令边界见 `command-reference-advanced.md`。

## 1. 适用场景

看到以下目标时，优先使用内置 provider：

- Forge
- DC / DC2
- 开发者后台
- 用户给出 Forge/DC 业务 URL

不要手填登录表单，不要自己写登录页自动化，不要把 `dc2` 当 `instance` 参数。

## 2. 主决策树

### A. 用户给了具体 Forge/DC URL

直接创建 session，把目标 URL 传给 provider。不要要求先 `open`。

```bash
pw session create dc-main --headed
pw auth dc --session dc-main --arg targetUrl='<forge-url>'
pw read-text --session dc-main --max-chars 1200
pw status --session dc-main
```

### B. 已有 session 当前页就是 Forge/DC

直接执行 provider。provider 会优先使用当前 Forge/DC 页面作为目标。

```bash
pw auth dc --session <session>
pw read-text --session <session> --max-chars 1200
pw status --session <session>
```

### C. 用户没给 URL，当前页也不是 Forge/DC

不要猜环境域名或本机 IP。让 provider 使用默认目标。

```bash
pw session create dc-main --headed
pw auth dc --session dc-main
pw read-text --session dc-main --max-chars 1200
pw status --session dc-main
```

## 3. Provider 参数规则

先用 provider 自己暴露的 contract：

```bash
pw auth info dc
```

常见参数：

```bash
pw auth dc --session dc-main --arg targetUrl='<forge-url>'
pw auth dc --session dc-main --arg phone='<phone>'
pw auth dc --session dc-main --arg smsCode='<sms-code>'
pw auth dc --session dc-main --arg baseURL='<origin>'
```

规则：

- 参数只用 `--arg key=value`。
- 文档不硬编码账号、验证码或内部环境。
- 除非用户明确提供，或 `pw auth info dc` / 错误信息要求，不要猜 `phone` / `smsCode`。
- `targetUrl` 优先级高于当前页和 provider 默认目标。
- 不支持 `instance` 参数。

## 4. 目标解析优先级

`auth dc` 的目标来源按这个顺序：

1. 显式 `--arg targetUrl=<forge-url>`
2. 当前 session 的 Forge/DC 页面 URL
3. provider 默认目标

如果自动目标失败且错误要求 `targetUrl`，让用户提供 Forge/DC URL 后重试。

## 5. 成功判据

执行 provider 后必须读页面确认：

```bash
pw read-text --session dc-main --max-chars 1200
pw status --session dc-main
pw auth probe --session dc-main
```

成功通常表现为：

- 不在登录页
- 可见开发者后台 / Forge / 游戏 / 项目内容
- `auth probe` 不是明确 anonymous；如果是 `uncertain`，结合页面文本和 storage/cookie 判断

## 6. 降级逻辑

### 6.1 自动目标打不开 / 落到错误环境

让用户提供明确目标 URL，重试时传 `targetUrl`。

```bash
pw auth dc --session dc-main --arg targetUrl='<forge-url>'
```

### 6.2 缺手机号或账号参数

先看 provider contract，再按错误补参数。

```bash
pw auth info dc
pw auth dc --session dc-main --arg phone='<phone>' --arg targetUrl='<forge-url>'
```

### 6.3 缺验证码或验证码不对

不要猜验证码。只有用户给了或 provider contract 明确要求时才传。

```bash
pw auth dc --session dc-main --arg smsCode='<sms-code>' --arg targetUrl='<forge-url>'
```

### 6.4 登录后仍在登录页

先取证，不要立刻手填表单：

```bash
pw diagnostics digest --session dc-main
pw console --session dc-main --level error --limit 20
pw network --session dc-main --url '/api/auth' --limit 20
pw network --session dc-main --status 400 --limit 20
pw network --session dc-main --status 500 --limit 20
pw read-text --session dc-main --max-chars 1200
```

然后按证据决定：

- 目标 URL 错：补 `--arg targetUrl='<correct-forge-url>'`
- 账号参数缺失：补 `--arg phone='<phone>'`
- 验证码问题：要求用户提供验证码或确认 provider 默认参数
- challenge / two-factor / interstitial：交给人类，不强行自动化

### 6.5 当前 session 状态混乱

优先新建 session，而不是反复在脏 session 里重试。

```bash
pw session create dc-next --headed
pw auth dc --session dc-next --arg targetUrl='<forge-url>'
```

如需复用登录态：

```bash
pw state save ./dc-state.json --session dc-main
pw session create dc-next --state ./dc-state.json --headed --open '<forge-url>'
```

## 7. 禁止事项

- 不手填登录页。
- 不猜 Forge/DC 环境域名。
- 不猜手机号、验证码。
- 不把 `dc2` / `dc2.0` 当 `instance`。
- 不把外部临时登录脚本挂到 `pw auth`；外部脚本走 `pw code --file <path>`。
- 不让 `auth` 创建 session 或改变 headed/profile/state shape。

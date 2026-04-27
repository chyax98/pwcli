# Forge / DC 登录

本文件只讲 Forge/DC 登录细节。核心命令已写在 `SKILL.md`。

## 登录步骤

1. 确定 Forge URL。

用户给 URL，创建 session 时打开该 URL，执行 auth 时也作为 `targetUrl` 传入。

用户明确说 RND 环境：

```bash
pw session create dc2 --headed --open 'https://developer.xdrnd.cn/forge'
pw auth dc --session dc2
```

用户没给 URL 且没说 RND：不要问，直接执行默认登录命令。

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

如果用户给了 URL 或明确 RND：

```bash
pw session create dc2 --headed --open '<forge-url>'
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
pw open --session dc2 '<correct-forge-url>'
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

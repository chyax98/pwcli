# Admin V3 Auth

本文件只写 `admin-v3` provider 的使用规则。

```bash
pw auth admin-v3 --help
pw auth info admin-v3
```

## 目标 URL

```text
if 调用方已选定本轮要操作的 URL:
  pw auth admin-v3 -s <session> --arg targetUrl='<url>'
else:
  pw auth admin-v3 -s <session>
```

## 标准命令

```bash
pw session create admin-main --headed
pw auth admin-v3 -s admin-main
pw read-text -s admin-main --max-chars 1200
pw status -s admin-main
```

指定目标 URL：

```bash
pw session create admin-main --headed
pw auth admin-v3 -s admin-main --arg targetUrl='https://www.xdrnd.cn/admin-v3/app-manage/app-list'
pw read-text -s admin-main --max-chars 1200
pw status -s admin-main
```

强制重新登录（跳过自动缓存）：

```bash
pw auth admin-v3 --no-cache -s <session> --arg targetUrl='<url>'
```

## 登录机制

`admin-v3` provider 的登录链比 `dc` 更简单：

1. `accounts.xdrnd.cn/login` → phone login API（同 DC 手机号/验证码）
2. `www.xdrnd.cn/auth/login?referer=` → 自动完成 OAuth，设置 `TAPTAP_SESSION`
3. 导航到 admin-v3 目标页

不需要 intercept API、不需要 authorize 页面 evaluate、不需要 callback 处理。

## 成功判定

- 页面 URL 包含 `/admin-v3`
- 页面标题包含"管理后台"或具体业务页标题
- 不在 `/login` 页

## 禁止

- 不手填登录页。
- 不猜手机号、验证码。
- 不在 provider 文档里写环境时间线或验证历史。

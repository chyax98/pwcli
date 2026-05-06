# DC Auth

本文件只写 `dc` provider 的使用规则。命令参数以当前 CLI 为准：

```bash
pw auth dc --help
pw auth info dc
```

## 目标 URL

```text
if 调用方已选定本轮要操作的 URL:
  pw auth dc -s <session> --arg targetUrl='<url>'
else:
  pw auth dc -s <session>
```

`auth dc` 不判断环境类型，也不理解 bug 语义。上层任务流程决定是否传 `targetUrl`。

## 标准命令

```bash
pw session create dc-main --headed
pw auth dc -s dc-main
pw read-text -s dc-main --max-chars 1200
pw auth probe -s dc-main
pw status -s dc-main
```

指定目标 URL：

```bash
pw session create dc-main --headed
pw auth dc -s dc-main --arg targetUrl='<url>'
pw read-text -s dc-main --max-chars 1200
pw auth probe -s dc-main
pw status -s dc-main
```

指定 baseURL 和应用路径后缀：

```bash
pw session create dc-main --headed
pw auth dc -s dc-main --arg baseURL='<base-url>' --arg appPath=/forge
pw read-text -s dc-main --max-chars 1200
pw auth probe -s dc-main
```

`appPath` 默认是 `/forge`。后续 DCNext 如果更换路径，只覆盖 `appPath`，不要在 workflow 里写死新的登录路径。

## 成功判定

- 页面不在登录页、验证码页或 challenge。
- 能读到 DC / DC2 / DC3 / DCNext / 开发者后台 / 业务内容。
- `auth probe` 不能是明确 `anonymous`。
- `auth probe` 为 `uncertain` 时，用页面文本和 cookie/storage 信号补证。

## 禁止

- 不手填登录页。
- 不猜手机号、验证码或账号材料。
- 不把 `dc2` / `dc2.0` 当 `instance`。
- 不把用户贴出的 URL 自动解释成 RND、线上或 bug 证据。
- 不在 provider 文档里写环境时间线、验证历史或项目状态。

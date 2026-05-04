# Failure Recovery

失败后先读事实，不要盲目重试。

```bash
pw status -s <session>
pw diagnostics digest -s <session>
pw doctor -s <session>
```

命令细节查当前 CLI：

```bash
pw <command> --help
```

## 通用顺序

1. 记录失败命令和错误码。
2. 读取当前页面事实。
3. 判断是否 blocked。
4. 如果可恢复，执行最小恢复命令。
5. 恢复后重新验证原目标。
6. 需要交接时生成 `diagnostics bundle`。

## 常见情况

| 现象 | 下一步 |
|---|---|
| 找不到元素 | `read-text` -> `locate` -> `snapshot -i` |
| 动作后页面没变 | `wait` -> `status` -> `network` |
| 断言失败 | `read-text` / `get` / `page current` 后重新判断预期 |
| console error | `console --level error` + `diagnostics digest` |
| 接口失败 | `network --status 400/500` 或 `network --url <part>` |
| browser dialog 阻塞 | `doctor` 确认后 `dialog accept|dismiss` |
| 登录不确定 | `auth probe` + 页面文本 + cookie/storage 信号 |
| challenge / two-factor / CAPTCHA | 人工接管或记录 blocker，不写绕过脚本 |
| session 忙 | 等待当前命令结束；不要并发操作同一 session |
| session 状态混乱 | 优先新建 session；需要保留现场时先 bundle |

## Dialog

如果 browser dialog 阻塞：

```bash
pw doctor -s <session>
pw dialog accept -s <session>
# 或
pw dialog dismiss -s <session>
pw status -s <session>
```

不要在 dialog 阻塞时继续堆动作命令。

## Evidence Bundle

```bash
pw diagnostics bundle -s <session> --out .pwcli/bundles/<task> --task '<task>'
```

bundle 用于交接，不用于绕过阻塞。阻塞未恢复前，先处理阻塞。

## 不做的事

- 不把 limitation code 解释成已支持。
- 不自动绕过验证码、人机验证或安全挑战。
- 不为了通过验证而改写业务状态。
- 不用 `pw code` 承载长流程；长流程拆成一等命令和显式 `wait`。

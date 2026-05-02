# Gotchas

## 新任务默认新 session {#new-session}

错误：

```bash
pw session list
pw observe status --session <old>
```

把旧 session 当默认入口会污染场景，尤其是不同 URL、不同登录态、不同 mock 状态。

正确：

```bash
pw session create <name> --headed --open '<url>'
```

只有用户明确说“继续 / 接着 / 刚才那个页面”，才复用旧 session。

## Forge/DC Auth {#forge-dc-auth}

错误：

- 手填手机号/短信页。
- 自己猜登录表单 selector。
- 先问用户怎么登录。
- 猜 `<forge-env-host>`。

正确：

```bash
pw session create dc2 --headed
pw auth dc --session dc2
```

用户明确给 Forge/DC URL 时：

```bash
pw session create dc2 --headed --open '<forge-url>'
pw auth dc --session dc2
```

## dc2 是系统名 {#dc2-system-name}

错误：

- 把 `dc2` 或 `dc2.0` 当成 `instance=2`。
- 打开 `<forge-env-host>`。

正确：

- 用户给 URL：用用户 URL。
- 用户明确给环境或 URL：使用用户提供的 `<forge-url>`。
- 用户没给 URL：不要猜环境，先执行 provider 默认登录命令。
- 默认登录失败且错误要求 `targetUrl`：再要求用户给 Forge URL。

## `pw code` 不是最后手段 {#code-fast-path}

错误：

- 明明要一次读多个 DOM 状态，却连续打很多窄命令。
- 需要组合 Playwright 逻辑，却为了“用 CLI”拆成低效步骤。

正确：

```bash
pw code --session <name> "async page => JSON.stringify({
  url: page.url(),
  title: await page.title(),
  buttons: await page.locator('button').allTextContents()
})"
```

需要稳定 action 记录、diagnostics delta、标准输出时，再优先一等命令。

## 默认输出不是 JSON {#output-json}

默认 stdout 是给 Agent 读的 text。脚本、smoke、字段断言必须加：

```bash
pw --output json <command>
```

注意：

```bash
pw batch --stdin-json
```

这里的 `--stdin-json` 是 stdin steps，不是输出格式。

## snapshot 后置 {#snapshot-late}

默认先用：

```bash
pw read-text --session <name>
```

只有需要 aria ref 或结构定位时才用：

```bash
pw snapshot -i --session <name>
```

大页面顺序：

```bash
pw read-text --session <name> --selector '<main-or-panel>'
pw locate --session <name> --selector '<candidate-selector>'
pw snapshot -i --session <name>
pw snapshot -c --session <name>
```

全量 `pw snapshot --session <name>` 放最后，不默认倾倒完整页面树。

## read-text 成功优先 {#read-text-before-diagnostics}

如果目标内容已经被 `read-text` 读到，diagnostics 里的第三方 warning、favicon 404、浏览器扩展噪声、无关 requestfailed 只作为背景记录。只有页面内容缺失、动作失败、白屏、目标接口异常或 page error 影响主路径时，才把 diagnostics 当主证据。

## 不自动解 challenge {#challenge-fallback}

遇到搜索引擎 challenge、CAPTCHA、Cloudflare challenge：

- 不写自动解挑战脚本。
- 先换 direct URL、站内搜索、官方 docs、site-specific 文档页。
- 需要人类确认时打开 headed session 或 dashboard 让人接管。
- 人接管后用 `read-text` / `locate` 继续验证，不把 challenge 解决过程纳入自动化主链。

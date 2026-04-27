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
- 猜 `developer-p2-*`。

正确：

```bash
pw session create dc2 --headed
pw auth dc --session dc2
```

用户明确说 RND 时：

```bash
pw session create dc2 --headed --open 'https://developer.xdrnd.cn/forge'
pw auth dc --session dc2
```

## dc2 是系统名 {#dc2-system-name}

错误：

- 把 `dc2` 或 `dc2.0` 当成 `instance=2`。
- 打开 `developer-p2-*`。

正确：

- 用户给 URL：用用户 URL。
- 用户明确说 RND：用 `https://developer.xdrnd.cn/forge`。
- 用户没给 URL 且没说 RND：不要问，直接执行默认登录命令。
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
pw read-text --session <name> --max-chars 2000
```

只有需要 aria ref 或结构定位时才用：

```bash
pw snapshot --session <name>
```

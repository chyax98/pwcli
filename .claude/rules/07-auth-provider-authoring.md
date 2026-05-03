---
paths:
  - "src/auth/**/*.ts"
  - "src/cli/commands/auth.ts"
  - "skills/pwcli/references/command-reference-advanced.md"
  - "skills/pwcli/references/forge-dc-auth.md"
  - "codestable/architecture/domain-status.md"
---

# Auth Provider Authoring

`pwcli` 没有外部 plugin 系统。登录扩展只允许走内置 auth provider。

这份文档面向维护者。Agent 使用 auth 的说明在 `skills/pwcli/references/command-reference-advanced.md`；新增 provider 后必须同步那里。

## 1. 当前机制

provider 是一份 `AuthProviderSpec`：

```ts
export type AuthProviderSpec = {
  name: string;
  summary: string;
  description: string;
  bundledSourcePath?: string;
  source?: string;
  args: AuthProviderArgSpec[];
  examples: string[];
  notes?: string[];
  resolveArgs?: (args: Record<string, string>) => Promise<Record<string, string>>;
};
```

执行路径：

```text
pw auth <provider> --session <name> --arg key=value
  -> src/cli/commands/auth.ts
  -> parseKeyValueArgs()
  -> provider.resolveArgs(rawArgs)
  -> loadAuthProviderSource(provider)
  -> managedRunCode(page => provider(page, resolvedArgs))
  -> optional state save
  -> output provider/pageState/resolvedTargetUrl/resolvedBy
```

关键点：

- `resolveArgs` 在 Node 侧执行，适合做默认值、URL 推导、废弃参数拒绝、本机环境探测。
- `source` 在 browser page 侧通过 `managedRunCode` 执行，只能依赖 Playwright `page` 和传入的 plain args。
- `--save-state` 在 provider 成功后由 CLI 执行，不要求 provider 自己保存文件。
- 输出不会直接暴露 raw provider args，但 provider 返回的 `result` 会进入 envelope，所以 provider 自己也不能返回敏感值。

## 2. 硬边界

- provider 不创建 session。
- provider 不改变 headed/headless/profile/persistent/system Chrome profile 等 browser shape。
- provider 只在已有 session 当前 browser context 内执行。
- provider 参数只走 `--arg key=value`。
- provider 负责完成登录态写入当前 browser context，并尽量落到目标业务页。
- 用户指定目标 URL 时，provider 应优先使用这个 URL；登录完成后如 landing 不准，可再导航到目标 URL。
- 外部临时脚本走 `pw code --file <path>`，不挂到 `pw auth`。
- 不使用 `plugin` 命名，除非未来真的实现外部加载、安装、发现和生命周期。

## 3. Provider 设计顺序

1. 定义 provider 目标：它解决哪个登录态来源，不解决哪个 browser shape。
2. 明确最小参数：优先 `targetUrl`，其次才是账号、验证码、base URL 这类 provider 私有参数。
3. 写 `resolveArgs`：
   - 补默认值。
   - 拒绝废弃参数，错误信息给替代写法。
   - 从 `targetUrl` 推导 `baseURL`。
   - 必要时从本机环境推导默认 URL，但要在返回里标出 `resolvedBy`。
4. 写 provider `source`：
   - 只使用 `page`、DOM、fetch、route、goto、waitForURL 等浏览器侧能力。
   - 失败时抛带稳定前缀的错误码。
   - 成功时返回低敏 `pageState`。
5. 注册到 `AUTH_PROVIDERS`。
6. 更新 skill 和 architecture。
7. 补 smoke 或针对性回归。

## 4. 新增 provider 步骤

1. 在 `src/auth/` 新增 provider 实现。
2. 导出 `AuthProviderSpec`。
3. 在 `src/auth/registry.ts` 的 `AUTH_PROVIDERS` 中注册。
4. 给每个参数写 `args` metadata。
5. 给成功路径写 `examples` 和 `notes`。
6. 给失败路径抛稳定错误码，例如 `DC_AUTH_URL_REQUIRED`。
7. 同步文档：
   - 通用 auth 命令变化：`skills/pwcli/references/command-reference-advanced.md`
   - 特定业务 provider 行为：新增或更新对应 `skills/pwcli/references/*.md`
   - 架构边界变化：`codestable/architecture/domain-status.md`
   - 命令能力面变化：`codestable/architecture/command-surface.md`
8. 验证：
   - 开发期：`pnpm typecheck`、`pnpm build`、`pw auth list`、`pw auth info <provider>`
   - provider contract：真实或 fixture session 中执行 provider，验证 `pageState`、`resolvedTargetUrl`、`--save-state`
   - 发布前：`pnpm smoke`

## 5. Provider Source 要求

provider source 必须能被转成字符串并在 page 侧执行：

```ts
const providerSource = String(async (page, args) => {
  const targetUrl = String(args.targetUrl ?? "").trim();
  if (!targetUrl) {
    throw new Error("MY_AUTH_TARGET_URL_REQUIRED: pass --arg targetUrl=<url>");
  }

  await page.goto(targetUrl);

  return {
    ok: true,
    resolvedTargetUrl: targetUrl,
    resolvedBy: "targetUrl",
    pageState: await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
    })),
  };
});
```

返回值建议包含：

- `ok`
- `resolvedTargetUrl`
- `resolvedBy`
- `pageState.url`
- `pageState.title`
- `pageState.readyState`
- 能证明登录结果的低敏字段，例如 heading、account type、workspace id hash

禁止返回：

- token
- cookie 全量
- 短信码
- 密码
- 个人手机号、邮箱、账号名等敏感原文
- OAuth code / redirect secret

## 6. 参数与 URL 解析规范

推荐参数：

| 参数 | 用途 |
|---|---|
| `targetUrl` | 用户最终要访问的业务 URL，优先级最高 |
| `baseURL` | 只有业务确实需要单独 origin 时才暴露 |
| provider 私有参数 | 如测试账号、验证码、租户 id；必须在 `auth info` 中解释 |

解析优先级建议：

```text
targetUrl -> baseURL -> 当前页面 -> provider 默认环境
```

如果 provider 使用默认环境，必须在结果里返回 `resolvedBy`，方便 Agent 判断是否发生环境漂移。

不要新增 `instance`、`env` 这类含义模糊的参数，除非它们能稳定映射到一个明确 URL。

## 7. 错误码规范

provider 抛错建议使用稳定前缀：

```text
<PROVIDER>_AUTH_TARGET_URL_REQUIRED
<PROVIDER>_AUTH_URL_UNREACHABLE
<PROVIDER>_AUTH_LOGIN_URL_NOT_FOUND
<PROVIDER>_AUTH_CREDENTIAL_REJECTED
<PROVIDER>_AUTH_REDIRECT_MISSING
<PROVIDER>_AUTH_STATE_NOT_READY
```

错误信息要包含下一步可执行建议，例如：

```text
Pass --arg targetUrl=<url>
Run pw auth info <provider>
Create the session first with pw session create <name> --open about:blank
```

## 8. Fixture Provider

`fixture-auth` 是内部 contract 测试 provider。

用途：

- smoke 验证 `pw auth list`
- smoke 验证 `pw auth info`
- smoke 验证 provider 执行
- smoke 验证 `--save-state`

不要把 `fixture-auth` 写进用户主流程。

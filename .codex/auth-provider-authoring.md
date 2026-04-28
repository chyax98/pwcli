# Auth Provider Authoring

`pwcli` 没有外部 plugin 系统。登录扩展只允许走内置 auth provider。

## 当前机制

provider 是一份 `AuthProviderSpec`：

- metadata：`name`、`summary`、`description`、`args`、`examples`、`notes`
- source：内联 `source` 字符串，或随包分发的 `bundledSourcePath`
- optional resolver：`resolveArgs(args)`，用于补默认值、拒绝废弃参数、推导 URL

执行路径：

```text
pw auth <provider> --session <name> --arg key=value
  -> src/app/commands/auth.ts
  -> src/infra/auth-providers/registry.ts
  -> managedRunCode(page => provider(page, args))
```

## 硬边界

- provider 不创建 session。
- provider 不改变 headed/headless/profile/persistent 等 browser shape。
- provider 只在已有 session 当前 browser context 内执行。
- provider 参数只走 `--arg key=value`。
- 外部临时脚本走 `pw code --file <path>`，不挂到 `pw auth`。
- 不使用 `plugin` 命名，除非未来真的实现外部加载、安装、发现和生命周期。

## 新增 provider 步骤

1. 在 `src/infra/auth-providers/` 新增 provider 实现。
2. 导出或注册 `AuthProviderSpec`。
3. 在 `registry.ts` 的 `AUTH_PROVIDERS` 中注册。
4. 给每个参数写 `args` metadata。
5. 给失败路径抛稳定错误码，例如 `DC_AUTH_URL_REQUIRED`。
6. 跑 `pnpm typecheck && pnpm build && pnpm smoke`。
7. 同步文档：
   - 通用 auth 命令变化：`skills/pwcli/references/command-reference-advanced.md`
   - Forge/DC 行为变化：`skills/pwcli/references/forge-dc-auth.md`
   - 架构边界变化：`docs/architecture/domain-status.md`

## Provider Source 要求

provider source 必须是：

```ts
async (page, args) => {
  // use Playwright Page
  return {
    ok: true,
    pageState: {
      url: await page.url(),
    },
  };
}
```

返回值建议包含：

- `ok`
- `pageState.url`
- `pageState.title`
- 能证明登录结果的低敏字段

禁止返回：

- token
- cookie 全量
- 短信码
- 个人账号敏感信息

## Fixture Provider

`fixture-auth` 是内部 contract 测试 provider。

用途：

- smoke 验证 `pw auth list`
- smoke 验证 `pw auth info`
- smoke 验证 provider 执行
- smoke 验证 `--save-state`

不要把 `fixture-auth` 写进用户主流程。

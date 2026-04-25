# Plugin Auth Model

更新时间：2026-04-25
状态：active

当前 auth 是一层很薄的本地插件执行器，没有扩成插件平台。

## 1. 当前入口

命令面：

```bash
pw auth [plugin]
pw auth --plugin <name-or-path>
pw auth --arg key=value
pw auth --profile <path>
pw auth --state <file>
pw auth --open <url>
pw auth --save-state <file>
```

`plugin` 可以是：

- 插件名
- 显式文件路径
- 显式文件路径但省略扩展名

## 2. 插件发现规则

当前查找顺序：

1. 显式路径
2. `./plugins`
3. `./.pwcli/plugins`
4. `~/.pwcli/plugins`

当前允许后缀：

- `.js`
- `.mjs`
- `.cjs`
- `.ts`

## 3. 插件 contract

当前 contract 只有一个：

```ts
async (page, args) => { ... }
```

项目层会把插件源码包装成：

```ts
async page => {
  const plugin = (() => { return <pluginSource> })();
  return await plugin(page, args);
}
```

然后直接交给 `pw code` 执行。

这意味着当前插件只有：

- `page`
- `args`

当前没有：

- 独立 plugin runtime
- `context` / `browser` / `session` 注入 contract
- plugin hook 生命周期
- 插件级 artifact / diagnostics API

## 4. 返回结果

`auth` 当前会输出：

- `plugin`
- `pluginPath`
- `args`
- `result`
- `resultText`
- `pageState`（当插件返回 `pageState` 或 `page` 对象时）

## 5. 与 profile / state 的关系

当前 auth 的主体仍然是“执行插件”，但现在可以顺手复用已有登录上下文，或把本轮登录态固化下来。

当前支持：

- `--profile <path>`：先在 persistent profile 里启动 default managed browser
- `--state <file>`：在跑插件前先加载 storage state
- `--open <url>`：插件执行完后直接导航到目标页
- `--save-state <file>`：把 auth 后的 storage state 立即保存到文件

对 `dc-login`，`--open <url>` 现在还会默认同步成插件的 `targetUrl`。也就是：

```bash
pw auth dc-login --open 'https://developer-192-168-5-18.tap.dev/forge/89347/all-app'
```

会优先把这条 deep link 当作认证后的目标页，而不是回落到泛化的 `/forge`。

对 `dc-login`，当前要分两条路看：

- 复用型入口：优先 `pw open --profile ... http://127.0.0.1:4110/forge` 或 `pw open --state ...`
- 动态登录入口：`pw auth dc-login ...`

当前机器上，前者更稳。

当前仍然不会自动：

- 生成独立 session 名
- 建立 plugin hook 生命周期
- 把 plugin 扩成通用动作 runtime

## 6. 当前推荐用法

最小闭环：

```text
pw auth example-auth --arg url=https://example.com
pw wait ...
pw snapshot
pw click / fill / type ...
```

如果要直接到达真实已登录目标页：

```text
pw auth dc-login --profile ~/.pwcli/profiles/dc2 --open https://dc2.example/
pw snapshot
pw click / fill / type ...
```

如果要复用动态登录结果：

```text
pw auth dc-login --open https://dc2.example/ --save-state ./auth.json
pw open --state ./auth.json https://dc2.example/
```

## 7. 当前不做的事

文档不要再写这些：

- “auth 插件会自动沉淀到 state/profile”
- “插件承载通用动作执行”
- “插件承载 diagnostics 采集”
- “多插件编排和 hook 系统”

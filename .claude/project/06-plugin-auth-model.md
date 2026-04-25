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

当前 auth 只负责“执行插件”。

它不会自动：

- 保存 `storageState`
- 绑定 profile
- 生成独立 session 名

要把登录态固化下来，仍然要显式走：

- `pw state save <file>`
- `pw profile open <dir> <url>`

## 6. 当前推荐用法

最小闭环：

```text
pw auth example-auth --arg url=https://example.com
pw wait ...
pw snapshot
pw click / fill / type ...
```

如果要复用登录态，继续显式保存：

```text
pw auth ...
pw state save ./auth.json
```

## 7. 当前不做的事

文档不要再写这些：

- “auth 插件会自动沉淀到 state/profile”
- “插件承载通用动作执行”
- “插件承载 diagnostics 采集”
- “多插件编排和 hook 系统”

# Plugin Auth Model

更新时间：2026-04-25
状态：draft

目标：
- 用薄插件完成少量项目登录。
- 登录后沉淀可复用 profile/state/session。

## 当前 auth 入口模型

允许三种入口：

1. profile / state 复用
   - 直接加载已有 `storageState`
   - 或直接启动带 profile 的浏览器

2. plugin auth
   - 插件负责登录流程
   - 登录成功后把结果沉淀到 state/profile

3. auth + code 串联
   - 先完成登录
   - 再执行一串 Playwright code
   - 直接进入目标页面与目标状态

## 目标 workflow

理想流程：
- `pw auth <plugin-or-mode>`
- `pw code ...`
- `pw wait ...`
- `pw snapshot`
- `pw click/fill/type/...`
- 再进入下一轮 `wait -> snapshot -> decide -> action`

约束：
- 插件只做登录和必要 bootstrap。
- 插件不承载通用动作执行。
- 插件不承载通用诊断逻辑。
- 优先复用 `storageState` 和 profile。

## 当前项目决策

- default browser workflow 优先
- session 能力下沉
- profile/state/plugin 作为登录与复用入口
- 一次只要求稳定支持一套 default browser

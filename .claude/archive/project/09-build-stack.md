# Build Stack

更新时间：2026-04-25
状态：draft

当前决定：
- Node 24
- ESM
- TypeScript
- 宽松类型策略
- `playwright-core`
- `commander`
- `biome`

Playwright 接入策略：
- 默认直接依赖官方 `playwright-core` 包
- 精确锁版本
- 先官方包，后补丁，最后才 fork
- 没有充分理由时，不 vendoring Playwright Core

类型策略：
- `strict: false`
- `noImplicitAny: false`
- 允许 `any`
- 类型系统只守边界，不统治实现

明确不加：
- bundler
- 测试框架作为当前阶段必需项
- class-heavy 架构
- schema framework
- DI framework

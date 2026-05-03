---
paths:
  - "src/cli/**/*.ts"
  - "src/engine/**/*.ts"
  - "src/store/**/*.ts"
  - "src/auth/**/*.ts"
  - "codestable/architecture/**/*.md"
---

# Architecture Boundary Rules

## Layer Roles

`src/cli`:

- citty 命令解析和注册
- 参数定义（sharedArgs、locatorArgs）
- 输出格式化（output.ts）
- 薄的命令编排（调 engine/，不自己做 Playwright 调用）

`src/engine`:

- Playwright 运行时（session、workspace、act、observe、diagnose）
- 所有 managedRunCode / managedSessionCommand 调用
- 诊断 hooks、身份状态、环境探测

`src/store`:

- 纯文件系统 I/O（artifacts、config、health、skill）
- 无 Playwright 依赖

`src/auth`:

- 内置 auth provider 注册和实现
- 无 CLI 层依赖

## 层边界（强制）

- `engine/` 不能 import `cli/`
- `store/` 不能 import `engine/` 或 `cli/`
- `auth/` 不能 import `cli/`
- 跨层 import 必须用 `#engine/*`、`#cli/*`、`#store/*`、`#auth/*` 别名

## 浏览器事实收集

- page identity 和 navigation identity 通过共享 helper 流动
- workspace projections 是 page/frame/dialog 事实的单一来源
- diagnostics hooks 在收集事实前必须已安装
- state access preludes 共享，不复制进每个 runtime 字符串

## 空传递层禁令

不要建立只做 re-export 的中间层文件。命令直接 import engine/ 原语，不要为了架构对称加空包装。

## 文件拆分原则

按语义职责拆，不按行数拆。

好的拆分：事实 vs 查询整形 / storage vs auth-probe vs state-diff / helper type vs signal vs service

不好的拆分：每函数一文件 / 只为满足架构想象的包装层 / 为已删除 contract 留的兼容模块

## Playwright Primitive 策略

不要为了统一性重写 playwright-core 原语。用稳定的 CLI 输入/输出和恢复提示封装原语即可。复杂的单次页面脚本用 `pw code` 而不是扩大产品命令面。

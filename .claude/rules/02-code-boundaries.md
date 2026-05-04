---
paths:
  - "src/**/*.ts"
  - "test/**/*.ts"
  - "test/**/*.js"
  - "AGENTS.md"
  - "CLAUDE.md"
---

# 代码边界

## 源码职责

```text
src/cli/     命令解析、参数、输出
src/engine/  Playwright runtime、session、workspace、actions、diagnostics
src/store/   文件系统 I/O、artifacts、health、skill path
src/auth/    内置 auth provider registry 和实现
```

## Import 规则

- `engine/` 不能 import `cli/`。
- `store/` 不能 import `engine/` 或 `cli/`。
- `auth/` 不能 import `cli/`。
- 跨层 import 使用 `#engine/*`、`#cli/*`、`#store/*`、`#auth/*`。

## 实现规则

- 不新增空 re-export 层。
- 不只按行数拆文件。
- 不写逻辑向后兼容分支。
- 命令名称别名可以存在，但必须收敛到唯一实现路径。
- 不为了对称性重写 Playwright 已覆盖的 primitive。

## 测试资产规则

- 可复用产品测试放 `test/`。
- 一次性 probe、旧产品面测试、平台化 benchmark 资产不进仓库。
- `test/contract/` 只放 command/help/skill/专项能力契约检查。
- `test/smoke/` 和 `test/e2e/` 只放 runner；服务、数据和 `pw code` 片段放 `test/fixtures/`。

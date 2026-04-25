# Module Layout

更新时间：2026-04-25
状态：draft

目录意图：

```text
src/
  cli.ts
  version.ts
  commands/
  core/
  utils/
skills/
  pwcli/
.claude/project/
```

原则：
- 函数优先
- 模块优先
- 少 class
- 少 facade
- 少 wrapper
- 一个模块只做一类事情

后续应细化：
- runtime/session/profile/state/connect
- diagnostics/artifacts/search
- plugin auth
- skill distribution
- code execution

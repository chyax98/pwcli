# Command Semantics

更新时间：2026-04-25
状态：draft

## 目标

让 Agent 在猜命令时，能尽量根据语义直接猜对。

命令面要做到：
- 动词明确
- 行为可预期
- 参数位置稳定
- 同类命令风格一致

## 命名原则

### 1. 优先用直接动词

优先：
- `open`
- `code`
- `click`
- `fill`
- `type`
- `press`
- `scroll`
- `wait`
- `connect`
- `install`

避免：
- 过度抽象名词
- 行为不清楚的缩写
- 一词多义命令

### 2. 一个命令只表达一种主动作

例如：
- `open` 就是打开并导航
- `code` 就是执行 Playwright 代码
- `batch` 就是顺序执行一组命令

不要把多个主动作塞进一个命令。

### 3. 同类命令保持结构一致

例如动作类命令尽量遵守：

```bash
pw <verb> <target> [value] [options]
```

例如查询类命令尽量遵守：

```bash
pw <noun> <subcommand> [options]
```

### 4. Agent 优先猜得到

如果一个 Agent 在没有文档的情况下也大概率能猜到命令含义，这个命令就是合格的。

例如：
- `pw open https://example.com`
- `pw code "async (page) => { ... }"`
- `pw batch "open https://example.com" "code ..."`
- `pw skill install .claude/skills`

## 关键命令建议

- `open`
- `code`
- `batch`
- `session`
- `page`
- `snapshot`
- `read-text`
- `click`
- `fill`
- `type`
- `press`
- `scroll`
- `wait`
- `connect`
- `state`
- `profile`
- `auth`
- `skill`

## 为什么这样做

- Agent 更容易猜命令。
- 人更容易记忆。
- 命令帮助文档更短。
- 后续扩命令时更不容易漂。

## 目的

减少学习成本，降低错误调用概率，提高 Agent 自主执行成功率。


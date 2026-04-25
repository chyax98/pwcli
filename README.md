# pwcli

`pwcli` 是一个面向内部自用的、agent-first 的 Playwright 编排 CLI，默认命令名是 `pw`。

当前仓库已经具备 default managed browser workflow 的基础主链。

## 当前已提供

- `pw --help`
- `pw session status|close`
- `pw connect`
- `pw code`
- `pw open`
- `pw batch`
- `pw profile inspect|open`
- `pw page current|list|frames`
- `pw snapshot`
- `pw read-text`
- `pw click`
- `pw fill`
- `pw type`
- `pw press`
- `pw scroll`
- `pw wait`
- `pw state save|load`
- `pw screenshot`
- `pw trace start|stop`
- `pw upload`
- `pw drag`
- `pw download`
- `pw plugin list|path`
- `pw auth <plugin>`
- `pw skill path`
- `pw skill install <dir>`

当前主流程：
- `pw open <url>`：启动或重置 default managed browser，并导航到目标页面
- `pw snapshot`：返回 AI snapshot，直接使用 Playwright `ariaSnapshot({ mode: "ai" })`
- `pw click e6`：直接通过 `aria-ref` 目标执行动作
- `pw wait networkIdle`
- `pw read-text`
- `pw batch "snapshot" "click e6" "wait networkIdle" "read-text"`

当前命令默认复用一套 default managed session，不要求你显式先理解 session 概念。

当前重点特点：
- 默认只有一套 `default managed browser`
- session 能力下沉，Agent 不需要先理解复杂 session
- 优先复用 Playwright 公共 API 和官方 CLI session substrate
- 默认输出尽量克制，减少无意义 token 消耗

插件示例：
- `plugins/example-auth.js`
- 运行：`pw auth example-auth --arg url=https://example.com`

## 文档入口

- 项目章程：[.claude/project/00-project-charter.md](./.claude/project/00-project-charter.md)
- use case / 能力清单：[.claude/project/01-use-cases-and-capabilities.md](./.claude/project/01-use-cases-and-capabilities.md)
- 私有层审查门槛：[.claude/project/02-private-layer-review.md](./.claude/project/02-private-layer-review.md)
- Playwright 能力映射：[.claude/project/03-playwright-capability-mapping.md](./.claude/project/03-playwright-capability-mapping.md)
- 借用规则：[.claude/project/17-borrowing-rules.md](./.claude/project/17-borrowing-rules.md)
- 分层规则：[.claude/project/12-layering-rules.md](./.claude/project/12-layering-rules.md)
- Playwright Core 说明：[.claude/project/13-playwright-core-notes.md](./.claude/project/13-playwright-core-notes.md)
- 命令语义要求：[.claude/project/14-command-semantics.md](./.claude/project/14-command-semantics.md)
- batch / daemon 设计：[.claude/project/15-batch-and-daemon.md](./.claude/project/15-batch-and-daemon.md)
- 项目 Truth：[.claude/project/16-project-truth.md](./.claude/project/16-project-truth.md)
- 构建栈：[.claude/project/09-build-stack.md](./.claude/project/09-build-stack.md)
- 模块布局：[.claude/project/10-module-layout.md](./.claude/project/10-module-layout.md)

## 开发

```bash
pnpm install
pnpm build
node dist/cli.js --help
node dist/cli.js open https://example.com
node dist/cli.js snapshot
```

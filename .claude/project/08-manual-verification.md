# Manual Verification

更新时间：2026-04-25
状态：draft

当前阶段不跑自动化测试。

最小人工验证清单：
- `pnpm install`
- `pnpm build`
- `pnpm typecheck`
- `node dist/cli.js --help`
- `node dist/cli.js open https://example.com`
- `node dist/cli.js connect --help`
- `node dist/cli.js profile inspect ./plugins`
- `node dist/cli.js page current`
- `node dist/cli.js snapshot`
- `node dist/cli.js screenshot --path ./.tmp-shot.png`
- `node dist/cli.js click e6`
- `node dist/cli.js wait networkIdle`
- `node dist/cli.js read-text`
- `node dist/cli.js code "async page => { await page.goto('https://example.com'); return await page.title(); }"`
- `node dist/cli.js batch "snapshot" "click e6" "wait networkIdle" "read-text"`
- `node dist/cli.js open https://demo.playwright.dev/todomvc/`
- `node dist/cli.js fill --selector '.new-todo' 'Buy milk'`
- `node dist/cli.js type --selector '.new-todo' 'Walk dog'`
- `node dist/cli.js press Enter`
- `node dist/cli.js scroll down 200`
- `node dist/cli.js trace start`
- `node dist/cli.js trace stop`
- `node dist/cli.js state save ./.tmp-state.json`
- `node dist/cli.js state load ./.tmp-state.json`
- `node dist/cli.js auth example-auth --arg url=https://example.com`
- `node dist/cli.js plugin list`
- `node dist/cli.js plugin path example-auth`
- `node dist/cli.js session status`
- `node dist/cli.js session close`
- `node dist/cli.js skill path`
- `node dist/cli.js skill install ./.tmp-skills`
- 验证 `./.tmp-skills/pwcli` 存在且结构完整

后续每新增一级能力，都要补充对应的人肉 smoke checklist。

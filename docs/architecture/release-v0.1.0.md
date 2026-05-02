# Ship / Release Contract

更新时间：2026-05-02
状态：active

这份文档记录当前本地 ship / release gate。它不替代 `package.json`、CI 或实际命令输出。

## 1. 当前发布面

`pwcli` v0.1.0 当前承诺：

- named session lifecycle
- 页面观察、动作、等待、断言
- diagnostics / route / environment / state / auth provider
- `skills/pwcli/` 随包分发
- Agent-readable text output + `--output json` envelope

不承诺：

- 外部 auth plugin lifecycle
- raw CDP named-session substrate
- HAR 热录制稳定 contract
- Playwright Test UI / HTML report 集成
- `batch` 全命令 parity

## 2. 包状态

当前 package contract：

- package: `@chyax/pwcli`
- version: `0.1.0`
- command: `pw`
- `bin.pw`: `dist/cli.js`
- package files 必须包含：`dist`、`skills`、`README.md`
- git dependency / npm pack 都依赖 build 产物正确生成

## 3. 日常本地验证

普通代码/文档维护优先最小验证：

```bash
pnpm build
node dist/cli.js --help
```

命令面变化补：

```bash
node dist/cli.js <command> --help
```

session / auth / profile 相关变化补真实 CLI：

```bash
pw profile list-chrome
pw session create relcheck --headless --open about:blank
pw observe status -s relcheck
pw session close relcheck
```

文档-only 变化至少跑：

```bash
pnpm build
```

## 4. Release gate

正式 ship 前跑：

```bash
pnpm typecheck
pnpm build
pnpm smoke
git diff --check
npm pack --dry-run
```

高风险行为变化再补：

```bash
pnpm test:dogfood:e2e
```

高风险包括：

- session lifecycle / profile / startup lock
- auth provider
- action/ref contract
- diagnostics bundle/export/run evidence
- route/environment/bootstrap substrate
- package files / skill distribution

## 5. Ship 检查清单

- `package.json` version、name、bin、files 与发布目标一致。
- `pw --help` 和 `docs/architecture/command-surface.md` 无明显漂移。
- `skills/pwcli/SKILL.md` 能覆盖 80% 高频主链，专项路由到 reference。
- 新 limitation 已写入 `failure-recovery.md` 或 architecture docs。
- README 只保留入口，不复制完整教程。
- 没有真实账号、token、cookie、业务域名或 session state。
- GitHub release notes 只写当前已支持能力，不写 future design。

## 6. 安装验证

GitHub tag 安装：

```bash
npm install -g github:chyax98/pwcli#v0.1.0
pw --version
pw --help
pw skill path
```

npm 包安装：

```bash
npm install -g @chyax/pwcli
pw --version
pw --help
pw skill path
```

最小运行验证：

```bash
pw session create relcheck --headless --open about:blank
pw observe status -s relcheck
pw session close relcheck
```

## 7. 发布后检查

- `pw skill path` 指向包内 `skills/pwcli`。
- README 的最短链路可执行。
- smoke / dogfood 没有新增 P0/P1。
- issues / release notes 中的限制与 docs 一致。

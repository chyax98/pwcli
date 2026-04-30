# v0.1.0 Release Checklist

更新时间：2026-04-30
状态：active

这份清单用于准备 `pwcli` v0.1.0 发布。它不替代 `package.json` 和 CI 结果；发布前以实际命令输出为准。

## 1. 发布目标

v0.1.0 只承诺当前 Agent-first 主线：

- named session lifecycle
- 页面观察、动作、等待、断言
- diagnostics / route / environment / state / auth provider
- `skills/pwcli/` 随包分发

不承诺：

- 外部 plugin 加载机制
- raw CDP named-session substrate
- HAR 热录制稳定 contract
- Playwright Test UI / HTML report 集成
- `batch` 全命令 parity

## 2. 命名与分发策略

产品名继续叫 `pwcli`，命令名继续叫 `pw`。

当前 npm registry 查询结果：

- `pwcli`：未发布
- `@chyax98/pwcli`：未发布

建议：

1. 短期内部使用：优先从 GitHub 安装，降低 npm 发布和 token 管理成本。
2. 对外或跨机器稳定分发：发 scoped npm 包，例如 `@chyax98/pwcli`。
3. 不建议先抢裸包名 `pwcli` 做公开分发，除非确认要维护公共品牌和支持面。

GitHub 安装可行，但必须满足一个条件：仓库不提交 `dist/` 时，安装阶段必须能构建。当前 `prepare` 会执行 `npm run build`，用于支持 git dependency install 和 `npm pack`。

示例：

```bash
npm install -g github:chyax98/pwcli
pw --help
```

固定版本建议使用 tag：

```bash
npm install -g github:chyax98/pwcli#v0.1.0
```

如果改用 npm 发布：

```bash
npm install -g @chyax98/pwcli
```

## 3. 发布前阻断项

| 项 | 当前要求 |
|---|---|
| 版本 | `package.json` 从 `0.0.0-dev` 改为 `0.1.0` |
| npm 可发布性 | 如果发 npm，`private` 必须从 `true` 调整为可发布状态 |
| GitHub 安装 | 如果不发 npm，保留 `prepare`，确保 git dependency install 会构建 `dist` |
| 包内容 | `files` 至少包含 `dist`、`skills`、`README.md` |
| CLI 入口 | `bin.pw` 指向 `dist/cli.js` |
| Node 版本 | `engines.node` 与本机和目标环境一致 |
| 文档 | README、skill、architecture command surface 已同步 |
| 密钥 | npm token 只在发布动作前注入，不写入仓库 |

## 4. 开发期验证

开发和文档维护阶段先跑受影响验证，不默认跑全量 dogfood：

```bash
pnpm typecheck
pnpm build
node dist/cli.js --help
node dist/cli.js skill path
```

命令面有变化时补：

```bash
node dist/cli.js <command> --help
```

session / auth / profile 相关变化时补真实 CLI 验证：

```bash
pw profile list-chrome
pw session create relcheck --headless --open about:blank
pw observe status -s relcheck
pw session close relcheck
```

## 5. 发布 gate

准备正式发布前跑：

```bash
pnpm typecheck
pnpm build
pnpm smoke
git diff --check
npm pack --dry-run
```

`pnpm build` 会先清理 `dist/` 再编译，避免 npm tarball 带上历史残留的已删除命令文件。

如本轮改动涉及真实页面 workflow、auth provider、diagnostics bundle 或 action/ref contract，再补针对性真实页面验证。`pnpm test:dogfood:e2e` 只在 release gate 或高风险行为变更时跑。

## 6. GitHub 安装发布步骤

1. 更新 `package.json` 版本到 `0.1.0`。
2. 保持 `private: true` 也可以；GitHub git dependency 不依赖 npm publish。
3. 跑发布 gate。
4. 打 tag：

```bash
git tag v0.1.0
git push origin v0.1.0
```

5. 用另一处临时目录验证：

```bash
npm install -g github:chyax98/pwcli#v0.1.0
pw --version
pw --help
pw skill path
```

## 7. npm 发布步骤

1. 确认 issue / PR / review comment 没有剩余 P0/P1 阻断。
2. 更新 `package.json` 版本、包名和发布字段。
3. 跑发布 gate。
4. 注入 npm token。
5. 执行 dry run。
6. 发布 npm 包。
7. 用全局安装结果验证：

```bash
pw --version
pw --help
pw skill path
pw session create relcheck --headless --open about:blank
pw session close relcheck
```

## 8. 发布后检查

- `pw skill path` 指向包内 `skills/pwcli`。
- README 中的最短链路能直接执行。
- `docs/architecture/command-surface.md` 和 `node dist/cli.js --help` 没有明显漂移。
- GitHub release notes 只写当前已支持能力，不写 future design。

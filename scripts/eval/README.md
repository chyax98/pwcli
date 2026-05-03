# scripts/eval — pwcli 评测套件

本目录存放 pwcli 的标准化评测方案，用于 AI Agent（Codex）自动执行和人工审查。

## 目录结构

```
scripts/eval/
  EVAL_PLAN.md   # 完整评测方案（120 个用例，11 个 Domain）
  README.md      # 本文件
```

## 评测方案概览

`EVAL_PLAN.md` 包含：

- **120 个测试用例**，覆盖 11 个 Domain
- 每个用例包含：前置条件、执行命令、预期输出、通过判断、失败排查
- **快速 Smoke 集**：20 个核心用例，约 5 分钟可完成
- **Codex 执行指引**：机器可读的结果记录格式
- 附录：常见失败模式、session 清理命令、test-app 账号速查

## 运行前提

1. **构建 pwcli**：
   ```bash
   cd /Users/xd/work/tools/pwcli
   pnpm build
   ```

2. **启动 test-app**（端口 3099）：
   ```bash
   cd /Users/xd/work/tools/pwcli/scripts/test-app
   npm run dev
   ```

3. **验证 test-app 可访问**：
   ```bash
   curl http://localhost:3099
   ```

4. **设置 pw 别名**（或直接使用完整路径）：
   ```bash
   alias pw='node /Users/xd/work/tools/pwcli/dist/cli.js'
   ```

## 快速开始（Smoke 集）

参考 `EVAL_PLAN.md` 中的"快速 Smoke 集"章节，运行 20 个最核心用例：

```bash
pw session create eval-smoke-01 --open http://localhost:3099
pw observe status --session eval-smoke-01
pw read-text --session eval-smoke-01
pw snapshot -i --session eval-smoke-01
pw verify url --session eval-smoke-01 --contains 'localhost:3099'
pw session close eval-smoke-01
```

## 清理

运行完毕后清理所有 eval session：

```bash
pw session close --all
```

## 注意事项

- 所有 session 名使用 `eval-` 前缀，避免与其他 session 冲突
- HAR 热录制尚无稳定 contract，相关用例（TC-084）标记为可跳过
- MFA 用例（TC-117）依赖固定 MFA 码 `123456`，仅在 test-app 中有效
- SSE 用例（TC-111）捕获依赖 session 建立时机，首次访问可能无记录

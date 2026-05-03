# Diagnostics Domain

适用：复现问题、归因、查询 console/network/errors、导出证据和 run evidence。

精确参数见：

- `../references/command-reference-diagnostics.md`
- `../references/failure-recovery.md`
- `../workflows/diagnostics.md`

## 边界

Diagnostics domain 只处理 **发生了什么、证据在哪里、下一步怎么定位**。

拥有：

- `diagnostics digest|export|bundle|runs|show|grep|timeline`
- `console`
- `network`
- `errors recent|clear`
- `trace start|stop|inspect`
- `doctor`

不拥有：

- 页面动作本身
- mock / route 行为定义
- Playwright Test report / UI mode
- 持久化诊断数据库
- HAR 热录制稳定 contract

## 决策规则

1. 复现前先 `errors clear`，避免旧噪声污染判断。
2. 复现后先 `diagnostics digest`，再按信号展开 `console` / `network` / `errors`。
3. 有 runId 时优先用 `diagnostics show|grep --run <runId>` 定位动作证据。
4. 需要交接或留证据时用 `diagnostics bundle`。
5. 需要结构化导出时用 `diagnostics export --fields ... --out ...`。
6. trace 是离线回看工具；live 调试仍优先 `network` / `console` / `diagnostics`。

## 噪声处理

不要把所有 console/network 信号都当主因。只有影响主路径时才升级：

- 白屏 / 页面内容缺失
- 动作失败
- 目标接口 4xx/5xx 或 requestfailed
- page error
- 验证目标缺失

favicon 404、第三方 warning、浏览器扩展噪声通常只作为背景。

## 常见误用

| 误用 | 正确做法 |
|---|---|
| 失败后只看 screenshot | 先 `diagnostics digest` |
| 把 digest 当完整报告 | digest 是入口；需要导出用 export/bundle |
| 忽略 run evidence | `diagnostics runs/show/grep` 查具体动作 |
| 把 HAR 当稳定录制 | 用 network/export/bundle/trace |
| 不清 baseline 就复现 | 先 `errors clear` |

## 恢复路径

- 页面卡死或 substrate 异常：`doctor -s <name>`。
- modal 阻断：`status` → `dialog accept|dismiss`。
- diagnostics 输出过多：加 `--limit`、`--text`、`--url`、`--fields`。
- 需要人类交接：`diagnostics bundle --out <dir>`。

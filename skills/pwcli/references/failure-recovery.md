# Failure Recovery

本文是 Agent 恢复 SOP。正文说明中文优先；命令名、flag、错误码、字段名和固定输出保留英文。

## 0. 恢复总则

1. 先判断失败类型，不要马上 recreate。常见顺序是 `page current` / `status` / `diagnostics digest`，browser dialog 阻塞时先 `doctor`。
2. 能原地恢复就原地恢复：`dialog accept|dismiss`、补 `wait`、清 baseline、拆小 `pw code`，都优先于重建 session。
3. blocked 不等于 pass。`MODAL_STATE_BLOCKED`、challenge、two-factor、interstitial、`RUN_CODE_TIMEOUT` 都必须保留证据并明确下一步。
4. 交接证据用 `diagnostics bundle --out <dir> --task '<task>'`。如果 browser dialog 正在阻塞，先恢复，再 bundle；blocked 当下 bundle 也会返回 `MODAL_STATE_BLOCKED`。
5. limitation code 不包装成“已支持”。例如 `UNSUPPORTED_HAR_CAPTURE` 表示 HAR 热录制不进入 1.0 支持面；需要网络证据用 `network` / `diagnostics export|bundle` / `trace inspect`，需要 deterministic stubbing 用预录制 HAR replay。
6. 环境基线是 Node.js `>=24.12.0 <26`、pnpm 10+。Volta/proto/node 版本漂移不通过产品补丁规避。

## 快速分流

| 现象 | 首选命令 | 下一步 |
|---|---|---|
| 缺 session 或 session 丢失 | `pw session list --with-page` | 新任务创建新 session；继续任务才复用 |
| 同名命令卡住 / `SESSION_BUSY` | `pw session status <name>` | 等待后重试；不要并发同 session lifecycle |
| `RUN_CODE_TIMEOUT` | `pw page current -s <name>` + `pw status -s <name>` | 拆成一等命令 + 显式 `wait` |
| browser dialog 阻塞 | `pw doctor -s <name>` | `pw dialog accept|dismiss -s <name>`，恢复后 bundle |
| 页面内 HTML modal | `pw status -s <name>` + `pw snapshot -i -s <name>` | 找页面按钮后 `click` |
| auth 不确定 / challenge | `pw auth probe -s <name>` | human handoff 或正式 blocker，不自动绕过验证 |
| verify 失败 | `pw diagnostics bundle -s <name> --out <dir> --task '<task>'` | 用 `diagnostics show|grep --run` 找失败动作 |
| HAR 热录制 | `pw har start -s <name>` 会失败 | 改用 `network/export/bundle/trace` 或 `har replay` |

## Session 路由失败

### `SESSION_REQUIRED`

含义：

- the command needs `--session <name>`

恢复：

```bash
pw session create bug-a --open 'https://example.com'
pw snapshot --session bug-a
```

### `SESSION_NAME_INVALID`

含义：

- session name contains characters outside `[a-zA-Z0-9_-]`

恢复：

```bash
pw session create valid-name --open 'https://example.com'
```

Use only letters, digits, hyphens, and underscores. Max 16 characters.

### `SESSION_NOT_FOUND`

含义：

- the named session is missing or dead

恢复：

```bash
pw session list
pw session create bug-a --open 'https://example.com'
```

### `SESSION_BUSY`

含义：

- another command is still running on the same session
- pwcli queued for the per-session lock but timed out before dispatching to Playwright
- lifecycle startup/reset/close for the same session is still in progress
- another CLI process is already running same-name lifecycle startup/reset and still owns the startup lane for that session

恢复：

```bash
pw session status bug-a
pw wait --session bug-a --selector '<expected-ready-state>'
```

Then retry the original command. Keep dependent steps sequential, do not issue concurrent `session create|recreate|close` for the same name, or put stable same-session steps in `pw batch --session <name>`. Concurrent same-name `session create` is expected to fail fast as `SESSION_BUSY`; do not treat that as a raw Playwright startup failure.

如果上一条命令超时，底层 daemon 操作可能仍在收尾，command lock 也可能稍后才释放。先短暂等待，再重新检查 status 后重试。

### `SESSION_RECREATE_STARTUP_TIMEOUT`

含义：

- `pw session recreate` stopped the old session, but the replacement browser did not finish startup inside the guarded timeout
- common causes are profile locks, Chrome recovery prompts, or a browser process that has not fully released the previous user data dir

恢复：

```bash
pw session status bug-a
pw session list --with-page
pw session create bug-b --headed --open '<url>'
```

Do not loop `session recreate` on the same name. **禁止循环重试**：连续 recreate 同一名字会放大 profile lock 或 startup 竞争。If using `--from-system-chrome` or a persistent profile, close Chrome fully or choose another profile/session name before retrying.

如果连续失败，换 session 名创建新 session 排查：
```bash
pw session create bug-b --headed --open '<url>'
```

### `RUN_CODE_TIMEOUT`

含义：

- a run-code-backed command exceeded pwcli's 25s guard timeout
- this can happen when Playwright's daemon waits for navigation/network completion after `pw code` or a semantic command
- the browser operation may have succeeded even though the CLI timed out
- 25s 是默认保护值：覆盖 Playwright `waitForCompletion` 的 10s load timeout + 500ms 固定等待 + 余量

恢复：

```bash
pw page current --session bug-a
pw status --session bug-a
pw diagnostics digest --session bug-a
```

预期 contract：

- the timed-out CLI command returns a `RUN_CODE_TIMEOUT` envelope and exits promptly
- the managed session remains inspectable through `page current` / `status` / `diagnostics digest`
- short follow-up actions or short `pw code` snippets can continue after recovery checks

Then split the work into smaller commands. Prefer first-class `pw wait --response|--selector|network-idle` after actions instead of embedding long navigation or network waits inside `pw code`. 长流程拆成多个一等命令 + 显式 wait，避免单条 `pw code` 触发 guard timeout。If the session reports `SESSION_BUSY`, wait briefly and retry status before recreating.

### `SESSION_ATTACH_FAILED`

含义：

- the attach source is missing, invalid, or not connectable
- or `--attachable-id` does not point to a live browser server in the current workspace

恢复：

```bash
pw session list --attachable
pw session attach bug-a --attachable-id <id>
```

如果 attachable entry 没有可用 endpoint，改用显式 attach source，例如 `--ws-endpoint`、`--browser-url` 或 `--cdp`。

## 身份与状态恢复

### `auth probe` 返回 `status=uncertain`

含义：

- the session does not look safely authenticated
- but pwcli also cannot prove it is fully anonymous
- common cases are challenge pages, two-factor steps, stale storage, or UI that lacks strong identity markers

恢复：

```bash
pw page current --session bug-a
pw auth probe --session bug-a --url 'https://example.com/protected'
pw read-text --session bug-a
pw storage local --session bug-a
pw cookies list --session bug-a
```

如果 `blockedState=challenge|two_factor|interstitial`，这是 human handoff 点，不要强行继续自动登录循环。

### `STORAGE_ORIGIN_UNAVAILABLE`

含义：

- a storage or auth-state probe ran on a page without a stable origin
- common cases are `about:blank`, `data:`, or other `origin === "null"` pages
- auth probe and state diff operations require a real https/http origin

恢复：

```bash
pw open --session bug-a 'https://example.com/app'
pw status --session bug-a
```

Navigate to a page with a stable origin before re-running the storage or auth operation.

### `INDEXEDDB_ORIGIN_UNAVAILABLE`

含义：

- `pw storage indexeddb export` was run on a page without a stable origin
- common cases are `about:blank`, `data:`, or other `origin === "null"` pages

恢复：

```bash
pw open --session bug-a 'https://example.com/app'
pw storage indexeddb export --session bug-a
```

### `INDEXEDDB_UNSUPPORTED`

含义：

- the current browser/page context does not expose IndexedDB enumeration needed for export
- or the page environment blocks the required probe

恢复：

```bash
pw page current --session bug-a
pw storage local --session bug-a
pw storage indexeddb export --session bug-a --database '<expected-db>'
```

如果目标站点确实把状态放在 cookies/localStorage/sessionStorage 之外，且 IndexedDB export 不可用，回退到 page/runtime/network 证据，不要自动判定 auth 失败。

### `STATE_DIFF_BEFORE_REQUIRED`

含义：

- `pw state diff` was called without a baseline file

恢复：

```bash
pw state diff --session bug-a --before .pwcli/state/bug-a-before.json
```

Run it once to capture a baseline, then rerun it after the workflow mutates browser state.

### `STATE_DIFF_AFTER_REQUIRED`

含义：

- `pw state diff` was called without a session and without an `--after` snapshot file

恢复：

```bash
pw state diff --before before.json --after after.json
```

Or add `--session <name>` so pwcli can capture the current after snapshot read-only.

### `STATE_DIFF_SNAPSHOT_INVALID`

含义：

- the baseline or after snapshot file is missing, malformed, or not produced by `pw state diff`

恢复：

```bash
pw state diff --session bug-a --before before.json
pw state diff --session bug-a --before before.json --after after.json
```

Recreate the snapshot files with `pw state diff` and compare again. Do not point the command at arbitrary JSON files.

## System Chrome profile 失败

### `CHROME_PROFILE_NOT_FOUND`

含义：

- `pw session create --from-system-chrome` could not find the requested Chrome profile directory or display name
- or no local Chrome user data dir was discovered

恢复：

```bash
pw profile list-chrome
pw session create bug-a --from-system-chrome --chrome-profile Default --headed --open '<url>'
```

如果 Chrome 报 profile 正在使用，完全关闭 Chrome 或换一个 profile。本路径只是把用户 Chrome profile 作为 session 启动状态来源，不是 auth provider。

## Dashboard 启动失败

### `DASHBOARD_UNAVAILABLE`

含义：

- the installed `playwright-core` package does not expose the bundled dashboard entrypoint expected by `pw dashboard open`

恢复：

```bash
pnpm install
pw dashboard open --dry-run
pw session list --with-page
```

### `DASHBOARD_LAUNCH_FAILED`

含义：

- `pw dashboard open` found the bundled Playwright entrypoint, but the dashboard subprocess failed during startup
- the command has not successfully launched a dashboard process

恢复：

```bash
pw dashboard open --dry-run
pw session list --with-page
```

Use `session list --with-page` as the CLI-only fallback. Do not treat `DASHBOARD_LAUNCH_FAILED` as a launched dashboard.

## Modal 阻断

### `PAGE_ASSESS_FAILED`

含义：

- `pw page assess` could not produce a stable compact summary
- common causes are unreadable current page state, transient runtime failure, or heavy page churn between reads

恢复：

```bash
pw page current --session bug-a
pw read-text --session bug-a
pw snapshot -i --session bug-a
```

如果页面明显存在但 compact assessment 仍无帮助，把它归为 `PERCEPTION_FAILED` 类问题，继续用更窄的读取命令，不要盲目重试 `page assess`。

### `REF_STALE`

含义：

- the ref came from an older snapshot
- the page navigated, re-rendered, switched tab, or otherwise changed after the ref was captured
- the ref was not produced by the latest snapshot epoch recorded for the session/page
- the current `pageId` or `navigationId` no longer matches the page state that produced the ref

恢复：

```bash
pw snapshot -i --session bug-a
pw click <fresh-ref> --session bug-a
```

Do not retry the old ref after a page transition. `ref` values are only valid for the latest snapshot epoch of the active page identity. Use a semantic locator such as `--role` or `--text` when the target must survive navigation or re-rendering.

Typical output:

```text
ERROR REF_STALE
Ref e17 is stale for the current page snapshot
Details:
{
  "reason": "navigation-changed",
  "recovery": {
    "action": "re-snapshot",
    "freshSnapshotCaptured": true,
    "freshSnapshotRefCount": 12,
    "previousEpoch": { "snapshotId": "...", "pageId": "p1", "navigationId": "nav-1" },
    "currentEpoch": { "pageId": "p1", "navigationId": "nav-2", "url": "..." },
    "nextSteps": ["pw snapshot -i --session bug-a", "重新选择 ref 后再执行 action"]
  }
}
Try:
- Fresh snapshot captured (12 refs) — run `pw snapshot -i --session bug-a` to see them
- Pick a new ref from the fresh snapshot and retry the action
```

On `REF_STALE`, a fresh interactive snapshot is automatically captured. The error includes `recovery.freshSnapshotCaptured`, `previousEpoch`, `currentEpoch`, and `nextSteps`. Use the fresh snapshot to pick a new ref. Do not retry the old ref.

### 动作目标失败

Stable codes:

| Code | Meaning | First recovery |
|---|---|---|
| `ACTION_TARGET_NOT_FOUND` | target is not present in the current page state | `pw snapshot -i --session <name>` |
| `ACTION_TARGET_AMBIGUOUS` | locator matched more than one target | use a narrower locator or `--nth` |
| `ACTION_TARGET_INDEX_OUT_OF_RANGE` | requested `--nth` is greater than match count | inspect candidates and choose a valid index |
| `ACTION_TIMEOUT_OR_NOT_ACTIONABLE` | Playwright could not act before timeout or target was not actionable | `pw wait --session <name> --selector <selector>` then retry |

Modal and browser-dialog blockage is currently reported through `MODAL_STATE_BLOCKED`, not a separate action target code.

These codes do not auto-heal selectors and do not pick among candidates. They tell the Agent which next command to run.

Failed `click` / `wait` attempts are recorded as run events. After a failed action or wait, use the run id from the error details when present, or list recent runs:

```bash
pw diagnostics timeline --session bug-a --limit 50
pw diagnostics runs --session bug-a --limit 5
pw diagnostics digest --run '<runId>'
pw diagnostics show --run '<runId>' --limit 20
```

### 动作触发 browser dialog 后 pending

含义：

- a click fired successfully and triggered a browser `alert` / `confirm` / `prompt`
- the session is now blocked by a modal dialog
- the result is not the same as "action target not found" or "click did not happen"

Typical successful action output includes:

```text
click acted=true modalPending=true
blockedState=MODAL_STATE_BLOCKED
```

恢复：

```bash
pw dialog accept --session bug-a
# or
pw dialog dismiss --session bug-a
```

Then continue with the next assertion or wait. Do not retry the original click unless the dialog was dismissed and the business flow explicitly requires another click.

For evidence handoff, confirm the blocked state before recovery and bundle only after recovery:

```bash
pw doctor --session bug-a
pw dialog dismiss --session bug-a
pw diagnostics bundle --session bug-a --out .pwcli/bundles/dialog-recovered --limit 20
```

`diagnostics bundle` cannot bypass a pending browser dialog. If run while blocked, it returns `MODAL_STATE_BLOCKED`.

### `STATE_TARGET_NOT_FOUND`

含义：

- `pw get text|value` matched zero elements
- the command did not choose a fallback target

恢复：

```bash
pw locate --session bug-a --selector '<selector>'
pw get count --session bug-a --selector '<selector>'
pw snapshot -i --session bug-a
```

`locate` and `get count` are the low-noise checks when zero matches is acceptable. Use `snapshot -i` only when you need fresh refs or structural context.

### `READ_TEXT_SELECTOR_NOT_FOUND`

含义：

- `pw read-text --selector '<sel>'` matched zero elements
- the selector does not exist in the current page DOM

恢复：

```bash
pw locate --session bug-a --selector '<selector>'
pw snapshot -i --session bug-a
pw read-text --session bug-a
```

Use `locate` to inspect what the selector matches. Use `snapshot -i` to see available elements. Use `read-text` without `--selector` to read the full page.

### `VERIFY_FAILED`

含义：

- `pw verify` ran a read-only assertion and the assertion did not pass
- the command did not mutate page state
- `error.details` includes `assertion`, `passed: false`, `actual`, `expected`, and `target` / `count` when relevant

Recovery depends on the assertion:

```bash
pw read-text --session bug-a --max-chars 4000
pw locate --session bug-a --text '<expected text>'
pw snapshot -i --session bug-a
pw page current --session bug-a
```

如果动作后出现 `VERIFY_FAILED`，且页面状态不符合预期，收集 compact handoff bundle：

```bash
pw diagnostics bundle --session bug-a --out .pwcli/bundles/verify-failure --limit 20
```

The bundle should identify the latest failed assertion as `failedCommand=verify` and `failureKind=VERIFY_FAILED`; if it does not, treat that as an evidence-chain bug, not as a successful handoff.

Do not treat `VERIFY_FAILED` as an action failure. It means the check completed and the observed state did not match the expectation.

## 内容与 challenge 恢复

### 内容可读但 diagnostics 有噪声

含义：

- `pw read-text` or `pw locate` confirms the target content/state
- diagnostics contains unrelated console/network noise

恢复：

1. Treat the content read as primary evidence.
2. Keep unrelated diagnostics as background only.
3. Escalate diagnostics only when it explains missing content, failed action, blank page, target API failure, or page error on the target flow.

### Search challenge / CAPTCHA / bot challenge

含义：

- the page is a search challenge, CAPTCHA, Cloudflare challenge, or equivalent human verification screen
- the CLI should not attempt to solve or bypass it automatically

恢复：

```bash
pw open --session bug-a '<direct-url-or-docs-url>'
pw read-text --session bug-a
```

如果必须由人类清理 challenge：

```bash
pw dashboard open
pw session list --with-page
```

After human takeover, continue with `read-text`, `locate`, or `snapshot -i`. Do not encode challenge-solving steps as the automated recovery path.

### `MODAL_STATE_BLOCKED`

含义：

- current managed session is blocked by a modal dialog
- run-code-backed reads and some actions are unavailable
- affected reads include `page assess`, `status`, and `pw code`
- `diagnostics bundle` is also unavailable while the browser dialog is still pending

Recovery order（dialog accept/dismiss 置顶）：

1. **首选直接处理 dialog：**

```bash
pw dialog accept --session bug-a
# 或
pw dialog dismiss --session bug-a
```

2. Re-run the read command
3. If still blocked:

```bash
pw doctor --session bug-a
pw session recreate bug-a --open '<url from status>'
```

Use `pw doctor --session bug-a --verbose` only when the compact recovery summary is insufficient.

4. If recreate lands on a login page or drops auth state:

```bash
pw state load ./auth.json --session bug-a
pw open --session bug-a 'https://example.com/deep/path'
```

Do not keep stacking commands on a blocked session. `dialog accept|dismiss` 是最高优先级恢复路径，不要跳过 dialog 处理直接 recreate。

如果本次任务需要交接证据，使用这个顺序：

```bash
pw doctor --session bug-a
pw dialog dismiss --session bug-a
pw page current --session bug-a
pw diagnostics bundle --session bug-a --out .pwcli/bundles/dialog-recovered --limit 20
```

blocked 当下不要运行 bundle 期待生成完整证据包；这会得到 `MODAL_STATE_BLOCKED`，正确证据是在恢复后由 bundle 读取刚才失败的 run signal。

## 上传验证

`pw upload` waits best-effort for the input file list and `change` / `input` signal before returning. Some apps accept files asynchronously through validation, hashing, or upload APIs, so a successful `uploaded=true` only means the browser input was set.

如果输出包含 `Next steps` 或 JSON `data.nextSteps`，继续做应用层检查：

```bash
pw wait --session bug-a --selector '<uploaded-state-selector>'
pw verify text --session bug-a --text '上传成功'
pw get text --session bug-a --selector '<file-name-row>'
```

如果检查失败，先等页面到预期 ready state，再重试 `pw upload`。

## 内容限制

### Iframe 内容限制

- `read-text` 使用 `body.innerText`，无法读取 iframe 内容（返回空）
- `fill`/`click` 可以通过 ref 操作 iframe 内元素（ref 格式为 `f1e4`，其中 `f1` 是 frame index）
- `--selector` 无法直接定位 iframe 内元素

恢复：

1. 用 `pw snapshot -i` 获取 iframe 内元素的 ref（格式如 `f1e4`）
2. 用 ref 执行 `fill`/`click` 操作
3. 读取 iframe 内容用 `pw code`：
   ```javascript
   const frame = page.frameLocator('#iframeResult');
   const text = await frame.locator('body').innerText();
   console.log(text);
   ```

遇到 `read-text` 返回空且页面包含 iframe 时，CLI 会提示 iframe 数量并建议使用 `pw snapshot -i` 或 `pw code` + `frameLocator()`。

### Modal/overlay 阻断交互

When `status` shows `modalCount > 0` or `snapshot status` shows `blockingModals`, HTML modals are intercepting pointer events.
`doctor --session <name>` also reports `html-modal` in compact output when visible HTML modals/overlays are present.

恢复：

1. Check `pw status --session <name>` for modal details.
2. If doctor reports `html-modal`, use `pw snapshot -i --session <name>` or `pw locate` to find the page-level close/cancel/confirm target.
3. Dismiss with `pw click --session <name> --selector '.modal.show .btn-close'` or the modal's dismiss button.
4. If the modal has an accept/save action, use the appropriate button selector.
5. Do not use `--text` for dismiss buttons when multiple elements share the same text (e.g., "Close" appears in both modal and sidebar).

Do not use `pw dialog accept|dismiss` for HTML modals. `dialog` only handles browser `alert` / `confirm` / `prompt`.

## Environment 限制

### `ENVIRONMENT_LIMITATION`

含义：

- the current managed run-code lane did not complete the mutation in time

Typical case:

- a managed environment mutation timed out on the run-code lane

恢复：

1. Retry on a fresh session with less page activity
2. If it fails again, treat that specific mutation as unsupported on the current substrate
3. Do not promise support unless you have direct evidence on the current substrate

### `CLOCK_REQUIRES_INSTALL`

含义：

- `clock set` or `clock resume` ran before `clock install`

恢复：

```bash
pw environment clock install --session env-a
pw environment clock set --session env-a 2026-01-01T00:00:00Z
```

## Bootstrap 失败

### `BOOTSTRAP_REAPPLY_FILE_NOT_FOUND`

含义：

- `pw session recreate` 自动重新 apply bootstrap 时，持久化配置中的某个 init script 文件路径已不存在
- 常见原因：init script 被移动、删除，或路径使用了相对路径且 cwd 变化

恢复：

```bash
# 更新为正确路径
pw bootstrap apply --session <name> --init-script <new-path>
# 或移除失效条目
pw bootstrap apply --session <name> --remove-init-script <old-path>
```

然后重新运行 `pw session recreate`。

## Tab 操作限制

- `pw tab select|close` 只接受 `pageId`，不接受 index、title、URL substring
- 获取 `pageId`：
  ```bash
  pw page list --session <name>
  ```
- 然后使用列出的 `pageId` 执行 tab 操作：
  ```bash
  pw tab select <pageId> --session <name>
  pw tab close <pageId> --session <name>
  ```

### `TAB_PAGE_NOT_FOUND`

含义：

- `pageId` passed to `tab select` or `tab close` does not exist in the live browser context
- page may have been closed by the site or a previous action

恢复：

```bash
pw page list --session <name>
```

Re-fetch the current page list and use a valid `pageId`. Do not guess or cache `pageId` across actions.

### `TAB_PAGE_SELECTION_RACE`

含义：

- `tab select` resolved the target page but the page closed before `bringToFront` completed
- typically caused by a redirect or page tear-down racing with the select

恢复：

```bash
pw page list --session <name>
pw status --session <name>
```

Re-fetch current pages, verify which page is active now, and retry or reopen the target URL if needed.

## Route / mock 失败

### `ROUTE_ADD_FAILED`

Common causes:

- invalid pattern
- invalid body/headers file
- unsupported option mix

恢复：

1. Use `route list` to inspect current state
2. If a file-based option is involved, validate the referenced JSON/text file contents
3. Retry with the smallest possible `route add`; current shipped route 子命令只有 `add|remove|list`

## Diagnostics export / run replay 失败

### `DIAGNOSTICS_EXPORT_FAILED`

恢复：

1. Verify the session exists
2. Re-run `status`
3. Re-run export with a writable `--out` path

### `DIAGNOSTICS_SHOW_FAILED` / `DIAGNOSTICS_GREP_FAILED`

恢复：

```bash
pw diagnostics runs
```

Then re-run with a valid `runId`.

### `DIAGNOSTICS_BUNDLE_FAILED`

恢复：

1. Verify session exists and is attachable (`pw session status <name>`).
2. Retry with writable output directory (`pw diagnostics bundle --session <name> --out ./bundle`).
3. If limit is passed, ensure `--limit` is a positive integer.

如果命令返回 `MODAL_STATE_BLOCKED`，这不是输出目录失败。先清理 browser dialog，再重新运行 bundle：

```bash
pw doctor --session <name>
pw dialog dismiss --session <name>
pw diagnostics bundle --session <name> --out ./bundle
```

## Trace inspect 失败

### `TRACE_FILE_NOT_FOUND`

恢复：

1. Pass an existing trace zip path.
2. Check `.pwcli/playwright/` for Playwright substrate artifacts from a new or recreated session.

### `TRACE_CLI_UNAVAILABLE`

恢复：

1. Run `pnpm install`.
2. Verify `node_modules/playwright-core/cli.js` exists.
3. Re-run `pw trace inspect <trace.zip> --section actions`.

### `TRACE_CLI_FAILED`

恢复：

1. Verify the file is a Playwright trace zip.
2. Re-run with a narrower section, for example `--section actions`.
3. If Playwright trace CLI output is too large, use the bounded pwcli output as the first triage layer and open Trace Viewer for human replay.

### `TRACE_SECTION_REQUIRED` / `TRACE_SECTION_INVALID`

恢复：

```bash
pw trace inspect <trace.zip> --section actions
pw trace inspect <trace.zip> --section requests --failed
pw trace inspect <trace.zip> --section console --level error
pw trace inspect <trace.zip> --section errors
```

### `UNSUPPORTED_HAR_CAPTURE`

含义：

`pw har start|stop` is not a 1.0 recording path. Playwright HAR capture must be configured when the BrowserContext is created; pwcli does not retrofit HAR recording onto an already-open managed session.

恢复：

1. Use `pw network --session <name>` and `pw diagnostics export|bundle` for network evidence.
2. Use `pw trace start|stop|inspect` when you need replayable browser evidence.
3. Use `pw har replay <file> --session <name>` with a pre-recorded HAR for deterministic network stubbing.
4. Stop replay with `pw har replay-stop --session <name>`.

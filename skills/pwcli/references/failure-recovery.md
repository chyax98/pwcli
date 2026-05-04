# Failure Recovery

## Session routing failures

### `SESSION_REQUIRED`

Meaning:

- the command needs `--session <name>`

Recovery:

```bash
pw session create bug-a --open 'https://example.com'
pw snapshot --session bug-a
```

### `SESSION_NAME_INVALID`

Meaning:

- session name contains characters outside `[a-zA-Z0-9_-]`

Recovery:

```bash
pw session create valid-name --open 'https://example.com'
```

Use only letters, digits, hyphens, and underscores. Max 16 characters.

### `SESSION_NOT_FOUND`

Meaning:

- the named session is missing or dead

Recovery:

```bash
pw session list
pw session create bug-a --open 'https://example.com'
```

### `SESSION_BUSY`

Meaning:

- another command is still running on the same session
- pwcli queued for the per-session lock but timed out before dispatching to Playwright
- lifecycle startup/reset/close for the same session is still in progress
- another CLI process is already running same-name lifecycle startup/reset and still owns the startup lane for that session

Recovery:

```bash
pw session status bug-a
pw wait --session bug-a --selector '<expected-ready-state>'
```

Then retry the original command. Keep dependent steps sequential, do not issue concurrent `session create|recreate|close` for the same name, or put stable same-session steps in `pw batch --session <name>`. Concurrent same-name `session create` is expected to fail fast as `SESSION_BUSY`; do not treat that as a raw Playwright startup failure.

If a previous command timed out, the underlying daemon operation may still be winding down and the command lock may be released asynchronously. Wait briefly, then re-check status before retrying.

### `SESSION_RECREATE_STARTUP_TIMEOUT`

Meaning:

- `pw session recreate` stopped the old session, but the replacement browser did not finish startup inside the guarded timeout
- common causes are profile locks, Chrome recovery prompts, or a browser process that has not fully released the previous user data dir

Recovery:

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

Meaning:

- a run-code-backed command exceeded pwcli's 25s guard timeout
- this can happen when Playwright's daemon waits for navigation/network completion after `pw code` or a semantic command
- the browser operation may have succeeded even though the CLI timed out
- 25s 是默认保护值：覆盖 Playwright `waitForCompletion` 的 10s load timeout + 500ms 固定等待 + 余量

Recovery:

```bash
pw page current --session bug-a
pw status --session bug-a
pw diagnostics digest --session bug-a
```

Expected contract:

- the timed-out CLI command returns a `RUN_CODE_TIMEOUT` envelope and exits promptly
- the managed session remains inspectable through `page current` / `status` / `diagnostics digest`
- short follow-up actions or short `pw code` snippets can continue after recovery checks

Then split the work into smaller commands. Prefer first-class `pw wait --response|--selector|network-idle` after actions instead of embedding long navigation or network waits inside `pw code`. 长流程拆成多个一等命令 + 显式 wait，避免单条 `pw code` 触发 guard timeout。If the session reports `SESSION_BUSY`, wait briefly and retry status before recreating.

### `SESSION_ATTACH_FAILED`

Meaning:

- the attach source is missing, invalid, or not connectable
- or `--attachable-id` does not point to a live browser server in the current workspace

Recovery:

```bash
pw session list --attachable
pw session attach bug-a --attachable-id <id>
```

If the attachable entry has no usable endpoint, fall back to an explicit attach source such as `--ws-endpoint`, `--browser-url`, or `--cdp`.

## Identity-state recovery

### `auth probe` returned `status=uncertain`

Meaning:

- the session does not look safely authenticated
- but pwcli also cannot prove it is fully anonymous
- common cases are challenge pages, two-factor steps, stale storage, or UI that lacks strong identity markers

Recovery:

```bash
pw page current --session bug-a
pw auth probe --session bug-a --url 'https://example.com/protected'
pw read-text --session bug-a
pw storage local --session bug-a
pw cookies list --session bug-a
```

If `blockedState=challenge|two_factor|interstitial`, treat the result as a human handoff point instead of forcing another automated login loop.

### `STORAGE_ORIGIN_UNAVAILABLE`

Meaning:

- a storage or auth-state probe ran on a page without a stable origin
- common cases are `about:blank`, `data:`, or other `origin === "null"` pages
- auth probe and state diff operations require a real https/http origin

Recovery:

```bash
pw open --session bug-a 'https://example.com/app'
pw status --session bug-a
```

Navigate to a page with a stable origin before re-running the storage or auth operation.

### `INDEXEDDB_ORIGIN_UNAVAILABLE`

Meaning:

- `pw storage indexeddb export` was run on a page without a stable origin
- common cases are `about:blank`, `data:`, or other `origin === "null"` pages

Recovery:

```bash
pw open --session bug-a 'https://example.com/app'
pw storage indexeddb export --session bug-a
```

### `INDEXEDDB_UNSUPPORTED`

Meaning:

- the current browser/page context does not expose IndexedDB enumeration needed for export
- or the page environment blocks the required probe

Recovery:

```bash
pw page current --session bug-a
pw storage local --session bug-a
pw storage indexeddb export --session bug-a --database '<expected-db>'
```

If the target site truly stores state outside cookies/localStorage/sessionStorage but IndexedDB export is unavailable, fall back to page/runtime/network evidence instead of treating this as automatic auth failure.

### `STATE_DIFF_BEFORE_REQUIRED`

Meaning:

- `pw state diff` was called without a baseline file

Recovery:

```bash
pw state diff --session bug-a --before .pwcli/state/bug-a-before.json
```

Run it once to capture a baseline, then rerun it after the workflow mutates browser state.

### `STATE_DIFF_AFTER_REQUIRED`

Meaning:

- `pw state diff` was called without a session and without an `--after` snapshot file

Recovery:

```bash
pw state diff --before before.json --after after.json
```

Or add `--session <name>` so pwcli can capture the current after snapshot read-only.

### `STATE_DIFF_SNAPSHOT_INVALID`

Meaning:

- the baseline or after snapshot file is missing, malformed, or not produced by `pw state diff`

Recovery:

```bash
pw state diff --session bug-a --before before.json
pw state diff --session bug-a --before before.json --after after.json
```

Recreate the snapshot files with `pw state diff` and compare again. Do not point the command at arbitrary JSON files.

## System Chrome profile failures

### `CHROME_PROFILE_NOT_FOUND`

Meaning:

- `pw session create --from-system-chrome` could not find the requested Chrome profile directory or display name
- or no local Chrome user data dir was discovered

Recovery:

```bash
pw profile list-chrome
pw session create bug-a --from-system-chrome --chrome-profile Default --headed --open '<url>'
```

If Chrome reports that the profile is already in use, close Chrome fully or choose another profile. This path reuses the user's Chrome profile as session startup state; it is not an auth provider.

## Dashboard launch failures

### `DASHBOARD_UNAVAILABLE`

Meaning:

- the installed `playwright-core` package does not expose the bundled dashboard entrypoint expected by `pw dashboard open`

Recovery:

```bash
pnpm install
pw dashboard open --dry-run
pw session list --with-page
```

### `DASHBOARD_LAUNCH_FAILED`

Meaning:

- `pw dashboard open` found the bundled Playwright entrypoint, but the dashboard subprocess failed during startup
- the command has not successfully launched a dashboard process

Recovery:

```bash
pw dashboard open --dry-run
pw session list --with-page
```

Use `session list --with-page` as the CLI-only fallback. Do not treat `DASHBOARD_LAUNCH_FAILED` as a launched dashboard.

## Modal blockage

### `PAGE_ASSESS_FAILED`

Meaning:

- `pw page assess` could not produce a stable compact summary
- common causes are unreadable current page state, transient runtime failure, or heavy page churn between reads

Recovery:

```bash
pw page current --session bug-a
pw read-text --session bug-a
pw snapshot -i --session bug-a
```

If the page is clearly present but the compact assessment is still not useful, treat the situation as a `PERCEPTION_FAILED` benchmark family and continue with narrower read commands instead of retrying `page assess` blindly.

### `REF_STALE`

Meaning:

- the ref came from an older snapshot
- the page navigated, re-rendered, switched tab, or otherwise changed after the ref was captured
- the ref was not produced by the latest snapshot epoch recorded for the session/page
- the current `pageId` or `navigationId` no longer matches the page state that produced the ref

Recovery:

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

### Action target failures

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

### Dialog-triggering action pending

Meaning:

- a click fired successfully and triggered a browser `alert` / `confirm` / `prompt`
- the session is now blocked by a modal dialog
- the result is not the same as "action target not found" or "click did not happen"

Typical successful action output includes:

```text
click acted=true modalPending=true
blockedState=MODAL_STATE_BLOCKED
```

Recovery:

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

Meaning:

- `pw get text|value` matched zero elements
- the command did not choose a fallback target

Recovery:

```bash
pw locate --session bug-a --selector '<selector>'
pw get count --session bug-a --selector '<selector>'
pw snapshot -i --session bug-a
```

`locate` and `get count` are the low-noise checks when zero matches is acceptable. Use `snapshot -i` only when you need fresh refs or structural context.

### `READ_TEXT_SELECTOR_NOT_FOUND`

Meaning:

- `pw read-text --selector '<sel>'` matched zero elements
- the selector does not exist in the current page DOM

Recovery:

```bash
pw locate --session bug-a --selector '<selector>'
pw snapshot -i --session bug-a
pw read-text --session bug-a
```

Use `locate` to inspect what the selector matches. Use `snapshot -i` to see available elements. Use `read-text` without `--selector` to read the full page.

### `VERIFY_FAILED`

Meaning:

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

If `VERIFY_FAILED` follows an action and the page state is unexpectedly wrong, collect the compact handoff bundle:

```bash
pw diagnostics bundle --session bug-a --out .pwcli/bundles/verify-failure --limit 20
```

The bundle should identify the latest failed assertion as `failedCommand=verify` and `failureKind=VERIFY_FAILED`; if it does not, treat that as an evidence-chain bug, not as a successful handoff.

Do not treat `VERIFY_FAILED` as an action failure. It means the check completed and the observed state did not match the expectation.

## Content and challenge recovery

### Content readable, diagnostics noisy

Meaning:

- `pw read-text` or `pw locate` confirms the target content/state
- diagnostics contains unrelated console/network noise

Recovery:

1. Treat the content read as primary evidence.
2. Keep unrelated diagnostics as background only.
3. Escalate diagnostics only when it explains missing content, failed action, blank page, target API failure, or page error on the target flow.

### Search challenge / CAPTCHA / bot challenge

Meaning:

- the page is a search challenge, CAPTCHA, Cloudflare challenge, or equivalent human verification screen
- the CLI should not attempt to solve or bypass it automatically

Recovery:

```bash
pw open --session bug-a '<direct-url-or-docs-url>'
pw read-text --session bug-a
```

If a human must clear the challenge:

```bash
pw dashboard open
pw session list --with-page
```

After human takeover, continue with `read-text`, `locate`, or `snapshot -i`. Do not encode challenge-solving steps as the automated recovery path.

### `MODAL_STATE_BLOCKED`

Meaning:

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

## Upload verification

`pw upload` waits best-effort for the input file list and `change` / `input` signal before returning. Some apps accept files asynchronously through validation, hashing, or upload APIs, so a successful `uploaded=true` only means the browser input was set.

If output includes `Next steps` or JSON `data.nextSteps`, continue with an app-level check:

```bash
pw wait --session bug-a --selector '<uploaded-state-selector>'
pw verify text --session bug-a --text '上传成功'
pw get text --session bug-a --selector '<file-name-row>'
```

If the check fails, retry `pw upload` after the page reaches the expected ready state.

## Content limitations

### Iframe 内容限制

- `read-text` 使用 `body.innerText`，无法读取 iframe 内容（返回空）
- `fill`/`click` 可以通过 ref 操作 iframe 内元素（ref 格式为 `f1e4`，其中 `f1` 是 frame index）
- `--selector` 无法直接定位 iframe 内元素

Recovery:

1. 用 `pw snapshot -i` 获取 iframe 内元素的 ref（格式如 `f1e4`）
2. 用 ref 执行 `fill`/`click` 操作
3. 读取 iframe 内容用 `pw code`：
   ```javascript
   const frame = page.frameLocator('#iframeResult');
   const text = await frame.locator('body').innerText();
   console.log(text);
   ```

遇到 `read-text` 返回空且页面包含 iframe 时，CLI 会提示 iframe 数量并建议使用 `pw snapshot -i` 或 `pw code` + `frameLocator()`。

### Modal/overlay blocks interactions

When `status` shows `modalCount > 0` or `snapshot status` shows `blockingModals`, HTML modals are intercepting pointer events.
`doctor --session <name>` also reports `html-modal` in compact output when visible HTML modals/overlays are present.

Recovery:

1. Check `pw status --session <name>` for modal details.
2. If doctor reports `html-modal`, use `pw snapshot -i --session <name>` or `pw locate` to find the page-level close/cancel/confirm target.
3. Dismiss with `pw click --session <name> --selector '.modal.show .btn-close'` or the modal's dismiss button.
4. If the modal has an accept/save action, use the appropriate button selector.
5. Do not use `--text` for dismiss buttons when multiple elements share the same text (e.g., "Close" appears in both modal and sidebar).

Do not use `pw dialog accept|dismiss` for HTML modals. `dialog` only handles browser `alert` / `confirm` / `prompt`.

## Environment limitations

### `ENVIRONMENT_LIMITATION`

Meaning:

- the current managed run-code lane did not complete the mutation in time

Typical case:

- a managed environment mutation timed out on the run-code lane

Recovery:

1. Retry on a fresh session with less page activity
2. If it fails again, treat that specific mutation as unsupported on the current substrate
3. Do not promise support unless you have direct evidence on the current substrate

### `CLOCK_REQUIRES_INSTALL`

Meaning:

- `clock set` or `clock resume` ran before `clock install`

Recovery:

```bash
pw environment clock install --session env-a
pw environment clock set --session env-a 2026-01-01T00:00:00Z
```

## Bootstrap failures

### `BOOTSTRAP_REAPPLY_FILE_NOT_FOUND`

Meaning:

- `pw session recreate` 自动重新 apply bootstrap 时，持久化配置中的某个 init script 文件路径已不存在
- 常见原因：init script 被移动、删除，或路径使用了相对路径且 cwd 变化

Recovery:

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

Meaning:

- `pageId` passed to `tab select` or `tab close` does not exist in the live browser context
- page may have been closed by the site or a previous action

Recovery:

```bash
pw page list --session <name>
```

Re-fetch the current page list and use a valid `pageId`. Do not guess or cache `pageId` across actions.

### `TAB_PAGE_SELECTION_RACE`

Meaning:

- `tab select` resolved the target page but the page closed before `bringToFront` completed
- typically caused by a redirect or page tear-down racing with the select

Recovery:

```bash
pw page list --session <name>
pw status --session <name>
```

Re-fetch current pages, verify which page is active now, and retry or reopen the target URL if needed.

## Route / mock failures

### `ROUTE_ADD_FAILED`

Common causes:

- invalid pattern
- invalid body/headers file
- unsupported option mix

Recovery:

1. Use `route list` to inspect current state
2. If a file-based option is involved, validate the referenced JSON/text file contents
3. Retry with the smallest possible `route add`; current shipped route 子命令只有 `add|remove|list`

## Diagnostics export / run replay failures

### `DIAGNOSTICS_EXPORT_FAILED`

Recovery:

1. Verify the session exists
2. Re-run `status`
3. Re-run export with a writable `--out` path

### `DIAGNOSTICS_SHOW_FAILED` / `DIAGNOSTICS_GREP_FAILED`

Recovery:

```bash
pw diagnostics runs
```

Then re-run with a valid `runId`.

### `DIAGNOSTICS_BUNDLE_FAILED`

Recovery:

1. Verify session exists and is attachable (`pw session status <name>`).
2. Retry with writable output directory (`pw diagnostics bundle --session <name> --out ./bundle`).
3. If limit is passed, ensure `--limit` is a positive integer.

If the command returns `MODAL_STATE_BLOCKED`, it is not an output directory failure. Clear the browser dialog first, then rerun bundle:

```bash
pw doctor --session <name>
pw dialog dismiss --session <name>
pw diagnostics bundle --session <name> --out ./bundle
```

## Trace inspect failures

### `TRACE_FILE_NOT_FOUND`

Recovery:

1. Pass an existing trace zip path.
2. Check `.pwcli/playwright/` for Playwright substrate artifacts from a new or recreated session.

### `TRACE_CLI_UNAVAILABLE`

Recovery:

1. Run `pnpm install`.
2. Verify `node_modules/playwright-core/cli.js` exists.
3. Re-run `pw trace inspect <trace.zip> --section actions`.

### `TRACE_CLI_FAILED`

Recovery:

1. Verify the file is a Playwright trace zip.
2. Re-run with a narrower section, for example `--section actions`.
3. If Playwright trace CLI output is too large, use the bounded pwcli output as the first triage layer and open Trace Viewer for human replay.

### `TRACE_SECTION_REQUIRED` / `TRACE_SECTION_INVALID`

Recovery:

```bash
pw trace inspect <trace.zip> --section actions
pw trace inspect <trace.zip> --section requests --failed
pw trace inspect <trace.zip> --section console --level error
pw trace inspect <trace.zip> --section errors
```

### `UNSUPPORTED_HAR_CAPTURE`

Meaning:

`pw har start|stop` is not a 1.0 recording path. Playwright HAR capture must be configured when the BrowserContext is created; pwcli does not retrofit HAR recording onto an already-open managed session.

Recovery:

1. Use `pw network --session <name>` and `pw diagnostics export|bundle` for network evidence.
2. Use `pw trace start|stop|inspect` when you need replayable browser evidence.
3. Use `pw har replay <file> --session <name>` with a pre-recorded HAR for deterministic network stubbing.
4. Stop replay with `pw har replay-stop --session <name>`.

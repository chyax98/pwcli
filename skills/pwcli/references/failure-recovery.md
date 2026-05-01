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
Ref e17 not found in the current page snapshot
Try:
- Refresh refs with `pw snapshot -i --session bug-a`
- Retry with a fresh ref from the new snapshot
```

`REF_STALE` means the old ref is no longer a safe write target. Do not retry the same ref.

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
- affected reads include `page assess`, `observe status`, and `pw code`

Recovery order:

1. Try a direct dialog command:

```bash
pw dialog accept --session bug-a
```

or:

```bash
pw dialog dismiss --session bug-a
```

2. Re-run the read command
3. If still blocked:

```bash
pw doctor --session bug-a
pw session recreate bug-a --open '<url from observe status>'
```

Use `pw doctor --session bug-a --verbose` only when the compact recovery summary is insufficient.

4. If recreate lands on a login page or drops auth state:

```bash
pw state load ./auth.json --session bug-a
pw open --session bug-a 'https://example.com/deep/path'
```

Do not keep stacking commands on a blocked session.

## Upload verification

`pw upload` waits best-effort for the input file list and `change` / `input` signal before returning. Some apps accept files asynchronously through validation, hashing, or upload APIs, so a successful `uploaded=true` only means the browser input was set.

If output includes `Next steps` or JSON `data.nextSteps`, continue with an app-level check:

```bash
pw wait --session bug-a --selector '<uploaded-state-selector>'
pw verify text --session bug-a --text '上传成功'
pw get text --session bug-a --selector '<file-name-row>'
```

If the check fails, retry `pw upload` after the page reaches the expected ready state.

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

## Route / mock failures

### `ROUTE_ADD_FAILED`

Common causes:

- invalid pattern
- invalid body/headers file
- unsupported option mix

Recovery:

1. Use `route list` to inspect current state
2. Validate JSON file contents for `route load`
3. Retry with the smallest possible mock

## Diagnostics export / run replay failures

### `DIAGNOSTICS_EXPORT_FAILED`

Recovery:

1. Verify the session exists
2. Re-run `observe status`
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

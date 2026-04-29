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

### `MODAL_STATE_BLOCKED`

Meaning:

- current managed session is blocked by a modal dialog
- run-code-backed reads and some actions are unavailable

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

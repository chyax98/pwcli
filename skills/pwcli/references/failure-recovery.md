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

## Modal blockage

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
pw session recreate bug-a
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

- `environment clock set`

Recovery:

1. Retry on a fresh session with less page activity
2. If it fails again, treat it as unsupported on the current substrate
3. Do not promise support unless a substrate survey says otherwise

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

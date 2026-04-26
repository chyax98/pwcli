---
name: pwcli
description: Use when Codex needs to drive a browser with `pw` for bug reproduction, bug diagnosis, DOM inspection, authenticated state reuse, deterministic browser automation, request mocking, diagnostics export, or environment mutation. Use for workflows that need strict named sessions, structured JSON output, route mocking, run-scoped diagnostics, or controlled browser state such as offline, geolocation, permissions, and clock.
---

# pwcli

Use `pw`. Do not bypass the CLI and do not reconstruct browser workflows from memory.

## Core Rules

1. Start from a named session.
2. Keep one task on one session.
3. Run dependent browser steps serially.
4. Read before acting.
5. Prefer structured commands over ad hoc code.
6. Use `pw code` only when the command surface is genuinely insufficient.
7. Treat CLI output as the source of truth.
8. Stop claiming support when the CLI returns a limitation code.

## Session Discipline

- Always pass `--session <name>` for browser commands.
- Keep session names short: 16 chars max, letters/numbers/`-`/`_` only.
- Prefer:
  - `pw session create <name> --open <url>`
  - `pw session attach <name> ...`
  - `pw session recreate <name> ...`
- Treat `open` as pure navigation on an existing session.
- Treat `auth` as plugin execution only.
- Do not invent a current/default session.
- Do not refer to deleted `connect` flows.

## Choose the Right Entry

### Open a fresh investigation

Use:

```bash
pw session create bug-a --open 'https://example.com'
```

### Reuse an existing browser

Use:

```bash
pw session attach bug-a --ws-endpoint ws://127.0.0.1:9222/devtools/browser/...
```

### Reuse authenticated state

Use:

```bash
pw session create auth-a --open 'https://example.com' --state ./auth.json
```

### Run a project login plugin

Use:

```bash
pw auth dc-login --session auth-a --arg targetUrl='https://example.com'
```

Build session shape first. `auth` does not own lifecycle.

## Standard Workflow

### 1. Inspect

Run in this order:

```bash
pw snapshot --session bug-a
pw page current --session bug-a
pw read-text --session bug-a --max-chars 1200
pw observe status --session bug-a
```

Use:

- `snapshot` to discover refs
- `page current/list/frames/dialogs` to inspect workspace projection
- `read-text` for visible text
- `observe status` for compact workspace + diagnostics summary
- `observe status --verbose` only when the compact summary is insufficient

### 2. Act

Prefer explicit commands:

- `click`
- `fill`
- `type`
- `press`
- `scroll`
- `upload`
- `download`
- `drag`
- `wait`

Prefer this target order:

1. aria ref from `snapshot`
2. `--selector`
3. semantic locator flags already supported by the command

### 3. Diagnose

Use:

```bash
pw diagnostics digest --session bug-a
pw observe status --session bug-a
pw console --session bug-a ...
pw network --session bug-a ...
pw errors recent --session bug-a ...
pw doctor --session bug-a
pw diagnostics show --run <runId> --command click --limit 5
pw diagnostics export --session bug-a --out ./diag.json
pw diagnostics runs
pw diagnostics grep --run <runId> --text <substring>
```

Treat:

- `diagnostics digest` as the fastest high-signal summary
- `observe status` as the compact live-session health snapshot
- `doctor` as the compact recoverability probe
- `diagnosticsDelta` on action results as the first signal
- `console/network/errors` as live-session query tools
- `diagnostics show/grep` as run-scoped replay tools
- `--verbose` on `observe status` or `doctor` as escalation only
- `--since` on `console/network/errors/show/grep/export` when you need time-bounded triage
- `--fields` on `diagnostics show/grep/export` when another agent only needs a narrow projection
- `requestBodySnippet` / `responseBodySnippet` on `network` when a text-like body is enough to confirm the failure shape

If a session is blocked by a dialog, try:

```bash
pw dialog accept --session bug-a
```

or:

```bash
pw dialog dismiss --session bug-a
```

before falling back to `doctor -> session recreate`.

### 4. Reproduce deterministically

Use:

```bash
pw route add ...
pw route list ...
pw route load ./mock-routes.json ...
pw environment offline on ...
pw environment geolocation set ...
pw environment permissions grant ...
```

### 5. Escalate only if needed

Use `pw code` when:

- you need conditional mock logic
- you need multi-step page logic not present in commands
- you need one-off DOM/JS inspection
- you need to verify a hypothesis before proposing a new command

Do not use `pw code` for work already covered by first-class commands.

## Serial Discipline

- Inside one session, commands that depend on the previous page state must run in order.
- Do not parallelize:
  - `session create` -> `fill` / `click`
  - `click` navigation -> `read-text` / `page current`
  - `route add/load` -> target action
  - `environment` mutation -> page verification

If the next command depends on a changed page state, wait for the previous command to finish and then continue.

## Batch Rules

Use structured batch only:

```bash
printf '%s\n' '[["snapshot"],["click","e6"],["wait","networkIdle"]]' | pw batch --session bug-a --json
pw batch --session bug-a --file ./steps.json
```

Rules:

- Use `string[][]`
- Each inner array is one CLI argv shape inside the currently supported batch subset
- Reuse the same session
- Use `--continue-on-error` only when partial results are valuable

Trade-off:

- `batch` is intentionally narrower than the full CLI
- the current stable subset covers deterministic inspection / action / wait / route / bootstrap steps
- if a needed command is outside the stable subset, run it directly or use `pw code`

Reason:

- Agent stability matters more than broad but brittle parity
- batch expands only when a concrete repeated agent workflow justifies it

Do not write new string-step workflows.

## Diagnostics and Mock Decision Tree

### Need one request or class of requests

Use `network` with:

- `--request-id`
- `--url`
- `--kind`
- `--method`
- `--status`
- `--resource-type`
- `--text`
- `--limit`

### Need stable export for another agent or review

Use:

```bash
pw diagnostics export --session bug-a --out ./diag.json
```

### Need a simple mock

Use `route add`.

### Need many mocks or file-backed payloads

Use `route load <file>` and keep the file in JSON form.

### Need browser environment mutation

Use `environment`.

Do not claim `HAR` or stream-based diagnostics are the answer unless the user explicitly wants those missing capabilities explored.

## Recovery Rules

Read [references/failure-recovery.md](./references/failure-recovery.md) when:

- a command fails
- you see session routing errors
- you hit modal blockage
- you need to decide whether to recreate the session

## Workflow Playbooks

Read [references/workflows.md](./references/workflows.md) when:

- reproducing a bug
- doing deterministic automation
- reusing auth/state/profile
- using diagnostics export or run replay

## Hard Constraints

- Do not mention or use deleted compatibility commands.
- Do not assume hidden global state.
- Do not assume `page dialogs` is an authoritative live dialog set.
- Do not route lifecycle mutations through `open`, `profile`, or `auth`.
- Do not promise raw CDP substrate support beyond current `session attach` behavior.
- Do not promise `environment clock set` on the current substrate; treat limitation codes as final unless the user explicitly asks for a deeper substrate survey.
- Do not write future product ideas as if they already ship.

## Quick Reference

- Current command details: [references/command-reference.md](./references/command-reference.md)
- Real workflow patterns: [references/workflows.md](./references/workflows.md)
- Failure handling and recovery: [references/failure-recovery.md](./references/failure-recovery.md)
- Local hard rules: [rules/core-usage.md](./rules/core-usage.md)

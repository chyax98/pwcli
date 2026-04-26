# Workflows

## 1. Reproduce a bug on a fresh page

```bash
pw session create bug-a --open 'https://example.com'
pw snapshot --session bug-a
pw page current --session bug-a
pw click e6 --session bug-a
pw wait networkIdle --session bug-a
pw diagnostics digest --session bug-a
pw console --session bug-a --level warning --limit 20
pw network --session bug-a --kind response --limit 20
pw errors recent --session bug-a --limit 20
pw diagnostics show --run <runId> --command click --since 2026-04-26T00:00:00.000Z --fields at=ts,cmd=command,net=diagnosticsDelta.networkDelta
pw diagnostics export --session bug-a --section network --text checkout --fields at=timestamp,method,url,status,snippet=responseBodySnippet --out ./diag.json
pw diagnostics runs --session bug-a --since 2026-04-26T00:00:00.000Z
```

Use this when you need:

- DOM truth
- immediate diagnostics
- a stable export artifact

## 2. Reproduce with deterministic mocks

```bash
pw session create mock-a --open 'http://127.0.0.1:4179/blank'
pw route load ./scripts/manual/mock-routes.json --session mock-a
pw route list --session mock-a
pw click --selector '#route-only' --session mock-a
pw read-text --session mock-a --selector '#last-route-result'
```

Use this when:

- backend responses are unstable
- you need exact status/body control
- you need repeatable smoke or diagnosis

## 3. Reuse auth state

```bash
pw session create auth-a --open 'https://example.com'
pw auth dc-login --session auth-a --arg targetUrl='https://example.com' --save-state ./auth.json
pw session close auth-a
pw session create auth-b --open 'https://example.com' --state ./auth.json
```

Use this when:

- login is expensive
- you need deterministic follow-up investigation

## 4. Use environment control

```bash
pw session create env-a --open 'http://127.0.0.1:4179/blank'
pw environment offline on --session env-a
pw environment permissions grant geolocation --session env-a
pw environment geolocation set --session env-a --lat 37.7749 --lng -122.4194
```

Use this when reproducing:

- offline-only failures
- geolocation-dependent behavior
- permission-gated UI

## 5. Use structured batch

Stdin mode:

```bash
printf '%s\n' '[
  ["snapshot"],
  ["click", "e6"],
  ["wait", "networkIdle"],
  ["observe", "status"]
]' | pw batch --session bug-a --json
```

File mode:

```bash
pw batch --session bug-a --file ./steps.json
```

Use this when:

- one agent turn needs one browser turn
- the sequence is deterministic
- you want one structured result envelope

Keep batch narrow:

- use the documented stable subset first
- for one-off commands outside that subset, run normal `pw` commands
- for conditional logic, use `pw code`

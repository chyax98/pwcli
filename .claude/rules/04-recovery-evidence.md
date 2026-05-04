---
paths:
  - "src/engine/**/*.ts"
  - "src/engine/diagnose/**/*.ts"
  - "src/engine/act/**/*.ts"
  - "src/cli/commands/**/*.ts"
  - "skills/pwcli/references/failure-recovery.md"
  - "skills/pwcli/references/workflows.md"
  - "codestable/architecture/domain-status.md"
---

# Recovery And Evidence Rules

## Failure Philosophy

When a browser task fails, `pwcli` should help the agent recover with facts, not
guess a semantic fix.

Good recovery:

- stable reason code
- current page/session facts
- run id or artifact path
- diagnostics delta
- screenshot/trace/network evidence when available
- concrete next commands

Bad recovery:

- silently retrying destructive actions
- choosing a different element after a stale ref
- hiding substrate limitations
- returning a generic command failure without next steps

## REF_STALE Policy

Snapshot refs are not stable across page changes. If a ref is stale:

1. fail with `REF_STALE`
2. explain whether the snapshot is missing, ref is missing, page changed, or
   navigation changed
3. provide the current page identity when available
4. suggest fresh `snapshot -i` or scoped read commands

Do not automatically re-resolve an old ref to a new element and perform a write
action. A similar-looking element can be semantically different.

If a future stale recovery helper is added, it should gather fresh evidence and
return it to the agent. It should not auto-click, auto-fill, or auto-submit.

## Diagnostics Evidence

Diagnostics should connect:

- failed command
- run id
- console/pageerror/network changes
- trace/har artifacts when active
- failure screenshot path when implemented

`diagnostics bundle` should prioritize recent failed runs over background page
noise. Third-party warnings, favicon failures, aborted media, and extension noise
should not dominate successful content-reading tasks.

## Screenshot On Failure Direction

If failure screenshots are implemented:

- store files under the existing artifact/run root
- return file paths, not base64 blobs
- attach paths to the failure run or diagnostics signal
- keep original failure codes intact
- do not make screenshots a replacement for trace or diagnostics

## Limitation Honesty

Limitation code must not be described as support. If the runtime cannot handle
a browser state, output and skills must say what is unsupported and what the
agent should do next.

# Verification And Review Rules

## Daily Verification

Use the smallest verification that covers the changed risk.

Common commands:

```bash
pnpm build
pnpm typecheck
pw <affected-command> --help
pw <affected-command> ...
```

Do not default to full smoke for every small change. Run full smoke when:

- release/merge readiness is being claimed
- lifecycle/session wiring changed
- batch or command registration changed broadly
- the user explicitly asks
- a focused check cannot cover the risk

## Review Priority

Only escalate verifiable P0/P1 findings.

Always check:

1. workspace mutation contract
2. session lifecycle/open/auth/batch boundaries
3. command, flag, output, and error-code drift
4. skill and architecture sync
5. recoverability and limitation honesty
6. verification coverage for changed behavior

Do not report style-only or wording-only issues as blockers unless they change
active contract or mislead future agents.

## Documentation Review

Docs are blocking only when they:

- mention a command or flag that no longer exists
- describe future work as shipped behavior
- hide a limitation
- create a second usage tutorial outside `skills/pwcli/`
- contradict source behavior

## Git Hygiene

The worktree may contain user changes. Never revert unrelated files. Before
editing a file with existing changes, read the diff and work with it.

Do not use destructive git commands unless the user explicitly asks.

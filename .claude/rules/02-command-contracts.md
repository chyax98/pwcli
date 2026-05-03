---
paths:
  - "src/cli/**/*.ts"
  - "src/engine/**/*.ts"
  - "skills/pwcli/**/*.md"
  - "codestable/architecture/command-surface.md"
  - "codestable/architecture/domain-status.md"
---

# Command Contract Rules

## Command Ownership

Commands live in `src/cli/commands/*`. Runtime behavior lives under
`src/engine/*`. Engine is the only layer that touches Playwright; cli/ is thin
parsing + output only.

## Lifecycle Boundary

- `session create|attach|recreate` is the only lifecycle main path.
- `open` only navigates an existing session.
- `auth` only runs built-in auth providers.
- `batch` only accepts structured `string[][]`; it is not full CLI parity.

## Flag And Alias Policy

Avoid compatibility aliases by default. Add an alias only when all are true:

1. Real agent usage repeatedly guesses that name.
2. The alias is small and does not fork logic.
3. Skill docs document the canonical form first.
4. Tests or focused verification cover both canonical and alias input.

If a flag is removed or renamed, remove it everywhere:

- command help
- batch parser
- `skills/pwcli/SKILL.md`
- command references
- domain guides
- workflows
- failure recovery suggestions
- architecture docs if the domain boundary changed

## Read-Text Current Contract

Current direction:

- `pw read-text` should be useful on first call.
- Default max chars should be large enough for real pages.
- Overlay/modal/dropdown/popover text should be included by default.
- `--no-include-overlay` is the opt-out form.

Do not document removed forms such as `--include-overlay` after the command no
longer accepts them.

## Output Contract

Agent-readable output must stay compact but actionable.

Action and failure outputs should preserve:

- command
- session
- page identity when available
- target summary
- reason code on failure
- diagnostics delta or evidence pointer
- run/artifact pointer when available
- concrete next commands

JSON output must remain stable enough for scripts. Do not make text formatting
changes that alter JSON envelopes unless explicitly intended and documented.

## Skill Sync

Any change to command names, flags, defaults, error codes, output, or recovery
behavior must update `skills/pwcli/` in the same change. Skill is the only usage
truth; do not create a second tutorial elsewhere.

# pwcli Claude Code Project Rules

This file is Claude Code project context. It is intentionally under `.claude/`
and is committed with the repository. Do not treat anything here as usage,
architecture, or backlog truth.

Project truth order:

1. Source truth: `src/cli`, `src/engine`, `src/store`, `src/auth`
2. Usage truth: `skills/pwcli/`
3. Architecture truth: `codestable/architecture/`
4. Agent project rules: `.claude/`
5. Collaboration entry rules: `AGENTS.md`

If these Claude Code rules conflict with source, shipped docs, AGENTS, or direct user
instructions, the higher-level truth wins. If a Claude Code rule becomes a stable
project decision, move it into `skills/pwcli/`, `codestable/architecture/`,
or GitHub issues. Do not preserve project planning, migration logs, or backlog
truth in `.claude/`.

## Current Product Judgment

`pwcli` is an Agent-first Playwright CLI. The product is not a browser
automation platform, not an MCP product surface, not an extraction recipe
system, and not a userscript manager.

The main value is:

- Page facts: observe, page, read-text, snapshot, screenshot, pdf
- Browser hands: click, fill, type, press, hover, select, check, uncheck, drag,
  upload, download, wait
- Evidence: diagnostics, trace, har, network, console, errors, run artifacts
- Escape hatch: `pw code` for site-specific or complex Playwright scripts
- Recovery: stable reason codes, low-noise evidence, and concrete next commands

## Mandatory Workflow Before Editing

1. Read `AGENTS.md`.
2. Read `codestable/architecture/documentation-governance.md`.
3. Read `.claude/rules/08-skill-maintenance.md`.
4. Check current git state and never overwrite unrelated user work.
5. If command behavior changes, update `skills/pwcli/`.
6. If domain boundaries change, update `codestable/architecture/`.
7. Verify with the smallest command that covers the changed risk.

## Rule Index

Claude Code discovers `.claude/rules/**/*.md` automatically. Rules without
`paths` frontmatter are global. Rules with `paths` frontmatter are scoped to
matching files. Do not manually load every rule unless the task needs a full
governance audit.

Project slash commands live in `.claude/commands/*.md`. They are local development helpers, not product documentation or active project truth.

- `rules/01-product-boundaries.md`: what this product is and is not
- `rules/02-command-contracts.md`: command, flag, output, batch, and docs sync
- `rules/03-architecture-boundaries.md`: cli/engine/store/auth ownership rules
- `rules/04-recovery-evidence.md`: diagnostics, failure, stale refs, and evidence
- `rules/05-verification-review.md`: review and validation gates
- `rules/06-current-roadmap.md`: current prioritized feature direction
- `rules/07-auth-provider-authoring.md`: built-in auth provider maintenance
- `rules/08-skill-maintenance.md`: skill sync and command contract upkeep
- `rules/09-skill-writing-standard.md`: skill writing quality bar
- `rules/10-review-guidelines.md`: P0/P1 review checklist
- `rules/11-agent-usability-prioritization.md`: evidence-driven Agent usability enhancement prioritization
- `rules/12-command-doc-maintenance.md`: codestable/architecture/commands/ ADR maintenance — command change must update doc

## Local Commands

- `/docs-maintain`: maintain `skills/pwcli/` and `codestable/architecture/` using governance rules
- `/ship-check`: run local ship / release candidate checks

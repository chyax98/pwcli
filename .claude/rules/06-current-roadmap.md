# Current Roadmap Guardrails

This is Claude Code project guidance, not a project backlog. Real action items
belong in GitHub issues.

## Current Highest-Value Direction

Improve real agent browser task completion rate:

1. First-read usefulness
2. Failure evidence
3. Stale ref visibility
4. Safe recovery envelopes
5. Real-page dogfood through existing commands and `pw code`

## Recommended Priority

P0:

- `read-text` defaults: larger default text budget and overlay included by
  default
- docs and skill sync for the new read-text contract

P1:

- screenshot on command failure, linked from diagnostics/run artifacts
- snapshot stale/status command or equivalent fact
- `REF_STALE` envelope improvement without automatic destructive retry

P2:

- diagnostics bundle noise classification
- better action/batch text evidence pointers where missing
- route/mock only for concrete reproduction scenarios

## Do Not Spend More Time On

- resurrecting extract recipes
- adding built-in site templates
- rebuilding MCP
- persistent userscript platform
- benchmark taxonomy/platform features
- compatibility surfaces that no shipped user depends on

## Dogfood Rule

Real-site dogfood should produce one of:

- a concrete bug issue
- a command/docs correction
- a small Playwright script pattern documented in skill

It should not produce a new product subsystem by default.

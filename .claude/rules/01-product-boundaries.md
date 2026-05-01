# Product Boundaries

## Core Positioning

`pwcli` is a thin, reliable command layer over Playwright-core for agents. Its
job is to expose browser facts, browser actions, and failure evidence in a
stable CLI shape.

The tool should help an agent answer:

- What is on the current page?
- What can I safely interact with?
- Did my action work?
- If it failed, what evidence explains the failure?
- When the page is complex, how do I run a Playwright script directly?

## Mainline Capability

Build around this loop:

```text
session create|attach|recreate
  -> observe/page/read-text/snapshot
  -> action/wait/verify
  -> diagnostics/trace/artifacts
  -> agent replans or uses pw code
```

## Explicit Non-Goals

Do not rebuild these unless the user explicitly reopens the decision with fresh
real-world evidence:

- MCP product surface
- extraction recipe system
- site template pack
- userscript manager
- persistent script marketplace
- benchmark platform
- generic mocking/scenario engine
- LLM selector healing
- agent planner inside `pwcli`

## Extraction Decision

Do not reintroduce `extract run`, recipes, or templates as a product surface.
For page content acquisition, prefer:

- `pw read-text`
- `pw snapshot`
- `pw screenshot`
- `pw page current|frames|dialogs|assess`
- `pw network|console|errors`
- `pw code` with direct Playwright APIs for complex pages

If the page requires infinite scroll, folded regions, media collection, or
site-specific traversal, write a `pw code` script for that page and document the
workflow in skills only if it is generally useful.

## Route/Mock Decision

Route/mock can grow only when a real controlled-testing, diagnostics, or browser
workflow reproduction is blocked. It must remain a thin request-control layer.

Reject changes justified only by:

- abstract completeness
- "this would make mocking more powerful"
- a new DSL without a concrete failing scenario
- platformizing scenario definitions

# Architecture Boundary Rules

## Layer Roles

`src/app`:

- CLI parsing
- command registration
- output mode handling
- thin command orchestration

`src/domain`:

- pure transformations
- policy logic
- query/export shaping
- real orchestration that is independent of Playwright runtime calls

`src/infra`:

- Playwright CLI/client integration
- browser runtime scripts
- filesystem artifacts
- low-level environment/substrate access

Do not let domain code reach into runtime to gather browser facts. Commands or
infra gather facts, then domain code transforms them.

## Browser Facts

Keep browser fact collection centralized where possible:

- page identity and navigation identity should flow through shared helpers
- workspace projections should remain the source for page/frame/dialog facts
- diagnostics hooks should be installed before collecting diagnostics facts
- state access preludes should be shared, not copied into every runtime string

## Hollow Layer Ban

Do not create files that only re-export runtime functions through another layer.
If a command needs a runtime primitive and no domain logic exists, import the
runtime function directly.

## File Size And Splitting

Split files by semantic responsibility, not by arbitrary line count.

Good splits:

- facts vs query shaping
- storage vs auth probe vs state diff
- helper types vs signal extraction vs service orchestration

Bad splits:

- one function per file with no domain meaning
- wrappers that exist only to satisfy an imagined architecture
- compatibility modules for deleted contracts

## Playwright Primitive Policy

Do not rewrite Playwright-core primitives for uniformity. Prefer wrapping the
upstream primitive with stable CLI input/output and recovery hints.

Use `pw code` for complex one-off page scripts instead of adding product
surface too early.

# Review rubric for AI-native CLI tools

Score each area 0-3.

## 1. Discovery

- 0: agent must read source or docs manually.
- 1: `--help` exists but is verbose or stale.
- 2: command help is accurate; workflows live elsewhere.
- 3: CLI has discover/search/help plus version-synced skill content.

Questions:

- Can an agent find the right command in under one minute?
- Are examples current and executable?
- Is there one parameter truth?

## 2. State model

- 0: hidden global state, no handles.
- 1: state exists but identifiers are unstable.
- 2: sessions/resources have stable IDs.
- 3: lifecycle, observation, action, and cleanup are explicit.

Questions:

- Can the agent resume after interruption?
- Can it operate multiple sessions safely?
- Are stale handles detectable?

## 3. Observation

- 0: no read-only state commands.
- 1: observation dumps too much raw data.
- 2: compact status/list/inspect exist.
- 3: observations are bounded, structured, and actionable.

Questions:

- Can the agent inspect before mutation?
- Are output limits/cursors/fields available?
- Are stable IDs included?

## 4. Action contract

- 0: actions are ambiguous scripts.
- 1: actions run but return weak evidence.
- 2: actions are bounded and accept stable IDs.
- 3: actions return affected IDs, state-change hints, and verification commands.

Questions:

- Does each action do one thing?
- Does it report whether anything changed?
- Does it avoid silent fallback behavior?

## 5. Verification and evidence

- 0: success means command exited 0.
- 1: some logs or screenshots available.
- 2: verification commands and artifacts exist.
- 3: workflows produce structured, replayable evidence.

Questions:

- Can another agent audit the result?
- Are artifacts saved to predictable paths?
- Are false greens hard to produce?

## 6. Recovery

- 0: raw errors only.
- 1: text suggestions exist.
- 2: stable error codes and retryability exist.
- 3: error envelopes include bounded recovery commands.

Questions:

- Can an agent choose a next step from error output?
- Are common failures classified?
- Are recovery paths tested?

## 7. Safety

- 0: mutating commands are hidden or indistinguishable.
- 1: destructive operations exist without guardrails.
- 2: mutating operations are explicit and documented.
- 3: policies, confirmations, auth hygiene, and prompt-injection boundaries are enforced.

Questions:

- Can the agent tell read-only from mutating?
- Are secrets kept out of output?
- Are page/API outputs treated as untrusted data?

## 8. Escape hatches

- 0: raw execution is the main workflow.
- 1: escape hatches exist with weak limits.
- 2: timeouts and policy boundaries exist.
- 3: escape hatches are documented as fallback and measured separately.

Questions:

- Does code/batch bypass safety?
- Are long workflows pushed toward first-class commands?
- Are timeout and failure evidence preserved?

## Decision

- 0-8: not agent-ready.
- 9-15: usable by expert agents only.
- 16-21: agent-ready with known gaps.
- 22-24: strong AI-native CLI surface.

# Implementation playbook

Use this to build or refactor a CLI into an AI-native tool.

## Step 1: Define agent jobs

Write the top five jobs agents will perform. For each job, write:

```text
input -> observe -> act -> verify -> evidence -> cleanup
```

Do not start with commands. Start with workflows.

## Step 2: Separate command layers

Create explicit layers:

```text
lifecycle: create, attach, close, reset
observe: status, list, inspect, logs
act: run, apply, click, fill, trigger
verify: wait, assert, diff, check
artifacts: screenshot, trace, export, bundle
meta: help, skill, doctor, schema
escape: code, batch, raw
```

Avoid commands that mix lifecycle and action unless there is a strong reason.

## Step 3: Make discovery executable

Add:

```bash
tool --help
tool <command> --help
tool commands list
tool commands search <topic>
tool commands help <command>
```

If the CLI has workflows, add:

```bash
tool skill show
tool skill show --full
tool skill refs
```

Keep help as parameter truth. Keep skill as workflow truth.

## Step 4: Design output contracts

For every command, define:

- text output for humans/agents;
- JSON output for machines;
- stable identifiers;
- output limit controls;
- artifact path fields;
- error envelope shape.

Default output must be bounded.

## Step 5: Add state handles

Expose stable handles early:

- `sessionId`;
- `pageId`;
- `runId`;
- `resourceId`;
- `artifactPath`;
- ref IDs and their invalidation rule.

Agents cannot operate safely without handles.

## Step 6: Build observation before mutation

For each mutating command, ensure there is a read-only command that helps choose safe inputs.

Examples:

```bash
tool list -> tool delete <id>
tool snapshot -> tool click <ref>
tool status -> tool reset
tool diff -> tool apply
```

## Step 7: Add recovery contracts

Classify common failures:

- not found;
- stale handle;
- timeout;
- busy session;
- blocked by modal;
- auth missing;
- permission denied;
- invalid target;
- unsafe operation.

Return stable codes and bounded recovery commands.

## Step 8: Treat artifacts as first-class

Add predictable artifact directories. Return paths in output. Never force agents to scrape terminal logs for evidence.

Good artifact classes:

- screenshots;
- logs;
- traces;
- HAR/network captures;
- run events;
- structured summaries.

## Step 9: Constrain escape hatches

If adding `code`, `batch`, `raw`, or `shell`:

- document as fallback;
- add timeout;
- preserve action policy;
- record evidence;
- classify errors;
- keep stable subset small.

## Step 10: Test the product, not just functions

Add tests at three levels:

1. unit tests for parser/output/error contracts;
2. integration tests for real command chains;
3. agent product regression for common workflows using the skill text and CLI.

A CLI is not agent-ready until a fresh agent can use it without private context.

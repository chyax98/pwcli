# AI-native CLI method

AI-native CLI means the command line is designed for agents first, humans second. The goal is not more commands. The goal is lower ambiguity, bounded context, reliable recovery, and verifiable outcomes.

## Core thesis

A good agent CLI gives an agent four things:

1. **Map** — discover what exists without reading a manual.
2. **Eyes** — observe current state compactly before acting.
3. **Hands** — perform one bounded action with stable inputs.
4. **Evidence** — prove what changed and how to recover when it failed.

If any of these are missing, the agent guesses.

## Command surface layers

Design commands in layers:

```text
lifecycle      create / attach / close / reset
observe        status / list / snapshot / inspect / logs
act            click / run / apply / trigger / mutate
verify         wait / check / assert / diff
artifacts      screenshot / trace / export / bundle
meta           help / skill / schema / doctor
escape hatch   code / batch / raw / shell
```

Each command should have one primary layer. Mixed commands are hard for agents to reason about.

## Progressive disclosure

Do not put the whole manual in the installed skill. Use this shape:

```text
thin installed skill -> CLI-served current skill -> reference sections -> exact command help
```

Rules:

- Installed skill tells the agent where to start.
- CLI-served skill matches the installed CLI version.
- `--help` remains parameter truth.
- References hold deep docs, examples, and edge cases.
- Agents load specialized docs only when task requires them.

## First-class discovery

Every AI-native CLI needs fast discovery:

```bash
tool --help
tool <command> --help
tool skills list
tool skills get core
tool commands list
tool commands search <topic>
tool commands help <command>
```

Discovery output must be short, searchable, and current.

## Stable state identifiers

Agents need durable handles:

- session IDs;
- page IDs;
- resource IDs;
- run IDs;
- artifact paths;
- element refs with explicit lifetime rules.

List commands must expose these IDs. Action commands must accept them.

## Observation before action

High-quality agents inspect before acting. Make that cheap:

```bash
tool status
tool snapshot --interactive
tool logs --level error --limit 20
tool diff --since <run>
```

Default observations should be compact. Deep output must require explicit flags.

## One action, one verification path

After every action, the agent should know what to run next:

```text
action -> wait/check/diff/status -> evidence
```

Actions should return:

- action result;
- affected target ID;
- whether navigation/state changed;
- suggested verification command;
- artifact path when available.

## Recovery-oriented errors

Errors are control-flow for agents. Good errors include:

```json
{
  "code": "REF_STALE",
  "retryable": true,
  "message": "Element reference is stale.",
  "recovery": {
    "kind": "inspect",
    "commands": ["tool snapshot --interactive"]
  }
}
```

Do not return raw stack traces as the main contract.

## Escape hatches stay small

`code`, `batch`, `raw`, and `shell` are escape hatches. They are useful but must not become the product surface.

Rules:

- label them unsafe or advanced;
- keep them policy-gated;
- preserve timeouts and evidence;
- prefer first-class commands for stable workflows;
- never use them to hide missing primitives.

## Evidence is product surface

Artifacts are not extras. They are how agents prove work:

- screenshots;
- traces;
- HAR files;
- logs;
- run event JSONL;
- diffs;
- structured summaries.

Every non-trivial workflow should leave replayable evidence.

## Design test

Ask this after adding any command:

> Can a fresh agent discover it, use it safely, bound its output, recover from common failure, and prove the result without reading source code?

If no, the command is not AI-native yet.

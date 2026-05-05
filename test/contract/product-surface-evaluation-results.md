# pwcli Product Surface Evaluation Results

This file records executed product-surface evaluations.

Do not treat this file as user documentation.

## Overall Summary

Overall grade: A-

All 11 product surfaces have automated evidence and manual scores.

| Surface | Score | Grade | Verdict |
|---|---:|---|---|
| A Session Lifecycle | 27 | A | Healthy |
| B Page Reading and Workspace Facts | 27 | A | Healthy |
| C Element and Page Actions | 27 | A | Healthy |
| D State Checks, Waits, and Assertions | 29 | A | Healthy |
| E Diagnostics and Evidence | 28 | A | Healthy |
| F Environment, Bootstrap, Route, and State Mutation | 29 | A | Healthy |
| G Auth and Reusable Profiles | 27 | A | Healthy with explicit system Chrome limitation |
| H Agent Shortcuts and Structured Extraction | 26 | B | Healthy, keep bounded |
| I Batch and Escape Hatch | 28 | A | Healthy |
| J Preview, Human Control, and Handoff | 28 | A | Healthy |
| K Skill, Help, and Release Contract | 29 | A | Healthy |

Critical findings:

- No open P0/P1 findings remain in this report.
- Resolved P1/P2 issues are recorded under their surfaces.

Boundary decisions:

- No self-built browser.
- No stable system Chrome login-state reuse promise.
- No generic planner hidden behind shortcuts.
- `code` remains an escape hatch.
- `batch` remains a stable structured subset.

<!-- surface:A:start -->
## Surface A: Session Lifecycle

Status: AUTOMATED_EVIDENCE_PASSED

Evaluated at: 2026-05-05T13:59:09.369Z

Commands: `session`, `open`, `status`, `observe`

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `tsx --test test/integration/session.test.ts` | 0 | 41854ms | passed |
| `tsx --test test/integration/session-startup-lock-race.test.ts` | 0 | 5234ms | passed |
| `tsx --test test/integration/session-attachable-id.test.ts` | 0 | 6258ms | passed |
| `node dist/cli.js session --help` | 0 | 36ms | passed |
| `node dist/cli.js open --help` | 0 | 32ms | passed |
| `node dist/cli.js status --help` | 0 | 33ms | passed |
| `node dist/cli.js observe --help` | 0 | 31ms | passed |
| `node dist/cli.js open https://example.com --session noeval --output json` | 1 | manual | passed: returns `SESSION_NOT_FOUND` and does not create the session |
| `node dist/cli.js session status noeval --output json` | 1 | manual | passed: confirms session still does not exist |

Manual score:

| Dimension | Score | Evidence |
|---|---:|---|
| Product Fit | 5 | Session lifecycle is the main product surface for an Agent-first browser task CLI. |
| Journey Completeness | 4 | create/status/recreate/list/close/open-missing-session are covered; full human-observe stream journey is covered in adjacent Surface J rather than here. |
| Contract Stability | 5 | Help exits cleanly, JSON success/error envelopes are stable, and missing-session `open` now returns `SESSION_NOT_FOUND`. |
| Evidence & Recovery | 4 | Session failures include recovery suggestions; lifecycle evidence is mostly state/JSON based, which is appropriate for this surface. |
| Test Realism | 4 | Real CLI integration tests cover named sessions, startup lock, attachable id, close-all, and the `open` boundary regression. |
| Boundary Hygiene | 5 | `session create|attach|recreate` stays the lifecycle path; `open` no longer creates a missing session. |
| Total | 27 | Grade A: healthy after fixing the `open` lifecycle boundary regression. |

Verdict:

- [x] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Findings:

#### Resolved: `open` implicitly created a missing named session

Surface: A Session Lifecycle

Command: `pw open`

Severity: P1, fixed in current branch.

Repro before fix:

```bash
node dist/cli.js open https://example.com --session noeval --output json
node dist/cli.js session status noeval --output json
```

Expected:

- `open` fails when `--session noeval` does not already exist.
- Error envelope uses `SESSION_NOT_FOUND`.
- No session is created.

Current evidence:

- `./node_modules/.bin/tsx --test test/integration/session.test.ts` passes with regression coverage.
- `node dist/cli.js open https://example.com --session noeval --output json` exits 1 with `SESSION_NOT_FOUND`.
- `node dist/cli.js session status noeval --output json` exits 1 with `SESSION_NOT_FOUND`.

<!-- surface:A:end -->

<!-- surface:B:start -->
## Surface B: Page Reading and Workspace Facts

Status: AUTOMATED_EVIDENCE_PASSED

Evaluated at: 2026-05-05T14:12:06.220Z

Commands: `read-text`, `text`, `snapshot`, `accessibility`, `page`, `tab`, `screenshot`, `pdf`

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `tsx --test test/integration/page-reading.test.ts` | 0 | 92476ms | passed |
| `tsx --test test/integration/accessibility.test.ts` | 0 | 19824ms | passed |
| `tsx --test test/integration/page-assess.test.ts` | 0 | 8064ms | passed |
| `tsx --test test/integration/popup.test.ts` | 0 | 18301ms | passed |
| `node test/contract/check-content-boundaries-contract.js` | 0 | 7921ms | passed |

Manual score:

| Dimension | Score | Evidence |
|---|---:|---|
| Product Fit | 5 | Page reading and workspace facts are core to Agent-first browser operation before any action planning. |
| Journey Completeness | 5 | Text, snapshot refs, accessibility tree, page current/list/assess, popup tab handling, screenshot, and PDF all work through real CLI paths. |
| Contract Stability | 4 | JSON envelopes and help are stable for sampled commands; content-boundary contract is covered, but not every B command has a dedicated help/e2e assertion in this surface. |
| Evidence & Recovery | 4 | `screenshot` and `pdf` produce artifacts with run dirs; page facts expose stable IDs; failure recovery is mostly inherited from session/error envelope. |
| Test Realism | 5 | Integration tests now cover `text` alias, `read-text`, `snapshot`, `accessibility`, `page`, `tab select/close`, popup, `screenshot`, `pdf`, and local article assessment. |
| Boundary Hygiene | 4 | Read-only commands stay read-only; `tab select/close` is intentionally workspace control and does not become a planner. |
| Total | 27 | Grade A: healthy after turning the manual `text`/`tab`/`pdf` probes into integration coverage. |

Verdict:

- [x] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Findings:

#### Resolved: Some Surface B commands were only manually probed in this evaluation

Surface: B Page Reading and Workspace Facts

Commands: `text`, `tab select`, `tab close`, `pdf`

Severity: P3, fixed in current branch.

Evidence:

- Manual probes passed for `text`, `tab select`, `tab close`, and `pdf`.
- `test/integration/page-reading.test.ts` now includes focused regression coverage for `text` alias, `tab select/close`, and `pdf` artifact output.
- The Surface B evaluator passed after adding those tests.

Risk:

- Remaining risk is gate cost: `page-reading.test.ts` now takes roughly 90s because each test launches real browser/session paths.

<!-- surface:B:end -->

<!-- surface:C:start -->
## Surface C: Element and Page Actions

Status: AUTOMATED_EVIDENCE_PASSED

Evaluated at: 2026-05-05T14:35:54.267Z

Commands: `click`, `fill`, `type`, `press`, `hover`, `check`, `uncheck`, `select`, `drag`, `upload`, `download`, `scroll`, `resize`, `mouse`, `dialog`

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `tsx --test test/integration/interaction.test.ts` | 0 | 180445ms | passed |
| `tsx --test test/integration/mouse.test.ts` | 0 | 22847ms | passed |
| `tsx --test test/integration/popup.test.ts` | 0 | 17255ms | passed |
| `tsx --test test/integration/control-state.test.ts` | 0 | 9691ms | passed |
| `tsx --test test/integration/action-policy.test.ts` | 0 | 3941ms | passed |
| `tsx --test test/integration/error-messages.test.ts` | 0 | 4077ms | passed |
| `node test/contract/check-doctor-modal-contract.js` | 0 | 69757ms | passed |
| `node test/contract/check-recovery-envelope-contract.js` | 0 | 94ms | passed |

Manual score:

| Dimension | Score | Evidence |
|---|---:|---|
| Product Fit | 5 | Element/page actions are the core mutation surface after page facts are known. |
| Journey Completeness | 5 | Tests now cover click/fill/type/press/hover/check/uncheck/select/drag/upload/download/scroll/resize/mouse/dialog plus popup and human-control blocking. |
| Contract Stability | 4 | Success and failure envelopes are covered, including action policy and recovery contracts; the surface remains broad and needs continued command-level contract discipline. |
| Evidence & Recovery | 5 | Action outputs include run artifacts/diagnostics deltas where relevant, and recovery envelope contract is checked. |
| Test Realism | 4 | Coverage uses real CLI and real browser sessions; some tests still depend on external `httpbin.org`, and the surface gate is slow. |
| Boundary Hygiene | 4 | Action policy and human-control checks keep action commands behind explicit seams; lifecycle setup was corrected so policy no longer blocks `session create`. |
| Total | 27 | Grade A: healthy after fixing the action-policy/lifecycle seam and adding coverage for missing direct action commands. |

Verdict:

- [x] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Findings:

#### Resolved: Action policy blocked lifecycle session creation

Surface: C Element and Page Actions

Commands: `session create`, `open`, `code`

Severity: P1, fixed in current branch.

Evidence:

- Before fix, `PWCLI_ACTION_POLICY` with `deny: ["code", "navigate"]` caused `session create --open` to fail with `SESSION_CREATE_FAILED`.
- Root cause was `managedOpen` enforcing navigate policy for lifecycle-internal session creation.
- Current behavior: `session create` works as lifecycle setup, while standalone `open` and `code` remain blocked by `ACTION_POLICY_DENY`.
- `./node_modules/.bin/tsx --test test/integration/action-policy.test.ts` passes.

#### Finding: Surface C gate is heavy

Surface: C Element and Page Actions

Severity: P3

Evidence:

- `test/integration/interaction.test.ts` took about 180s after adding direct action coverage.
- `check-doctor-modal-contract.js` took about 70s for native dialog coverage.

Risk:

- This is product-healthy but developer-expensive. If the default gate becomes too slow, split expensive action coverage into core vs extended contract runners without deleting the coverage.

<!-- surface:C:end -->

<!-- surface:D:start -->
## Surface D: State Checks, Waits, and Assertions

Status: AUTOMATED_EVIDENCE_PASSED

Evaluated at: 2026-05-05T14:44:55.926Z

Commands: `locate`, `get`, `is`, `verify`, `wait`

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `tsx --test test/integration/state-checks.test.ts` | 0 | 19473ms | passed |
| `tsx --test test/integration/verify-failure-run.test.ts` | 0 | 10182ms | passed |
| `tsx --test test/integration/error-messages.test.ts` | 0 | 4067ms | passed |
| `node test/contract/check-batch-verify-contract.js` | 0 | 4785ms | passed |
| `node test/contract/check-recovery-envelope-contract.js` | 0 | 94ms | passed |

Manual score:

| Dimension | Score | Evidence |
|---|---:|---|
| Product Fit | 5 | State checks are the read-only decision surface between observation and action. |
| Journey Completeness | 4 | Direct coverage exists for `locate/get/is/verify/wait`, including verify failure; not every `verify` assertion variant is separately exercised here. |
| Contract Stability | 5 | JSON envelopes, `VERIFY_FAILED`, batch verify failure summary, and recovery envelope contract are covered. |
| Evidence & Recovery | 5 | Verify failure produces run events and diagnostics bundle evidence suitable for handoff. |
| Test Realism | 5 | D now has a dedicated real CLI/browser integration test and no longer depends on the full action gate. |
| Boundary Hygiene | 5 | `locate/get/is/verify` remain read-only facts/assertions; `wait` waits for state without becoming an action planner. |
| Total | 29 | Grade A: healthy after adding dedicated D coverage and decoupling from Surface C's heavy action gate. |

Verdict:

- [x] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Findings:

#### Resolved: Surface D evaluator depended on the full action gate

Surface: D State Checks, Waits, and Assertions

Severity: P2, fixed in current branch.

Evidence:

- Previous D evaluator reused `test/integration/interaction.test.ts`, which took roughly 180s and tested far more than D's read-only/checking journey.
- `test/integration/state-checks.test.ts` now covers `locate`, `get`, `is`, `verify`, and `wait` directly.
- Re-run Surface D evaluator passed in roughly 39s without the Surface C interaction gate.

<!-- surface:D:end -->

<!-- surface:E:start -->
## Surface E: Diagnostics and Evidence

Status: AUTOMATED_EVIDENCE_PASSED

Evaluated at: 2026-05-05T14:49:24.882Z

Commands: `console`, `network`, `errors`, `diagnostics`, `trace`, `har`, `sse`, `doctor`, `screenshot`, `pdf`

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `tsx --test test/integration/diagnostics.test.ts` | 0 | 34232ms | passed |
| `tsx --test test/integration/network-body.test.ts` | 0 | 12666ms | passed |
| `tsx --test test/integration/sse-observation.test.ts` | 0 | 10530ms | passed |
| `tsx --test test/integration/har.test.ts` | 0 | 22369ms | passed |
| `tsx --test test/integration/video.test.ts` | 0 | 6474ms | passed |
| `tsx --test test/unit/diagnostics-run-digest.test.ts` | 0 | 217ms | passed |
| `tsx --test test/unit/diagnostics-signal-scoring.test.ts` | 0 | 181ms | passed |
| `node test/contract/check-trace-inspect-contract.js` | 0 | 18661ms | passed |
| `node test/contract/check-har-contract.js` | 0 | 8992ms | passed |
| `node test/contract/check-doctor-modal-contract.js` | 0 | 69676ms | passed |

Manual score:

| Dimension | Score | Evidence |
|---|---:|---|
| Product Fit | 5 | Diagnostics and artifacts are the recovery/handoff surface for failed browser tasks. |
| Journey Completeness | 5 | Console, network, errors, diagnostics digest, doctor, trace, HAR record/replay, SSE, video, screenshot/PDF evidence paths are covered across E and adjacent B tests. |
| Contract Stability | 5 | Trace inspect, HAR replay, doctor modal recovery, network body policy, and recovery envelope contracts all pass. |
| Evidence & Recovery | 5 | This surface produces concrete artifacts and structured recovery signals: trace zip, HAR, video, diagnostics bundle/run digest, modal recovery, network/SSE records. |
| Test Realism | 4 | Tests use real CLI/browser sessions and local servers; `check-doctor-modal-contract.js` is useful but slow, and screenshot/PDF are verified in Surface B rather than repeated here. |
| Boundary Hygiene | 4 | Diagnostics stays observational/recovery-oriented; HAR replay and modal doctor are powerful seams and need continued discipline to avoid becoming hidden action planners. |
| Total | 28 | Grade A: healthy evidence surface with a gate-cost risk, not a product correctness risk. |

Verdict:

- [x] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Findings:

#### Finding: Surface E gate cost is high because native modal recovery is expensive

Surface: E Diagnostics and Evidence

Severity: P3

Evidence:

- `node test/contract/check-doctor-modal-contract.js` took about 70s.
- The same contract is also useful for Surface C because it covers native `dialog` handling.

Risk:

- Product behavior is healthy, but repeated surface-level runs pay the same expensive modal coverage cost.

Suggested follow-up:

- Keep the contract, but consider tagging it as shared `dialog/doctor` evidence in the evaluator so C and E can reference one run instead of both rerunning it in full evaluation mode.

<!-- surface:E:end -->

<!-- surface:F:start -->
## Surface F: Environment, Bootstrap, Route, and State Mutation

Status: AUTOMATED_EVIDENCE_PASSED

Evaluated at: 2026-05-05T14:58:55.867Z

Commands: `environment`, `bootstrap`, `route`, `state`, `storage`, `cookies`

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `tsx --test test/integration/bootstrap-persistence.test.ts` | 0 | 5179ms | passed |
| `tsx --test test/integration/route-query-header-match.test.ts` | 0 | 27974ms | passed |
| `tsx --test test/integration/allowed-domains.test.ts` | 0 | 8138ms | passed |
| `tsx --test test/integration/storage-cookies.test.ts` | 0 | 12381ms | passed |
| `tsx --test test/integration/storage-indexeddb-export.test.ts` | 0 | 5983ms | passed |
| `tsx --test test/integration/state-diff.test.ts` | 0 | 10283ms | passed |
| `node test/contract/check-environment-geolocation-contract.js` | 0 | 4873ms | passed |

Manual score:

| Dimension | Score | Evidence |
|---|---:|---|
| Product Fit | 5 | Environment, routing, bootstrap and browser state mutation are essential for reproducible browser tasks. |
| Journey Completeness | 5 | Geolocation, allowed domains, bootstrap persistence/removal, route match/patch, storage local/session/indexeddb, cookies list/set/delete, and state diff are covered. |
| Contract Stability | 5 | The evaluator covers JSON envelopes and focused contracts for geolocation and route/state/storage behavior. |
| Evidence & Recovery | 4 | State diff and route/storage outputs provide strong evidence; recovery guidance is mostly inherited from command envelopes rather than a dedicated F handoff bundle. |
| Test Realism | 5 | Tests use real CLI sessions, local HTTP servers, browser storage APIs, IndexedDB, cookies, and route interception. |
| Boundary Hygiene | 5 | Mutations are explicit and scoped to session/origin/domain; HAR recording remains lifecycle-owned by `session create|recreate`. |
| Total | 29 | Grade A: healthy after adding `cookies delete` and focused storage/cookie coverage. |

Verdict:

- [x] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Findings:

#### Resolved: `cookies` lacked delete support required by the F surface contract

Surface: F Environment, Bootstrap, Route, and State Mutation

Command: `pw cookies`

Severity: P2, fixed in current branch.

Evidence:

- Product-surface contract required cookies read/write/delete behavior.
- Previous CLI exposed only `cookies list` and `cookies set`.
- `cookies delete` was added and covered by `test/integration/storage-cookies.test.ts`.
- Re-run Surface F evaluator passed with the new focused test.

<!-- surface:F:end -->

<!-- surface:G:start -->
## Surface G: Auth and Reusable Profiles

Status: AUTOMATED_EVIDENCE_PASSED

Evaluated at: 2026-05-05T15:01:23.903Z

Commands: `auth`, `profile`, `state`

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `tsx --test test/integration/auth-probe.test.ts` | 0 | 8245ms | passed |
| `tsx --test test/integration/profile-auth.test.ts` | 0 | 45311ms | passed |
| `tsx --test test/integration/profile-state.test.ts` | 0 | 11963ms | passed |
| `tsx --test test/integration/profile-capability-probe.test.ts` | 0 | 219ms | passed |

Manual score:

| Dimension | Score | Evidence |
|---|---:|---|
| Product Fit | 5 | Auth probing and reusable pwcli-managed state directly serve login/session reuse journeys. |
| Journey Completeness | 4 | Auth probe, encrypted auth profile save/login/list/remove, state profile save/load/list/remove, and Chrome profile discovery are covered; system Chrome login-state reuse remains a best-effort migration path, not a stable promise. |
| Contract Stability | 5 | JSON envelopes and capability probe semantics are covered, including blocked/anonymous/authenticated auth states. |
| Evidence & Recovery | 4 | Auth probe returns confidence, signals, blocked state, and recommended action; profile commands expose list/remove evidence. |
| Test Realism | 4 | Tests use real local login fixtures and encrypted profiles; they intentionally do not rely on real third-party auth or live system Chrome login state. |
| Boundary Hygiene | 5 | G now keeps the boundary explicit: pwcli-managed state/auth profiles are the supported path; system Chrome profile is an auxiliary migration attempt only. |
| Total | 27 | Grade A: healthy with an explicit limitation around system Chrome profile reuse. |

Verdict:

- [x] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Findings:

#### Resolved: README overclaimed system Chrome login-state reuse

Surface: G Auth and Reusable Profiles

Severity: P2, fixed in current branch.

Evidence:

- README previously titled the flow as “复用本机 Chrome 登录态”.
- The evaluated stable product path is pwcli-managed `profile save-state/load-state` and encrypted auth profiles.
- README now states `--from-system-chrome` is only a best-effort auxiliary migration entry, not a stable system Chrome login-state reuse guarantee.

<!-- surface:G:end -->

<!-- surface:H:start -->
## Surface H: Agent Shortcuts and Structured Extraction

Status: AUTOMATED_EVIDENCE_PASSED

Evaluated at: 2026-05-05T15:05:47.595Z

Commands: `find-best`, `act`, `analyze-form`, `fill-form`, `extract`, `check-injection`

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `tsx --test test/integration/intent-actions.test.ts` | 0 | 58124ms | passed |
| `tsx --test test/integration/form-analysis.test.ts` | 0 | 20247ms | passed |
| `tsx --test test/integration/extract.test.ts` | 0 | 6051ms | passed |
| `tsx --test test/integration/check-injection.test.ts` | 0 | 7063ms | passed |
| `node test/contract/check-help-contract.js` | 0 | 6895ms | passed |

Manual score:

| Dimension | Score | Evidence |
|---|---:|---|
| Product Fit | 4 | Agent shortcuts reduce repetitive browser work, but they are helper surfaces rather than the core session/action/evidence contract. |
| Journey Completeness | 5 | `find-best`, bounded `act` intents, `analyze-form`, `fill-form`, structured `extract`, and `check-injection` are all covered. |
| Contract Stability | 5 | Help contract and JSON integration tests cover command purpose/options/examples and stable result shapes. |
| Evidence & Recovery | 4 | Outputs expose matched strategy, form fields, extraction rows, and injection findings; recovery is mostly command-local rather than a full handoff. |
| Test Realism | 4 | Tests use real CLI sessions and DOM fixtures; they intentionally avoid turning shortcuts into an LLM planner benchmark. |
| Boundary Hygiene | 4 | The surface is bounded by known intents and schemas, but it remains the area most likely to drift into planner behavior if future features are not constrained. |
| Total | 26 | Grade B: healthy and useful, with boundary discipline more important than adding broad new shortcut behavior. |

Verdict:

- [x] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Findings:

#### Finding: Shortcut surface is healthy but should not expand into a planner

Surface: H Agent Shortcuts and Structured Extraction

Severity: P3

Evidence:

- Existing tests cover bounded intents, form analysis/fill, extraction schema, and injection checks.
- No failing behavior was found.

Risk:

- The main risk is future scope creep. `act` and `find-best` should remain bounded shortcuts over known intents, not a generic action planner.

<!-- surface:H:end -->

<!-- surface:I:start -->
## Surface I: Batch and Escape Hatch

Status: AUTOMATED_EVIDENCE_PASSED

Evaluated at: 2026-05-05T15:09:49.442Z

Commands: `batch`, `code`

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `tsx --test test/integration/batch.test.ts` | 0 | 83037ms | passed |
| `tsx --test test/integration/action-policy.test.ts` | 0 | 3978ms | passed |
| `node test/contract/check-batch-allowlist-contract.js` | 0 | 365ms | passed |
| `node test/contract/check-batch-verify-contract.js` | 0 | 4785ms | passed |
| `node test/contract/check-run-code-timeout-recovery.js` | 0 | 50966ms | passed |

Manual score:

| Dimension | Score | Evidence |
|---|---:|---|
| Product Fit | 4 | `batch` and `code` are essential execution utilities, but they are secondary to the main session/action/read/evidence surfaces. |
| Journey Completeness | 5 | Batch covers stable read/action/wait/verify subset behavior, illegal command rejection, verify failure summaries, and `code` timeout recovery. |
| Contract Stability | 5 | Batch allowlist, batch verify failure, action policy, and `RUN_CODE_TIMEOUT` contracts are all covered. |
| Evidence & Recovery | 5 | `code` timeout recovery proves the session can recover after a stuck escape hatch; batch failures expose stable summaries. |
| Test Realism | 4 | Tests use real CLI/browser sessions; batch and timeout gates are expensive but meaningful. |
| Boundary Hygiene | 5 | `batch` rejects lifecycle/auth commands, and `code` remains policy-controlled rather than bypassing safety seams. |
| Total | 28 | Grade A: healthy escape-hatch surface with expected gate-cost tradeoff. |

Verdict:

- [x] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Findings:

#### Finding: Surface I is healthy but intentionally expensive

Surface: I Batch and Escape Hatch

Severity: P3

Evidence:

- `test/integration/batch.test.ts` took about 83s.
- `check-run-code-timeout-recovery.js` took about 51s because it validates real timeout recovery.

Risk:

- The cost is justified for release/full evaluation. For fast local loops, keep this out of minimal docs-only or help-only gates.

<!-- surface:I:end -->

<!-- surface:J:start -->
## Surface J: Preview, Human Control, and Handoff

Status: AUTOMATED_EVIDENCE_PASSED

Evaluated at: 2026-05-05T15:16:05.448Z

Commands: `stream`, `view`, `control-state`, `takeover`, `release-control`, `dashboard`

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `tsx --test test/integration/stream-preview.test.ts` | 0 | 13112ms | passed |
| `tsx --test test/integration/view-open.test.ts` | 0 | 5849ms | passed |
| `tsx --test test/integration/control-state.test.ts` | 0 | 9645ms | passed |
| `node test/contract/check-dashboard-contract.js` | 0 | 55ms | passed |
| `tsx --test test/integration/diagnostics.test.ts` | 0 | 34221ms | passed |

Manual score:

| Dimension | Score | Evidence |
|---|---:|---|
| Product Fit | 4 | Preview/handoff is important for human collaboration, but remains an auxiliary local observation surface rather than the agent main path. |
| Journey Completeness | 5 | `stream`, `view`, `control-state`, `takeover`, `release-control`, and `dashboard --dry-run` are all covered. |
| Contract Stability | 5 | Stream/view JSON, `/status.json`, `/frame.jpg`, human-control errors, release behavior, and dashboard dry-run contract are covered. |
| Evidence & Recovery | 4 | Preview exposes page/control facts and takeover blocks writes; this surface does not need heavy artifact recovery beyond adjacent diagnostics. |
| Test Realism | 5 | Tests use real CLI sessions, local preview server endpoints, and real human-control blocking across write commands. |
| Boundary Hygiene | 5 | The surface stays local/read-only except explicit takeover/release gates; dashboard is documented and tested as a human observation escape hatch. |
| Total | 28 | Grade A: healthy preview/control surface. |

Verdict:

- [x] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Findings:

#### Resolved: Dashboard had help coverage but no behavior contract in Surface J

Surface: J Preview, Human Control, and Handoff

Command: `pw dashboard open --dry-run`

Severity: P3, fixed in current branch.

Evidence:

- Added `test/contract/check-dashboard-contract.js`.
- Re-run Surface J evaluator passed with dashboard dry-run behavior included.

<!-- surface:J:end -->

<!-- surface:K:start -->
## Surface K: Skill, Help, and Release Contract

Status: AUTOMATED_EVIDENCE_PASSED

Evaluated at: 2026-05-05T15:19:23.756Z

Commands: `skill`, `doctor`, `all --help`

| Check | Exit | Duration | Evidence |
|---|---:|---:|---|
| `node test/contract/check-help-contract.js` | 0 | 6918ms | passed |
| `node test/contract/check-skill-contract.js` | 0 | 74ms | passed |
| `node test/contract/check-skill-show-contract.js` | 0 | 140ms | passed |
| `node test/contract/check-skill-install-contract.js` | 0 | 85ms | passed |
| `node dist/cli.js --help` | 0 | 49ms | passed |
| `pnpm pack:check` | 0 | 1581ms | passed |

Manual score:

| Dimension | Score | Evidence |
|---|---:|---|
| Product Fit | 5 | Help, skill and packaging are the interface agents and maintainers use to discover the product contract. |
| Journey Completeness | 5 | Top-level help, command help contract, skill refs/show/install, and package dry-run are covered. |
| Contract Stability | 5 | Help Purpose/Examples/Notes, packaged skill behavior, and `bin/files` package contract all pass. |
| Evidence & Recovery | 4 | K is mostly documentation/release contract; recovery is represented through accurate help/skill, not runtime artifacts. |
| Test Realism | 5 | Contract checks run against built `dist/cli.js` and `npm pack --dry-run` via `pnpm pack:check`. |
| Boundary Hygiene | 5 | README, skill, AGENTS/CLAUDE, and package roles are separate; skill remains SOP rather than a second command manual. |
| Total | 29 | Grade A: healthy help/skill/release surface. |

Verdict:

- [x] Healthy
- [ ] Needs test
- [ ] Needs fix
- [ ] Needs docs
- [ ] Should be downgraded
- [ ] Should be removed

Findings:

#### Resolved: Package dry-run was not part of the K surface evaluator

Surface: K Skill, Help, and Release Contract

Severity: P3, fixed in current branch.

Evidence:

- Added `pnpm pack:check` to Surface K evaluator.
- Re-run Surface K passed with package dry-run included.

<!-- surface:K:end -->

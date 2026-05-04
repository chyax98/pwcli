import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDiagnosticsAuditConclusion, buildRunDigest } from "../../src/engine/diagnose/core.js";

const cwd = process.cwd();
const tempDir = await mkdtemp(join(tmpdir(), "pwcli-diagnostics-failure-"));

try {
  process.chdir(tempDir);

  const runId = "2026-04-30T00-00-00-000Z-bug-a";
  const runDir = join(tempDir, ".pwcli", "runs", runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(
    join(runDir, "events.jsonl"),
    `${JSON.stringify({
      ts: "2026-04-30T00:00:00.000Z",
      command: "wait",
      sessionName: "bug-a",
      failed: true,
      status: "failed",
      condition: { kind: "selector", selector: ".missing" },
      diagnosticsDelta: { unavailable: true, reason: "MODAL_STATE_BLOCKED" },
      failure: {
        code: "WAIT_FAILED",
        message: "Timeout 30000ms exceeded",
        retryable: null,
        suggestions: [],
        details: null,
      },
    })}\n${JSON.stringify({
      ts: "2026-04-30T00:00:01.000Z",
      command: "click",
      sessionName: "bug-a",
      status: "dialog-pending",
      acted: true,
      modalPending: true,
      diagnosticsDelta: { unavailable: true, reason: "MODAL_STATE_BLOCKED" },
      failureSignal: {
        code: "MODAL_STATE_BLOCKED",
        message: "action fired and a browser dialog is pending",
      },
    })}\n`,
    "utf8",
  );

  const digest = buildRunDigest(
    runId,
    [
      {
        ts: "2026-04-30T00:00:00.000Z",
        command: "wait",
        sessionName: "bug-a",
        failed: true,
        status: "failed",
        condition: { kind: "selector", selector: ".missing" },
        diagnosticsDelta: { unavailable: true, reason: "MODAL_STATE_BLOCKED" },
        failure: {
          code: "WAIT_FAILED",
          message: "Timeout 30000ms exceeded",
          retryable: null,
          suggestions: [],
          details: null,
        },
      },
      {
        ts: "2026-04-30T00:00:01.000Z",
        command: "click",
        sessionName: "bug-a",
        status: "dialog-pending",
        acted: true,
        modalPending: true,
        diagnosticsDelta: { unavailable: true, reason: "MODAL_STATE_BLOCKED" },
        failureSignal: {
          code: "MODAL_STATE_BLOCKED",
          message: "action fired and a browser dialog is pending",
        },
      },
    ],
    10,
  );
  assert.equal(digest.summary.failureCount, 1);
  assert.equal(digest.summary.dialogPendingCount, 1);
  assert.ok(
    digest.topSignals.some(
      (signal: { kind: string }) => signal.kind === "failure:MODAL_STATE_BLOCKED",
    ),
  );

  const audit = buildDiagnosticsAuditConclusion({
    sessionName: "bug-a",
    latestRunId: runId,
    limit: 10,
    digestData: { summary: {}, topSignals: [] },
    latestRunEvents: {
      runId,
      events: [
        {
          ts: "2026-04-30T00:00:01.000Z",
          command: "click",
          failureSignal: {
            code: "MODAL_STATE_BLOCKED",
            message: "action fired and a browser dialog is pending",
          },
        },
      ],
    },
  });
  assert.equal(audit.status, "failed_or_risky");
  assert.equal(audit.failureKind, "MODAL_STATE_BLOCKED");

  const sessionSignalAudit = buildDiagnosticsAuditConclusion({
    sessionName: "bug-a",
    latestRunId: "2026-04-30T00-00-02-000Z-bug-a",
    limit: 10,
    digestData: {
      summary: { consoleErrorCount: 1 },
      topSignals: [
        {
          kind: "console:error",
          timestamp: "2026-04-30T00:00:01.500Z",
          summary: "checkout-timeout CHECKOUT_TIMEOUT",
        },
      ],
    },
    latestRunEvents: {
      runId: "2026-04-30T00-00-02-000Z-bug-a",
      events: [
        {
          ts: "2026-04-30T00:00:02.000Z",
          command: "screenshot",
          path: "/tmp/screenshot.png",
        },
      ],
    },
  });
  assert.equal(sessionSignalAudit.status, "failed_or_risky");
  assert.equal(sessionSignalAudit.failedAt, "2026-04-30T00:00:01.500Z");
  assert.equal(sessionSignalAudit.failedCommand, null);
  assert.equal(sessionSignalAudit.failureKind, "console:error");
  assert.equal(sessionSignalAudit.failureSummary, "checkout-timeout CHECKOUT_TIMEOUT");
  assert.ok(
    sessionSignalAudit.agentNextSteps.some((step: string) =>
      step.includes("diagnostics timeline --session"),
    ),
  );
  assert.ok(
    !sessionSignalAudit.agentNextSteps.some((step: string) =>
      step.includes("2026-04-30T00-00-02-000Z-bug-a"),
    ),
  );
} finally {
  process.chdir(cwd);
  await rm(tempDir, { recursive: true, force: true });
}

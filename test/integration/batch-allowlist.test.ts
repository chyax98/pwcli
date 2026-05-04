import assert from "node:assert/strict";
import { createWorkspace, removeWorkspace, runPw } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-batch-allowlist-");

try {
  const allowedCases: Array<{ label: string; stdin: string; expectedReasonCode: string }> = [
    {
      label: "fill",
      stdin: '[["fill","--selector","#x","val"]]',
      expectedReasonCode: "SESSION_NOT_FOUND",
    },
    {
      label: "check",
      stdin: '[["check","--selector","#x"]]',
      expectedReasonCode: "SESSION_NOT_FOUND",
    },
    {
      label: "select",
      stdin: '[["select","--selector","#x","opt"]]',
      expectedReasonCode: "SESSION_NOT_FOUND",
    },
    {
      label: "hover",
      stdin: '[["hover","--selector","#x"]]',
      expectedReasonCode: "SESSION_NOT_FOUND",
    },
    { label: "press", stdin: '[["press","Enter"]]', expectedReasonCode: "SESSION_NOT_FOUND" },
    {
      label: "scroll",
      stdin: '[["scroll","down","300"]]',
      expectedReasonCode: "SESSION_NOT_FOUND",
    },
    {
      label: "type",
      stdin: '[["type","--selector","#x","hello"]]',
      expectedReasonCode: "SESSION_NOT_FOUND",
    },
  ];

  for (const { label, stdin, expectedReasonCode } of allowedCases) {
    const result = await runPw(
      ["batch", "--session", "ghost", "--stdin-json", "--output", "json"],
      { cwd: workspaceDir, input: stdin },
    );
    assert.notEqual(result.code, 0, `${label}: expected non-zero exit`);
    const envelope = result.json as {
      ok: false;
      error: {
        code: string;
        details?: {
          summary?: {
            firstFailureReasonCode: string | null;
            firstFailedCommand: string | null;
          };
        };
      };
    };
    assert.ok(envelope && !envelope.ok, `${label}: expected error envelope`);
    assert.equal(envelope.error.code, "BATCH_STEP_FAILED", `${label}: expected BATCH_STEP_FAILED`);
    assert.equal(
      envelope.error.details?.summary?.firstFailureReasonCode,
      expectedReasonCode,
      `${label}: expected ${expectedReasonCode}`,
    );
    assert.notEqual(
      envelope.error.details?.summary?.firstFailedCommand,
      null,
      `${label}: expected a failed command`,
    );
  }

  const blockedCases: Array<{ label: string; stdin: string; expectedMessage: string }> = [
    {
      label: "session create",
      stdin: '[["session","create","foo"]]',
      expectedMessage: "batch does not support session lifecycle",
    },
    {
      label: "auth",
      stdin: '[["auth","dc"]]',
      expectedMessage: "batch does not support auth provider execution",
    },
  ];

  for (const { label, stdin, expectedMessage } of blockedCases) {
    const result = await runPw(
      ["batch", "--session", "ghost", "--stdin-json", "--output", "json"],
      { cwd: workspaceDir, input: stdin },
    );
    assert.notEqual(result.code, 0, `${label}: expected non-zero exit`);
    const envelope = result.json as {
      ok: false;
      error: { code: string; message: string };
    };
    assert.ok(envelope && !envelope.ok, `${label}: expected error envelope`);
    assert.equal(envelope.error.code, "BATCH_STEP_FAILED", `${label}: expected BATCH_STEP_FAILED`);
    assert.ok(
      envelope.error.message.includes(expectedMessage),
      `${label}: message '${envelope.error.message}' should include '${expectedMessage}'`,
    );
  }
} finally {
  await removeWorkspace(workspaceDir);
}

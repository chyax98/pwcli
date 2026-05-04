import { runPw } from "./_helpers.js";

const allowedCases = [
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
  const result = await runPw(["batch", "--session", "ghost", "--stdin-json", "--output", "json"], {
    input: stdin,
  });
  if (result.code === 0) {
    throw new Error(`${label}: expected non-zero exit`);
  }
  const envelope = JSON.parse(result.stdout);
  if (envelope.ok !== false || envelope.error?.code !== "BATCH_STEP_FAILED") {
    throw new Error(`${label}: unexpected envelope ${result.stdout}`);
  }
  if (envelope.error?.details?.summary?.firstFailureReasonCode !== expectedReasonCode) {
    throw new Error(`${label}: expected ${expectedReasonCode}, got ${result.stdout}`);
  }
}

const blockedCases = [
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
  const result = await runPw(["batch", "--session", "ghost", "--stdin-json", "--output", "json"], {
    input: stdin,
  });
  if (result.code === 0) {
    throw new Error(`${label}: expected non-zero exit`);
  }
  const envelope = JSON.parse(result.stdout);
  if (envelope.ok !== false || envelope.error?.code !== "BATCH_STEP_FAILED") {
    throw new Error(`${label}: unexpected envelope ${result.stdout}`);
  }
  if (!String(envelope.error?.message ?? "").includes(expectedMessage)) {
    throw new Error(`${label}: expected message ${expectedMessage}, got ${result.stdout}`);
  }
}

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPw } from "./_helpers.js";

const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-recovery-envelope-"));

async function runPwJson(args) {
  const result = await runPw(args, {
    cwd: workspaceDir,
    env: {
      ...process.env,
      NODE_TEST_CONTEXT: undefined,
    },
  });
  const text = result.stdout.trim();
  return {
    ...result,
    json: text ? JSON.parse(text) : null,
  };
}

try {
  const missingSession = await runPwJson(["session", "status", "missing-xyz", "--output", "json"]);
  if (missingSession.code === 0) {
    throw new Error(`expected missing session status to fail: ${missingSession.stdout}`);
  }
  if (
    missingSession.json?.ok !== false ||
    missingSession.json?.error?.code !== "SESSION_NOT_FOUND" ||
    missingSession.json?.error?.recovery?.kind !== "inspect" ||
    !Array.isArray(missingSession.json?.error?.recovery?.commands) ||
    missingSession.json.error.recovery.commands.length === 0
  ) {
    throw new Error(`unexpected SESSION_NOT_FOUND envelope: ${missingSession.stdout}`);
  }

  const tooLongSession = await runPwJson([
    "session",
    "create",
    "verylongnamethatisinvalid",
    "--open",
    "about:blank",
    "--output",
    "json",
  ]);
  if (tooLongSession.code === 0) {
    throw new Error(`expected long session name to fail: ${tooLongSession.stdout}`);
  }
  if (
    tooLongSession.json?.ok !== false ||
    tooLongSession.json?.error?.code !== "SESSION_NAME_TOO_LONG" ||
    tooLongSession.json?.error?.recovery?.kind !== "inspect"
  ) {
    throw new Error(`unexpected SESSION_NAME_TOO_LONG envelope: ${tooLongSession.stdout}`);
  }
} finally {
  await rm(workspaceDir, { recursive: true, force: true });
}

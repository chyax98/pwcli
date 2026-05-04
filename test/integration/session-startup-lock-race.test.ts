import assert from "node:assert/strict";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-session-startup-race-");
const sessionName = uniqueSessionName("r");

try {
  const env = {
    PWCLI_SESSION_STARTUP_LOCK_HOLD_MS: "350",
  };

  const [first, second] = await Promise.all([
    runPw(
      ["session", "create", sessionName, "--headless", "--open", "about:blank", "--output", "json"],
      {
        cwd: workspaceDir,
        env: {
          ...process.env,
          ...env,
        },
      },
    ),
    runPw(
      ["session", "create", sessionName, "--headless", "--open", "about:blank", "--output", "json"],
      {
        cwd: workspaceDir,
        env: {
          ...process.env,
          ...env,
        },
      },
    ),
  ]);

  const results = [first, second];
  const successes = results.filter(
    (result): result is CliResult & { json: { ok: true } } =>
      result.code === 0 &&
      !!result.json &&
      typeof result.json === "object" &&
      (result.json as { ok?: boolean }).ok === true,
  );
  const failures = results.filter(
    (result): result is CliResult & { json: { ok: false; error: { code: string } } } =>
      result.code !== 0 &&
      !!result.json &&
      typeof result.json === "object" &&
      (result.json as { ok?: boolean }).ok === false,
  );

  assert.equal(successes.length, 1, `expected exactly one success, got ${JSON.stringify(results)}`);
  assert.equal(failures.length, 1, `expected exactly one failure, got ${JSON.stringify(results)}`);
  assert.equal(
    (failures[0].json as { error: { code: string } }).error.code,
    "SESSION_BUSY",
    `expected SESSION_BUSY, got ${JSON.stringify(failures[0])}`,
  );
  assert.ok(
    !failures[0].stdout.includes("EADDRINUSE") && !failures[0].stderr.includes("EADDRINUSE"),
    `raw EADDRINUSE leaked:\nstdout=${failures[0].stdout}\nstderr=${failures[0].stderr}`,
  );

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(closeResult.code, 0, `session close failed: ${JSON.stringify(closeResult)}`);
} finally {
  await removeWorkspace(workspaceDir);
}

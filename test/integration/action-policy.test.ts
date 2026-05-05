import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { startFixtureServer, stopFixtureServer } from "../fixtures/servers/realistic-app.mjs";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

test("action policy denies configured high-risk categories", async () => {
  const workspaceDir = await createWorkspace("pwcli-action-policy-");
  const sessionName = uniqueSessionName("policy");
  const policyPath = join(workspaceDir, "policy.json");
  const env = { ...process.env, PWCLI_ACTION_POLICY: policyPath };

  try {
    await startFixtureServer(7778);
    await writeFile(
      policyPath,
      JSON.stringify({ default: "allow", deny: ["code", "navigate"] }, null, 2),
      "utf8",
    );

    const create = await runPw(
      [
        "session",
        "create",
        sessionName,
        "--headless",
        "--open",
        "http://localhost:7778/login",
        "--output",
        "json",
      ],
      { cwd: workspaceDir, env },
    );
    assert.equal(create.code, 0, `session create failed: ${create.stderr}`);

    const code = await runPw(["code", "return 1", "--session", sessionName, "--output", "json"], {
      cwd: workspaceDir,
      env,
    });
    assert.notEqual(code.code, 0, "code should be blocked by policy");
    const codePayload = code.json as { ok: boolean; error?: { code?: string } };
    assert.equal(codePayload.ok, false);
    assert.equal(codePayload.error?.code, "ACTION_POLICY_DENY");

    const open = await runPw(
      ["open", "--session", sessionName, "https://example.com", "--output", "json"],
      { cwd: workspaceDir, env },
    );
    assert.notEqual(open.code, 0, "open should be blocked by policy");
    const openPayload = open.json as { ok: boolean; error?: { code?: string } };
    assert.equal(openPayload.ok, false);
    assert.equal(openPayload.error?.code, "ACTION_POLICY_DENY");
  } finally {
    await runPw(["session", "close", sessionName, "--output", "json"], {
      cwd: workspaceDir,
      env,
    }).catch(() => undefined);
    await stopFixtureServer();
    await removeWorkspace(workspaceDir);
  }
});

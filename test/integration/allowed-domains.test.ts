import assert from "node:assert/strict";
import { startFixtureServer, stopFixtureServer } from "../fixtures/servers/realistic-app.mjs";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-allowed-domains-");
const sessionName = uniqueSessionName("allow");

try {
  await startFixtureServer(7778);

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
    { cwd: workspaceDir },
  );
  assert.equal(create.code, 0, `session create failed: ${create.stderr}`);

  const set = await runPw(
    [
      "environment",
      "allowed-domains",
      "set",
      "--session",
      sessionName,
      "localhost",
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(set.code, 0, `allowed-domains set failed: ${set.stderr}`);

  const status = await runPw(
    ["environment", "allowed-domains", "status", "--session", sessionName, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(status.code, 0, `allowed-domains status failed: ${status.stderr}`);
  const statusPayload = status.json as {
    ok: boolean;
    data: { allowedDomains: string[] };
  };
  assert.equal(statusPayload.ok, true);
  assert.deepEqual(statusPayload.data.allowedDomains, ["localhost"]);

  const blocked = await runPw(
    ["open", "--session", sessionName, "https://example.com", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.notEqual(blocked.code, 0, "open to disallowed domain should fail");
  const blockedPayload = blocked.json as { ok: boolean; error?: { message?: string } };
  assert.equal(blockedPayload.ok, false);
  assert.ok(String(blockedPayload.error?.message ?? "").includes("DOMAIN_NOT_ALLOWED"));

  const clear = await runPw(
    ["environment", "allowed-domains", "clear", "--session", sessionName, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(clear.code, 0, `allowed-domains clear failed: ${clear.stderr}`);
} finally {
  await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  }).catch(() => undefined);
  await stopFixtureServer();
  await removeWorkspace(workspaceDir);
}

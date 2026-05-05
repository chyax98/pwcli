import assert from "node:assert/strict";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-view-open-");
const sessionName = uniqueSessionName("view");

try {
  const create = await runPw(
    [
      "session",
      "create",
      sessionName,
      "--headless",
      "--open",
      "https://example.com",
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(create.code, 0, `session create failed: ${create.stderr}`);

  const open = await runPw(["view", "open", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(open.code, 0, `view open failed: ${open.stderr}`);
  const openPayload = open.json as { ok: boolean; data: { url: string; started: boolean } };
  assert.equal(openPayload.ok, true);
  assert.equal(openPayload.data.started, true);

  const status = await runPw(["view", "status", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(status.code, 0, `view status failed: ${status.stderr}`);
  const statusPayload = status.json as { ok: boolean; data: { healthy: boolean } };
  assert.equal(statusPayload.ok, true);
  assert.equal(statusPayload.data.healthy, true);

  const close = await runPw(["view", "close", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(close.code, 0, `view close failed: ${close.stderr}`);
} finally {
  await runPw(["view", "close", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  }).catch(() => undefined);
  await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  }).catch(() => undefined);
  await removeWorkspace(workspaceDir);
}

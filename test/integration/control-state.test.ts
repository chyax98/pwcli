import assert from "node:assert/strict";
import { startFixtureServer, stopFixtureServer } from "../fixtures/servers/realistic-app.mjs";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-control-state-");
const sessionName = uniqueSessionName("control");

try {
  await startFixtureServer();
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

  const initial = await runPw(["control-state", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(initial.code, 0, `control-state failed: ${initial.stderr}`);
  const initialPayload = initial.json as { ok: boolean; data: { state: string; actor: string } };
  assert.equal(initialPayload.ok, true);
  assert.equal(initialPayload.data.state, "cli");

  const takeover = await runPw(
    [
      "takeover",
      "--session",
      sessionName,
      "--actor",
      "tester",
      "--reason",
      "manual inspection",
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(takeover.code, 0, `takeover failed: ${takeover.stderr}`);

  const status = await runPw(["stream", "start", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(status.code, 0, `stream start failed: ${status.stderr}`);
  const streamPayload = status.json as { ok: boolean; data: { url: string } };
  const preview = await fetch(new URL("/status.json", streamPayload.data.url));
  const previewJson = (await preview.json()) as {
    controlState: { state: string; actor: string; reason?: string | null };
  };
  assert.equal(previewJson.controlState.state, "human");
  assert.equal(previewJson.controlState.actor, "tester");

  const blockedOpen = await runPw(
    ["open", "http://localhost:7778/dashboard", "--session", sessionName, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(blockedOpen.code, 1);
  const blockedOpenPayload = blockedOpen.json as {
    ok: boolean;
    error: { code: string; details?: { command?: string; actor?: string | null } };
  };
  assert.equal(blockedOpenPayload.ok, false);
  assert.equal(blockedOpenPayload.error.code, "SESSION_HUMAN_CONTROLLED");
  assert.equal(blockedOpenPayload.error.details?.command, "open");
  assert.equal(blockedOpenPayload.error.details?.actor, "tester");

  const blockedClick = await runPw(
    ["click", "--session", sessionName, "--selector", "button[type='submit']", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(blockedClick.code, 1);
  const blockedClickPayload = blockedClick.json as {
    ok: boolean;
    error: { code: string; details?: { command?: string } };
  };
  assert.equal(blockedClickPayload.ok, false);
  assert.equal(blockedClickPayload.error.code, "SESSION_HUMAN_CONTROLLED");
  assert.equal(blockedClickPayload.error.details?.command, "click");

  const blockedCode = await runPw(
    ["code", "--session", sessionName, "return { ready: true }", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(blockedCode.code, 1);
  const blockedCodePayload = blockedCode.json as {
    ok: boolean;
    error: { code: string; details?: { command?: string } };
  };
  assert.equal(blockedCodePayload.ok, false);
  assert.equal(blockedCodePayload.error.code, "SESSION_HUMAN_CONTROLLED");
  assert.equal(blockedCodePayload.error.details?.command, "code");

  const release = await runPw(["release-control", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(release.code, 0, `release-control failed: ${release.stderr}`);

  const resumedOpen = await runPw(
    ["open", "http://localhost:7778/dashboard", "--session", sessionName, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(resumedOpen.code, 0, `open after release failed: ${resumedOpen.stderr}`);
} finally {
  await runPw(["stream", "stop", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  }).catch(() => undefined);
  await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  }).catch(() => undefined);
  await stopFixtureServer().catch(() => undefined);
  await removeWorkspace(workspaceDir);
}

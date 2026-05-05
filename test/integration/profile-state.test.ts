import assert from "node:assert/strict";
import test from "node:test";
import { startFixtureServer, stopFixtureServer } from "../fixtures/servers/realistic-app.mjs";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

test("profile state save/load/list/remove works across sessions", async () => {
  const workspaceDir = await createWorkspace("pwcli-profile-state-");
  const sessionName = uniqueSessionName("pstate");
  const secondSession = `${sessionName}b`;
  const profileName = `saved-${Date.now().toString(36).slice(-5)}`;

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

    const seed = await runPw(
      [
        "code",
        `async page => {
          await page.evaluate(() => {
            document.cookie = 'token=abc; path=/';
            localStorage.setItem('profile-user', 'qa@example.com');
          });
          return { seeded: true };
        }`,
        "--session",
        sessionName,
        "--output",
        "json",
      ],
      { cwd: workspaceDir },
    );
    assert.equal(seed.code, 0, `seed failed: ${seed.stderr}`);

    const save = await runPw(
      ["profile", "save-state", profileName, "--session", sessionName, "--output", "json"],
      { cwd: workspaceDir },
    );
    assert.equal(save.code, 0, `profile save-state failed: ${save.stderr}`);

    const list = await runPw(["profile", "list-state", "--output", "json"], { cwd: workspaceDir });
    assert.equal(list.code, 0, `profile list-state failed: ${list.stderr}`);
    const listPayload = list.json as {
      ok: boolean;
      data: { count: number; profiles: Array<{ name: string }> };
    };
    assert.equal(listPayload.ok, true);
    assert.ok(listPayload.data.profiles.some((item) => item.name === profileName));

    const createSecond = await runPw(
      [
        "session",
        "create",
        secondSession,
        "--headless",
        "--open",
        "http://localhost:7778/login",
        "--output",
        "json",
      ],
      { cwd: workspaceDir },
    );
    assert.equal(createSecond.code, 0, `second session create failed: ${createSecond.stderr}`);

    const load = await runPw(
      ["profile", "load-state", profileName, "--session", secondSession, "--output", "json"],
      { cwd: workspaceDir },
    );
    assert.equal(load.code, 0, `profile load-state failed: ${load.stderr}`);

    const storage = await runPw(
      ["storage", "local", "--session", secondSession, "--output", "json"],
      { cwd: workspaceDir },
    );
    assert.equal(storage.code, 0, `storage local failed: ${storage.stderr}`);
    const storagePayload = storage.json as {
      ok: boolean;
      data: { entries: Record<string, string> };
    };
    assert.equal(storagePayload.ok, true);
    assert.equal(storagePayload.data.entries["profile-user"], "qa@example.com");

    const remove = await runPw(["profile", "remove-state", profileName, "--output", "json"], {
      cwd: workspaceDir,
    });
    assert.equal(remove.code, 0, `profile remove-state failed: ${remove.stderr}`);
  } finally {
    await runPw(["session", "close", sessionName, "--output", "json"], {
      cwd: workspaceDir,
    }).catch(() => undefined);
    await runPw(["session", "close", secondSession, "--output", "json"], {
      cwd: workspaceDir,
    }).catch(() => undefined);
    await stopFixtureServer();
    await removeWorkspace(workspaceDir);
  }
});

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { startFixtureServer, stopFixtureServer } from "../fixtures/servers/realistic-app.mjs";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

test("profile auth save/login/list/remove works with encrypted local profiles", async () => {
  const workspaceDir = await createWorkspace("pwcli-profile-auth-");
  const sessionName = uniqueSessionName("pauth");
  const profileName = `auth-${Date.now().toString(36).slice(-5)}`;
  const valuesPath = join(workspaceDir, "values.json");
  const env = { ...process.env, PWCLI_VAULT_KEY: "pwcli-local-test-key" };

  try {
    await startFixtureServer(7778);
    await writeFile(
      valuesPath,
      JSON.stringify({ Username: "demo", Password: "demo123" }, null, 2),
      "utf8",
    );

    const save = await runPw(
      [
        "profile",
        "save-auth",
        profileName,
        "--url",
        "http://localhost:7778/login",
        "--file",
        valuesPath,
        "--output",
        "json",
      ],
      { cwd: workspaceDir, env },
    );
    assert.equal(save.code, 0, `profile save-auth failed: ${save.stderr}`);

    const list = await runPw(["profile", "list-auth", "--output", "json"], {
      cwd: workspaceDir,
      env,
    });
    assert.equal(list.code, 0, `profile list-auth failed: ${list.stderr}`);
    const listPayload = list.json as { ok: boolean; data: { profiles: Array<{ name: string }> } };
    assert.equal(listPayload.ok, true);
    assert.ok(listPayload.data.profiles.some((item) => item.name === profileName));

    const create = await runPw(
      ["session", "create", sessionName, "--headless", "--open", "about:blank", "--output", "json"],
      { cwd: workspaceDir, env },
    );
    assert.equal(create.code, 0, `session create failed: ${create.stderr}`);

    const login = await runPw(
      ["profile", "login-auth", profileName, "--session", sessionName, "--output", "json"],
      { cwd: workspaceDir, env },
    );
    assert.equal(login.code, 0, `profile login-auth failed: ${login.stderr}`);

    const page = await runPw(["page", "current", "--session", sessionName, "--output", "json"], {
      cwd: workspaceDir,
      env,
    });
    assert.equal(page.code, 0, `page current failed: ${page.stderr}`);
    const pagePayload = page.json as { ok: boolean; data: { currentPage: { url: string } } };
    assert.equal(pagePayload.ok, true);
    assert.equal(pagePayload.data.currentPage.url, "http://localhost:7778/dashboard");

    const remove = await runPw(["profile", "remove-auth", profileName, "--output", "json"], {
      cwd: workspaceDir,
      env,
    });
    assert.equal(remove.code, 0, `profile remove-auth failed: ${remove.stderr}`);
  } finally {
    await runPw(["session", "close", sessionName, "--output", "json"], {
      cwd: workspaceDir,
      env,
    }).catch(() => undefined);
    await stopFixtureServer();
    await removeWorkspace(workspaceDir);
  }
});

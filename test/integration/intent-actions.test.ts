import assert from "node:assert/strict";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-intent-actions-");
const sessionName = uniqueSessionName("intent");

try {
  const create = await runPw(
    ["session", "create", sessionName, "--headless", "--open", "about:blank", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(create.code, 0, `session create failed: ${create.stderr}`);

  const page = `async page => {
    await page.setContent(\`
      <main>
        <div id="cookie-banner">
          <button id="accept-cookies" onclick="document.querySelector('#cookie-status').textContent='accepted'">Accept all</button>
          <span id="cookie-status">pending</span>
        </div>
        <form id="login-form" onsubmit="event.preventDefault(); document.querySelector('#submit-status').textContent='submitted'">
          <input type="email" placeholder="Email">
          <input type="password" placeholder="Password">
          <button type="submit" id="submit-btn">Continue</button>
        </form>
        <div id="submit-status">idle</div>
      </main>
    \`);
    return { ready: true };
  }`;
  const seed = await runPw(["code", page, "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(seed.code, 0, `seed failed: ${seed.stderr}`);

  const findSubmit = await runPw(
    ["find-best", "--session", sessionName, "submit_form", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(findSubmit.code, 0, `find-best submit_form failed: ${findSubmit.stderr}`);
  const submitPayload = findSubmit.json as {
    ok: boolean;
    data: { count: number; best: { ref?: string; text?: string; strategy?: string } | null };
  };
  assert.equal(submitPayload.ok, true);
  assert.ok((submitPayload.data.count ?? 0) >= 1);
  assert.ok(submitPayload.data.best);
  assert.ok(String(submitPayload.data.best?.text ?? "").includes("Continue"));

  const actCookies = await runPw(
    ["act", "--session", sessionName, "accept_cookies", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(actCookies.code, 0, `act accept_cookies failed: ${actCookies.stderr}`);
  const cookiePayload = actCookies.json as {
    ok: boolean;
    data: { acted: boolean; intent: string; matched: { strategy?: string } };
  };
  assert.equal(cookiePayload.ok, true);
  assert.equal(cookiePayload.data.acted, true);
  assert.equal(cookiePayload.data.intent, "accept_cookies");
  assert.ok(cookiePayload.data.matched.strategy);

  const cookieState = await runPw(
    ["read-text", "--session", sessionName, "--selector", "#cookie-status", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(cookieState.code, 0, `cookie status read failed: ${cookieState.stderr}`);
  const cookieText = cookieState.json as { ok: boolean; data: { text: string } };
  assert.equal(cookieText.ok, true);
  assert.equal(cookieText.data.text, "accepted");

  const actSubmit = await runPw(
    ["act", "--session", sessionName, "submit_form", "--output", "json"],
    {
      cwd: workspaceDir,
    },
  );
  assert.equal(actSubmit.code, 0, `act submit_form failed: ${actSubmit.stderr}`);
  const submitState = await runPw(
    ["read-text", "--session", sessionName, "--selector", "#submit-status", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(submitState.code, 0, `submit status read failed: ${submitState.stderr}`);
  const submitText = submitState.json as { ok: boolean; data: { text: string } };
  assert.equal(submitText.ok, true);
  assert.equal(submitText.data.text, "submitted");
} finally {
  await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  }).catch(() => undefined);
  await removeWorkspace(workspaceDir);
}

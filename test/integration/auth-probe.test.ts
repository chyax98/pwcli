import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-auth-probe-");
const sessionName = uniqueSessionName("auth");

const server = createServer((request, response) => {
  const route = request.url ?? "/";
  if (route.startsWith("/login")) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      `<!doctype html><title>Sign in</title><main><h1>Sign in</h1><form><input type="email"><input type="password"><button type="submit">Continue with email</button></form></main>`,
    );
    return;
  }
  if (route.startsWith("/challenge")) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      `<!doctype html><title>Security check</title><main><h1>Verify you are human</h1><p>Complete the CAPTCHA security check before continuing.</p></main>`,
    );
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(
    `<!doctype html><title>Dashboard</title><main><img alt="Account avatar" src="/avatar.png"><h1>Workspace dashboard</h1><button>Account settings</button><p>Protected workspace content</p></main>`,
  );
});

await new Promise<void>((resolveStart) => {
  server.listen(0, "127.0.0.1", () => resolveStart());
});

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("failed to bind fixture server");
}
const baseUrl = `http://127.0.0.1:${address.port}`;
const appUrl = `${baseUrl}/app`;
const loginUrl = `${baseUrl}/login`;
const challengeUrl = `${baseUrl}/challenge`;

const seedScript = `async page => {
  return await page.evaluate(() => {
    document.cookie = 'session_token=abc123; path=/';
    localStorage.setItem('auth.user', 'u-123');
    sessionStorage.setItem('workspace.session', 'ready');
    return { seeded: true };
  });
}`;

try {
  const createResult = await runPw(
    ["session", "create", sessionName, "--headless", "--open", appUrl, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(createResult.code, 0, `session create failed: ${JSON.stringify(createResult)}`);

  const seedResult = await runPw(
    ["code", seedScript, "--session", sessionName, "--output", "json"],
    {
      cwd: workspaceDir,
    },
  );
  assert.equal(seedResult.code, 0, `seed code failed: ${JSON.stringify(seedResult)}`);

  const authenticatedProbe = await runPw(
    ["auth", "probe", "--session", sessionName, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(
    authenticatedProbe.code,
    0,
    `auth probe failed: ${JSON.stringify(authenticatedProbe)}`,
  );
  const authenticatedEnvelope = authenticatedProbe.json as {
    ok: boolean;
    data: {
      status: string;
      confidence: string;
      blockedState: string;
      recommendedAction: string;
      capability: {
        capability: string;
        supported: boolean;
        available: boolean;
        blocked: boolean;
        reusableStateLikely: boolean;
      };
      signals: {
        pageIdentity: unknown[];
        protectedResource: unknown[];
        storage: unknown[];
      };
    };
  };
  assert.equal(authenticatedEnvelope.ok, true);
  assert.equal(authenticatedEnvelope.data.status, "authenticated");
  assert.equal(authenticatedEnvelope.data.confidence, "high");
  assert.equal(authenticatedEnvelope.data.blockedState, "none");
  assert.equal(authenticatedEnvelope.data.recommendedAction, "continue");
  assert.equal(authenticatedEnvelope.data.capability.capability, "auth-state-probe");
  assert.equal(authenticatedEnvelope.data.capability.supported, true);
  assert.equal(authenticatedEnvelope.data.capability.available, true);
  assert.equal(authenticatedEnvelope.data.capability.blocked, false);
  assert.equal(authenticatedEnvelope.data.capability.reusableStateLikely, true);
  assert.ok(authenticatedEnvelope.data.signals.pageIdentity.length >= 2);
  assert.ok(authenticatedEnvelope.data.signals.protectedResource.length >= 2);
  assert.ok(authenticatedEnvelope.data.signals.storage.length >= 3);

  const anonymousProbe = await runPw(
    ["auth", "probe", "--session", sessionName, "--url", loginUrl, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(anonymousProbe.code, 0, `anonymous probe failed: ${JSON.stringify(anonymousProbe)}`);
  const anonymousEnvelope = anonymousProbe.json as {
    ok: boolean;
    data: {
      status: string;
      blockedState: string;
      recommendedAction: string;
      requestedUrl: string;
      capability: {
        available: boolean;
        blocked: boolean;
        reusableStateLikely: boolean;
      };
    };
  };
  assert.equal(anonymousEnvelope.ok, true);
  assert.equal(anonymousEnvelope.data.status, "anonymous");
  assert.equal(anonymousEnvelope.data.blockedState, "none");
  assert.equal(anonymousEnvelope.data.recommendedAction, "reauth");
  assert.equal(anonymousEnvelope.data.requestedUrl, loginUrl);
  assert.equal(anonymousEnvelope.data.capability.available, false);
  assert.equal(anonymousEnvelope.data.capability.blocked, false);
  assert.equal(anonymousEnvelope.data.capability.reusableStateLikely, false);

  const challengeProbe = await runPw(
    ["auth", "probe", "--session", sessionName, "--url", challengeUrl, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(challengeProbe.code, 0, `challenge probe failed: ${JSON.stringify(challengeProbe)}`);
  const challengeEnvelope = challengeProbe.json as {
    ok: boolean;
    data: {
      status: string;
      blockedState: string;
      recommendedAction: string;
      capability: {
        available: boolean;
        blocked: boolean;
      };
    };
  };
  assert.equal(challengeEnvelope.ok, true);
  assert.equal(challengeEnvelope.data.status, "uncertain");
  assert.equal(challengeEnvelope.data.blockedState, "challenge");
  assert.equal(challengeEnvelope.data.recommendedAction, "human_handoff");
  assert.equal(challengeEnvelope.data.capability.available, false);
  assert.equal(challengeEnvelope.data.capability.blocked, true);

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(closeResult.code, 0, `session close failed: ${JSON.stringify(closeResult)}`);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolveClose();
    });
  });
  await removeWorkspace(workspaceDir);
}

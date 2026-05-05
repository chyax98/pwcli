import assert from "node:assert/strict";
import { createWorkspace, removeWorkspace, runPw } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-error-messages-");

try {
  // Create a session so that tab select fails with tab-level error (not SESSION_NOT_FOUND).
  const sessionName = `err-${Date.now().toString(36).slice(-4)}`;
  const createResult = await runPw(
    ["session", "create", sessionName, "--headless", "--open", "about:blank", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(createResult.code, 0, `session create failed: ${JSON.stringify(createResult)}`);

  const tabSelect = await runPw(
    ["tab", "select", "nonexistent-id", "--session", sessionName, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.notEqual(tabSelect.code, 0, "tab select should fail");
  const tabEnvelope = tabSelect.json as {
    ok: false;
    error: { code: string; message: string; suggestions?: string[] };
  };
  assert.ok(tabEnvelope && !tabEnvelope.ok);
  assert.equal(tabEnvelope.error.code, "TAB_SELECT_FAILED");
  assert.match(tabEnvelope.error.message, /TAB_PAGE_NOT_FOUND/);

  // Clean up the temporary session.
  await runPw(["session", "close", sessionName, "--output", "json"], { cwd: workspaceDir });

  const sessionRecreate = await runPw(["session", "recreate", "ghost", "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.notEqual(sessionRecreate.code, 0, "session recreate should fail");
  const recreateEnvelope = sessionRecreate.json as {
    ok: false;
    error: {
      code: string;
      suggestions?: string[];
      recovery?: { kind: string; commands: string[] };
    };
  };
  assert.ok(recreateEnvelope && !recreateEnvelope.ok);
  assert.equal(recreateEnvelope.error.code, "SESSION_NOT_FOUND");
  assert.ok(
    Array.isArray(recreateEnvelope.error.suggestions) &&
      recreateEnvelope.error.suggestions.length > 0,
    `session recreate should have suggestions: ${JSON.stringify(recreateEnvelope.error)}`,
  );

  const code = await runPw(["code", "while(true){}", "--session", "ghost", "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.notEqual(code.code, 0, "code should fail");
  const codeEnvelope = code.json as { ok: false; error: { code: string } };
  assert.ok(codeEnvelope && !codeEnvelope.ok);
  assert.equal(codeEnvelope.error.code, "SESSION_NOT_FOUND");

  const mouseClick = await runPw(
    ["mouse", "click", "--x", "100", "--y", "200", "--session", "ghost", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.notEqual(mouseClick.code, 0, "mouse click should fail");
  const mouseEnvelope = mouseClick.json as { ok: false; error: { code: string } };
  assert.ok(mouseEnvelope && !mouseEnvelope.ok);
  assert.equal(mouseEnvelope.error.code, "SESSION_NOT_FOUND");

  const accessibility = await runPw(["accessibility", "--session", "ghost", "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.notEqual(accessibility.code, 0, "accessibility should fail");
  const accessibilityEnvelope = accessibility.json as { ok: false; error: { code: string } };
  assert.ok(accessibilityEnvelope && !accessibilityEnvelope.ok);
  assert.equal(accessibilityEnvelope.error.code, "SESSION_NOT_FOUND");

  const harReplay = await runPw(
    ["har", "replay", "/nonexistent.har", "--session", "ghost", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.notEqual(harReplay.code, 0, "har replay should fail");
  const harEnvelope = harReplay.json as { ok: false; error: { code: string; message: string } };
  assert.ok(harEnvelope && !harEnvelope.ok);
  // Should be SESSION_NOT_FOUND since session doesn't exist; if it ever changes to file-not-found,
  // the assertion still passes as long as it's one of the expected codes.
  assert.ok(
    harEnvelope.error.code === "SESSION_NOT_FOUND" ||
      harEnvelope.error.message.toLowerCase().includes("file") ||
      harEnvelope.error.message.toLowerCase().includes("exist"),
    `har replay unexpected error: ${JSON.stringify(harEnvelope.error)}`,
  );
} finally {
  await removeWorkspace(workspaceDir);
}

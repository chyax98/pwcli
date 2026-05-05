import assert from "node:assert/strict";
import { startFixtureServer, stopFixtureServer } from "../fixtures/servers/realistic-app.mjs";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-form-analysis-");
const sessionName = uniqueSessionName("form");

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

  const analyze = await runPw(["analyze-form", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(analyze.code, 0, `analyze-form failed: ${analyze.stderr}`);
  const analyzePayload = analyze.json as {
    ok: boolean;
    data: {
      fieldCount: number;
      fields: Array<{ label?: string; name?: string; selectorHint?: string; inputType?: string }>;
    };
  };
  assert.equal(analyzePayload.ok, true);
  assert.equal(analyzePayload.data.fieldCount, 2);
  assert.ok(analyzePayload.data.fields.some((field) => field.label?.includes("Username")));
  assert.ok(analyzePayload.data.fields.some((field) => field.inputType === "password"));

  const fill = await runPw(
    [
      "fill-form",
      "--session",
      sessionName,
      '{"Username":"demo","Password":"demo123"}',
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(fill.code, 0, `fill-form failed: ${fill.stderr}`);
  const fillPayload = fill.json as {
    ok: boolean;
    data: { filledCount: number; filled: Array<{ key: string; kind: string }> };
  };
  assert.equal(fillPayload.ok, true);
  assert.equal(fillPayload.data.filledCount, 2);
  assert.ok(fillPayload.data.filled.some((item) => item.key === "Username"));
  assert.ok(fillPayload.data.filled.some((item) => item.key === "Password"));
} finally {
  await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  }).catch(() => undefined);
  await stopFixtureServer();
  await removeWorkspace(workspaceDir);
}

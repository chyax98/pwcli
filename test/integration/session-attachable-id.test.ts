import assert from "node:assert/strict";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-attachable-id-");
const sourceSessionName = uniqueSessionName("src");
const attachedSessionName = uniqueSessionName("att");

try {
  const createResult = await runPw(
    [
      "session",
      "create",
      sourceSessionName,
      "--headless",
      "--open",
      "about:blank",
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(createResult.code, 0);

  const listResult = await runPw(["session", "list", "--attachable", "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(listResult.code, 0, `session list failed: ${listResult.stderr}`);
  const attachableList = listResult.json as {
    data: {
      attachable?: {
        supported: boolean;
        count: number;
        servers: Array<{
          id: string;
          title: string;
          canConnect: boolean;
        }>;
      };
    };
  };
  assert.equal(attachableList.data.attachable?.supported, true);
  assert.ok((attachableList.data.attachable?.count ?? 0) >= 1);
  const attachableId = attachableList.data.attachable?.servers.find(
    (server) => server.canConnect && server.title === sourceSessionName,
  )?.id;
  assert.ok(attachableId, "expected a connectable attachable server for the source session");

  const attachResult = await runPw(
    ["session", "attach", attachedSessionName, "--attachable-id", attachableId, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(attachResult.code, 0, `session attach failed: ${attachResult.stderr}`);
  const attachJson = attachResult.json as {
    ok: boolean;
    data: { attached: boolean; resolvedVia: string };
  };
  assert.equal(attachJson.ok, true);
  assert.equal(attachJson.data.attached, true);
  assert.equal(attachJson.data.resolvedVia, "attachable-id");

  const statusResult = await runPw(["session", "status", attachedSessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(statusResult.code, 0);
  const statusJson = statusResult.json as { data: { active: boolean } };
  assert.equal(statusJson.data.active, true);

  await runPw(["session", "close", attachedSessionName, "--output", "json"], { cwd: workspaceDir });
  await runPw(["session", "close", sourceSessionName, "--output", "json"], { cwd: workspaceDir });
} finally {
  await removeWorkspace(workspaceDir);
}

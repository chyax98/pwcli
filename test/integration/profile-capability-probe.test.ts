import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createWorkspace, removeWorkspace, runPw } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-profile-capability-");
const chromeUserDataDir = join(workspaceDir, "chrome-user-data");

try {
  await mkdir(join(chromeUserDataDir, "Default"), { recursive: true });
  await mkdir(join(chromeUserDataDir, "Profile 1"), { recursive: true });
  await writeFile(
    join(chromeUserDataDir, "Local State"),
    JSON.stringify(
      {
        profile: {
          info_cache: {
            Default: { name: "Primary" },
            "Profile 1": { name: "QA" },
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const listResult = await runPw(["profile", "list-chrome", "--output", "json"], {
    cwd: workspaceDir,
    env: {
      ...process.env,
      PWCLI_CHROME_USER_DATA_DIR: chromeUserDataDir,
    },
  });
  assert.equal(listResult.code, 0, `profile list-chrome failed: ${JSON.stringify(listResult)}`);
  const listEnvelope = listResult.json as {
    ok: boolean;
    data: {
      count: number;
      profiles: Array<{ directory: string; name: string; default: boolean }>;
    };
  };
  assert.equal(listEnvelope.ok, true);
  assert.equal(listEnvelope.data.count, 2);
  assert.deepEqual(
    listEnvelope.data.profiles.map((profile) => profile.directory),
    ["Default", "Profile 1"],
  );
} finally {
  await removeWorkspace(workspaceDir);
}

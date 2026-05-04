import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type CliResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  json: unknown;
};

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-profile-capability-"));
const chromeUserDataDir = join(workspaceDir, "chrome-user-data");

function runPw(args: string[], envOverrides?: Record<string, string>) {
  return new Promise<CliResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: workspaceDir,
      env: {
        ...process.env,
        ...envOverrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const trimmed = stdout.trim();
      let json: unknown = null;
      if (trimmed) {
        json = JSON.parse(trimmed);
      }
      resolveResult({ code, stdout, stderr, json });
    });
  });
}

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
    PWCLI_CHROME_USER_DATA_DIR: chromeUserDataDir,
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
  await rm(workspaceDir, { recursive: true, force: true });
}

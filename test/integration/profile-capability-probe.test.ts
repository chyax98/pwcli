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
      capability: {
        capability: string;
        supported: boolean;
        available: boolean;
        profileCount: number;
        defaultProfileAvailable: boolean;
      };
    };
  };
  assert.equal(listEnvelope.ok, true);
  assert.equal(listEnvelope.data.count, 2);
  assert.equal(listEnvelope.data.capability.capability, "system-chrome-profile-source");
  assert.equal(listEnvelope.data.capability.supported, true);
  assert.equal(listEnvelope.data.capability.available, true);
  assert.equal(listEnvelope.data.capability.profileCount, 2);
  assert.equal(listEnvelope.data.capability.defaultProfileAvailable, true);
  assert.deepEqual(
    listEnvelope.data.profiles.map((profile) => profile.directory),
    ["Default", "Profile 1"],
  );

  const inspectTarget = join(workspaceDir, "persistent-profile");
  const inspectResult = await runPw(["profile", "inspect", inspectTarget, "--output", "json"]);
  assert.equal(inspectResult.code, 0, `profile inspect failed: ${JSON.stringify(inspectResult)}`);
  const inspectEnvelope = inspectResult.json as {
    ok: boolean;
    data: {
      profile: {
        exists: boolean;
        writable: boolean;
        usable: boolean;
        willCreateOnOpen?: boolean;
      };
      capability: {
        capability: string;
        supported: boolean;
        available: boolean;
        exists: boolean;
        writable: boolean;
        willCreateOnOpen: boolean;
      };
    };
  };
  assert.equal(inspectEnvelope.ok, true);
  assert.equal(inspectEnvelope.data.profile.exists, false);
  assert.equal(inspectEnvelope.data.profile.writable, true);
  assert.equal(inspectEnvelope.data.profile.usable, true);
  assert.equal(inspectEnvelope.data.profile.willCreateOnOpen, true);
  assert.equal(inspectEnvelope.data.capability.capability, "persistent-profile-path");
  assert.equal(inspectEnvelope.data.capability.supported, true);
  assert.equal(inspectEnvelope.data.capability.available, true);
  assert.equal(inspectEnvelope.data.capability.exists, false);
  assert.equal(inspectEnvelope.data.capability.writable, true);
  assert.equal(inspectEnvelope.data.capability.willCreateOnOpen, true);
} finally {
  await rm(workspaceDir, { recursive: true, force: true });
}

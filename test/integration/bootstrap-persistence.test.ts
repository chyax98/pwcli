import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  createWorkspace,
  removeWorkspace,
  repoRoot,
  runPw,
  uniqueSessionName,
} from "./_helpers.ts";

type FixtureServer = {
  child: ChildProcess;
  blankUrl: string;
  readLogs(): string;
};

const cliPath = resolve(repoRoot, "dist", "cli.js");
const fixtureServerPath = resolve(
  repoRoot,
  "test",
  "fixtures",
  "servers",
  "deterministic-server.js",
);
const workspaceDir = await createWorkspace("pwcli-bootstrap-persistence-");
const sessionName = uniqueSessionName("boot");
const initScriptPath = resolve(workspaceDir, "pwcli-test-init.js");
const bootstrapConfigPath = resolve(workspaceDir, ".pwcli", "bootstrap", `${sessionName}.json`);

async function waitForFixture(url: string, child: ChildProcess, readLogs: () => string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      break;
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await delay(100);
  }
  throw new Error(`fixture server did not become healthy at ${url}\n${readLogs()}`);
}

async function startFixtureServer(): Promise<FixtureServer> {
  const port = 43180 + Math.floor(Math.random() * 2000);
  const child = spawn(process.execPath, [fixtureServerPath, String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PWCLI_FIXTURE_PORT: String(port),
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
  const blankUrl = `http://127.0.0.1:${port}/blank`;
  const readLogs = () => `stdout=${stdout}\nstderr=${stderr}`;
  await waitForFixture(blankUrl, child, readLogs);
  return { child, blankUrl, readLogs };
}

async function stopFixtureServer(server: FixtureServer | null) {
  if (!server || server.child.exitCode !== null) {
    return;
  }
  await new Promise<void>((resolveClose) => {
    server.child.once("close", () => resolveClose());
    server.child.kill("SIGTERM");
  });
}

let fixtureServer: FixtureServer | null = null;

try {
  fixtureServer = await startFixtureServer();
  await writeFile(initScriptPath, "console.log('pwcli-test-init');\n", "utf8");
  const cliEnv = {
    ...process.env,
    NODE_TEST_CONTEXT: undefined,
    PLAYWRIGHT_DAEMON_SESSION_DIR: resolve(workspaceDir, ".pwcli", "playwright-daemon"),
    PLAYWRIGHT_SERVER_REGISTRY: resolve(workspaceDir, ".pwcli", "playwright-registry"),
  };

  const createResult = await runPw(
    [
      "session",
      "create",
      sessionName,
      "--init-script",
      initScriptPath,
      "--headless",
      "--open",
      fixtureServer.blankUrl,
      "--output",
      "json",
    ],
    { cwd: workspaceDir, env: cliEnv },
  );
  assert.equal(createResult.code, 0, `session create failed: ${JSON.stringify(createResult)}`);
  const createEnvelope = createResult.json as {
    ok: boolean;
    data: {
      bootstrapApplied?: boolean;
    };
  };
  assert.equal(createEnvelope.ok, true);
  assert.equal(createEnvelope.data.bootstrapApplied, true);

  const persistedConfig = JSON.parse(await readFile(bootstrapConfigPath, "utf8")) as {
    initScripts: string[];
  };
  assert.ok(Array.isArray(persistedConfig.initScripts));
  assert.deepEqual(persistedConfig.initScripts, [initScriptPath]);

  const removeResult = await runPw(
    [
      "bootstrap",
      "apply",
      "--session",
      sessionName,
      "--remove-init-script",
      initScriptPath,
      "--output",
      "json",
    ],
    { cwd: workspaceDir, env: cliEnv },
  );
  assert.equal(
    removeResult.code,
    0,
    `bootstrap remove-init-script failed: ${JSON.stringify(removeResult)}`,
  );
  const removeEnvelope = removeResult.json as {
    ok: boolean;
    data: {
      removed: boolean;
    };
  };
  assert.equal(removeEnvelope.ok, true);
  assert.equal(removeEnvelope.data.removed, true);

  const updatedConfig = JSON.parse(await readFile(bootstrapConfigPath, "utf8")) as {
    initScripts: string[];
  };
  assert.deepEqual(updatedConfig.initScripts, []);

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
    env: cliEnv,
  });
  assert.equal(closeResult.code, 0, `session close failed: ${JSON.stringify(closeResult)}`);
} finally {
  await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
    env: {
      ...process.env,
      NODE_TEST_CONTEXT: undefined,
      PLAYWRIGHT_DAEMON_SESSION_DIR: resolve(workspaceDir, ".pwcli", "playwright-daemon"),
      PLAYWRIGHT_SERVER_REGISTRY: resolve(workspaceDir, ".pwcli", "playwright-registry"),
    },
  }).catch(() => {});
  await stopFixtureServer(fixtureServer);
  await removeWorkspace(workspaceDir);
}

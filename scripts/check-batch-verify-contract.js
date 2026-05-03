import { spawnSync } from "node:child_process";

const cli = ["node", "dist/cli.js"];
const session = "batchv";

function run(args, options = {}) {
  return spawnSync(cli[0], [...cli.slice(1), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  });
}

function parseJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} did not return JSON: ${error.message}\n${stdout}`);
  }
}

run(["session", "close", session]);

try {
  const create = run([
    "session",
    "create",
    session,
    "--no-headed",
    "--open",
    "data:text/html,<main>expected text</main>",
  ]);
  if (create.status !== 0) {
    throw new Error(`session create failed\n${create.stdout}\n${create.stderr}`);
  }

  const batch = run(["batch", "--output", "json", "--session", session, "--stdin-json"], {
    input: JSON.stringify([["verify", "text", "--text", "missing text"]]),
  });
  if (batch.status === 0) {
    throw new Error(`batch verify failure unexpectedly exited 0\n${batch.stdout}`);
  }

  const payload = parseJson(batch.stdout, "batch verify failure");
  if (payload.ok !== false || payload.error?.code !== "BATCH_STEP_FAILED") {
    throw new Error(`unexpected batch failure payload: ${JSON.stringify(payload, null, 2)}`);
  }
  const summary = payload.error?.details?.summary;
  if (summary?.failedCount !== 1 || summary?.successCount !== 0) {
    throw new Error(`unexpected batch summary: ${JSON.stringify(summary, null, 2)}`);
  }
} finally {
  run(["session", "close", session]);
}

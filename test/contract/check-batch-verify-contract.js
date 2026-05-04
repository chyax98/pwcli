import { parseJson, runPwSync } from "./_helpers.js";

const session = "batchv";

runPwSync(["session", "close", session]);

try {
  const create = runPwSync([
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

  const batch = runPwSync(["batch", "--output", "json", "--session", session, "--stdin-json"], {
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
  runPwSync(["session", "close", session]);
}

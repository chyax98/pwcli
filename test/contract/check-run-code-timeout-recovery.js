import { runPwJsonSync, runPwSync, uniqueSessionName } from "./_helpers.js";

const session = uniqueSessionName("rcto");

try {
  const page =
    "data:text/html,<main><h1 id='title'>timeout recovery</h1><button id='done' onclick='document.body.dataset.done=1'>Done</button></main>";
  const created = runPwJsonSync(["session", "create", session, "--no-headed", "--open", page]);
  if (!created.data.ok) {
    throw new Error(`session create failed: ${created.result.stdout}`);
  }

  const startedAt = Date.now();
  const timedOut = runPwJsonSync(
    ["code", "--session", session, "async page => await new Promise(() => {})"],
    { timeout: 40_000 },
  );
  const elapsedMs = Date.now() - startedAt;
  if (timedOut.result.error || timedOut.result.signal) {
    throw new Error(
      `code command did not exit after RUN_CODE_TIMEOUT: elapsedMs=${elapsedMs} signal=${timedOut.result.signal} error=${timedOut.result.error?.message}`,
    );
  }
  if (
    timedOut.result.status === 0 ||
    timedOut.data.ok ||
    timedOut.data.error?.message?.includes("RUN_CODE_TIMEOUT") !== true
  ) {
    throw new Error(
      `code command did not return RUN_CODE_TIMEOUT envelope: ${timedOut.result.stdout}`,
    );
  }
  if (elapsedMs > 32_000) {
    throw new Error(
      `code command returned too late after RUN_CODE_TIMEOUT: elapsedMs=${elapsedMs}`,
    );
  }

  const pageCurrent = runPwJsonSync(["page", "current", "--session", session]);
  if (!pageCurrent.data.ok || pageCurrent.data.data?.pageCount !== 1) {
    throw new Error(
      `page current did not recover after RUN_CODE_TIMEOUT: ${pageCurrent.result.stdout}`,
    );
  }

  const status = runPwJsonSync(["status", "--session", session]);
  if (!status.data.ok || status.data.data?.summary?.pageCount !== 1) {
    throw new Error(`status did not recover after RUN_CODE_TIMEOUT: ${status.result.stdout}`);
  }

  const digest = runPwJsonSync(["diagnostics", "digest", "--session", session]);
  if (!digest.data.ok || digest.data.data?.summary?.pageCount !== 1) {
    throw new Error(
      `diagnostics digest did not recover after RUN_CODE_TIMEOUT: ${digest.result.stdout}`,
    );
  }

  const clicked = runPwJsonSync(["click", "--session", session, "--selector", "#done"]);
  if (!clicked.data.ok) {
    throw new Error(`click did not recover after RUN_CODE_TIMEOUT: ${clicked.result.stdout}`);
  }

  const verified = runPwJsonSync([
    "code",
    "--session",
    session,
    "async page => JSON.stringify(await page.evaluate(() => document.body.dataset.done || ''))",
  ]);
  if (!verified.data.ok || String(verified.data.data?.result) !== "1") {
    throw new Error(`short code did not recover after RUN_CODE_TIMEOUT: ${verified.result.stdout}`);
  }
} finally {
  runPwSync(["session", "close", session], { stdio: "ignore" });
}

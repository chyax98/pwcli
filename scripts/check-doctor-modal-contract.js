import { spawnSync } from "node:child_process";

const session = `docmod${Date.now().toString(36).slice(-6)}`;
const cli = ["node", "dist/cli.js"];

function run(args, options = {}) {
  const result = spawnSync(cli[0], [...cli.slice(1), ...args], {
    encoding: "utf8",
    ...options,
  });
  return result;
}

function json(args) {
  const result = run([...args, "--output", "json"]);
  const text = result.stdout || result.stderr;
  try {
    return { result, data: JSON.parse(text) };
  } catch {
    throw new Error(`Expected JSON from ${args.join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

try {
  const page = "data:text/html,<button id='b' onclick='alert(1)'>open</button>";
  const created = json(["session", "create", session, "--no-headed", "--open", page]);
  if (!created.data.ok) throw new Error(`session create failed: ${created.result.stdout}`);

  const clicked = json(["click", "-s", session, "--selector", "#b"]);
  if (!clicked.data.ok || clicked.data.data?.blockedState !== "MODAL_STATE_BLOCKED") {
    throw new Error(`click did not surface modal blocked state: ${clicked.result.stdout}`);
  }

  const pageCurrent = json(["page", "current", "-s", session]);
  if (pageCurrent.data.ok || pageCurrent.data.error?.code !== "MODAL_STATE_BLOCKED") {
    throw new Error(`page current did not fail with MODAL_STATE_BLOCKED: ${pageCurrent.result.stdout}`);
  }

  const doctor = json(["doctor", "-s", session]);
  const diagnostics = doctor.data.data?.diagnostics ?? [];
  if (!doctor.data.ok || !diagnostics.some((item) => item.kind === "modal-state") || doctor.data.data?.recovery?.blocked !== true) {
    throw new Error(`doctor did not report modal-state recovery: ${doctor.result.stdout}`);
  }
} finally {
  run(["dialog", "dismiss", "-s", session], { stdio: "ignore" });
  run(["session", "close", session], { stdio: "ignore" });
}

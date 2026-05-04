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

function dataUrl(html) {
  return `data:text/html,${encodeURIComponent(html)}`;
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

  run(["dialog", "dismiss", "-s", session], { stdio: "ignore" });

  const confirmPage = dataUrl(`
    <button id="confirm" onclick="document.querySelector('#result').textContent = confirm('sure?') ? 'yes' : 'no'">confirm</button>
    <div id="result"></div>
  `);
  const recreatedConfirm = json(["session", "recreate", session, "--no-headed", "--open", confirmPage]);
  if (!recreatedConfirm.data.ok) throw new Error(`session recreate confirm failed: ${recreatedConfirm.result.stdout}`);
  const confirmClick = json(["click", "-s", session, "--selector", "#confirm"]);
  if (!confirmClick.data.ok || confirmClick.data.data?.blockedState !== "MODAL_STATE_BLOCKED") {
    throw new Error(`confirm click did not surface modal blocked state: ${confirmClick.result.stdout}`);
  }
  const confirmDismiss = json(["dialog", "dismiss", "-s", session]);
  if (!confirmDismiss.data.ok || confirmDismiss.data.data?.handled !== true) {
    throw new Error(`confirm dialog dismiss failed: ${confirmDismiss.result.stdout}`);
  }
  const confirmResult = json(["get", "text", "-s", session, "--selector", "#result"]);
  if (confirmResult.data.data?.value !== "no") {
    throw new Error(`confirm dismiss result mismatch: ${confirmResult.result.stdout}`);
  }

  const promptPage = dataUrl(`
    <button id="prompt" onclick="document.querySelector('#result').textContent = prompt('name?', 'x') || ''">prompt</button>
    <div id="result"></div>
  `);
  const recreatedPrompt = json(["session", "recreate", session, "--no-headed", "--open", promptPage]);
  if (!recreatedPrompt.data.ok) throw new Error(`session recreate prompt failed: ${recreatedPrompt.result.stdout}`);
  const promptClick = json(["click", "-s", session, "--selector", "#prompt"]);
  if (!promptClick.data.ok || promptClick.data.data?.blockedState !== "MODAL_STATE_BLOCKED") {
    throw new Error(`prompt click did not surface modal blocked state: ${promptClick.result.stdout}`);
  }
  const promptAccept = json(["dialog", "accept", "Codex", "-s", session]);
  if (!promptAccept.data.ok || promptAccept.data.data?.handled !== true || promptAccept.data.data?.prompt !== "Codex") {
    throw new Error(`prompt dialog accept failed: ${promptAccept.result.stdout}`);
  }
  const promptResult = json(["get", "text", "-s", session, "--selector", "#result"]);
  if (promptResult.data.data?.value !== "Codex") {
    throw new Error(`prompt accept result mismatch: ${promptResult.result.stdout}`);
  }

  const htmlModalPage = dataUrl(`
    <button id="open" onclick="document.querySelector('#modal').hidden=false">open modal</button>
    <div id="modal" hidden role="dialog" aria-modal="true">
      <p>Custom HTML modal</p>
      <button id="close" onclick="document.querySelector('#modal').hidden=true">Close modal</button>
    </div>
  `);
  const recreatedHtmlModal = json(["session", "recreate", session, "--no-headed", "--open", htmlModalPage]);
  if (!recreatedHtmlModal.data.ok) throw new Error(`session recreate html modal failed: ${recreatedHtmlModal.result.stdout}`);
  const openedModal = json(["click", "-s", session, "--selector", "#open"]);
  if (!openedModal.data.ok) throw new Error(`html modal open failed: ${openedModal.result.stdout}`);
  const htmlDoctor = json(["doctor", "-s", session]);
  const htmlDiagnostics = htmlDoctor.data.data?.diagnostics ?? [];
  if (!htmlDoctor.data.ok || !htmlDiagnostics.some((item) => item.kind === "html-modal") || htmlDoctor.data.data?.recovery?.kind !== "html-modal") {
    throw new Error(`doctor did not report html-modal recovery: ${htmlDoctor.result.stdout}`);
  }
  const closedModal = json(["click", "-s", session, "--selector", "#close"]);
  if (!closedModal.data.ok) throw new Error(`html modal close failed: ${closedModal.result.stdout}`);
  const recoveredDoctor = json(["doctor", "-s", session]);
  if ((recoveredDoctor.data.data?.diagnostics ?? []).some((item) => item.kind === "html-modal")) {
    throw new Error(`doctor still reports html-modal after close: ${recoveredDoctor.result.stdout}`);
  }
} finally {
  run(["dialog", "dismiss", "-s", session], { stdio: "ignore" });
  run(["session", "close", session], { stdio: "ignore" });
}

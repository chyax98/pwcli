export const DIAGNOSTICS_STATE_KEY = "__pwcliDiagnostics";
export const MODAL_STATE_BLOCKED_MARKER =
  'Tool "browser_run_code" does not handle the modal state.';

export function maybeRawOutput(text: string) {
  return process.env.PWCLI_RAW_OUTPUT === "1" ? { output: text } : {};
}

export function normalizeRef(ref: string) {
  return ref.startsWith("@") ? ref.slice(1) : ref;
}

export function isModalStateBlockedMessage(message: string) {
  return message === "MODAL_STATE_BLOCKED" || message.includes(MODAL_STATE_BLOCKED_MARKER);
}

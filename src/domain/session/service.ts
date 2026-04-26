export {
  DEFAULT_SESSION_NAME,
  ensureManagedSession,
  getManagedSessionEntry,
  getManagedSessionStatus,
  listManagedSessions,
  runManagedSessionCommand,
  stopManagedSession,
} from "../../infra/playwright/cli-client.js";
export { managedOpen, managedResize } from "../../infra/playwright/runtime.js";
export {
  applySessionDefaults,
  DEFAULT_SESSION_DEFAULTS,
  getSessionDefaults,
  resolveLifecycleHeaded,
  resolveTraceEnabled,
} from "./defaults.js";

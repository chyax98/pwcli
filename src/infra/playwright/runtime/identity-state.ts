export {
  type AuthProbeCapability,
  type AuthProbeConfidence,
  type AuthProbeBlockedState,
  type AuthProbeOptions,
  type AuthProbeRecommendedAction,
  type AuthProbeStatus,
  managedAuthProbe,
} from "./identity-state/auth-probe.js";

export {
  type StateDiffOptions,
  type StateDiffSnapshot,
  managedStateDiff,
  managedStateLoad,
  managedStateSave,
} from "./identity-state/state-diff.js";

export {
  managedCookiesList,
  managedCookiesSet,
  managedStorageIndexedDbExport,
  managedStorageMutation,
  managedStorageRead,
} from "./identity-state/storage.js";

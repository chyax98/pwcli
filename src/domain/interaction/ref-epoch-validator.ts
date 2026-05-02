export type RefEpochValidation =
  | {
      ok: true;
      ref: string;
      snapshotId: string;
      pageId: string | null;
      navigationId: string | null;
    }
  | {
      ok: false;
      code: "REF_STALE";
      ref: string;
      reason: "missing-snapshot" | "missing-ref" | "page-changed" | "navigation-changed";
      snapshotId?: string;
      snapshotPageId?: string | null;
      snapshotNavigationId?: string | null;
      currentPageId?: string | null;
      currentNavigationId?: string | null;
      currentUrl?: string;
    };

const VALID_REASONS = new Set([
  "missing-snapshot",
  "missing-ref",
  "page-changed",
  "navigation-changed",
]);

export function parseRefEpochValidation(raw: unknown): RefEpochValidation {
  if (raw !== null && typeof raw === "object" && (raw as Record<string, unknown>).ok === true) {
    return raw as RefEpochValidation & { ok: true };
  }
  const obj = (raw !== null && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const reason = VALID_REASONS.has(String(obj.reason))
    ? (obj.reason as RefEpochValidation & { ok: false })["reason"]
    : "missing-snapshot";
  return {
    ...(obj as object),
    ok: false,
    code: "REF_STALE",
    ref: typeof obj.ref === "string" ? obj.ref : "",
    reason,
  } as RefEpochValidation & { ok: false };
}

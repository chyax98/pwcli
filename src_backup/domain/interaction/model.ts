export type SelectorTarget = {
  selector: string;
  nth: number;
};

export type SemanticTarget =
  | { kind: "role"; role: string; name?: string; nth?: number }
  | { kind: "text"; text: string; nth?: number }
  | { kind: "label"; label: string; nth?: number }
  | { kind: "placeholder"; placeholder: string; nth?: number }
  | { kind: "testid"; testid: string; nth?: number };

export type NormalizedSemanticTarget = SemanticTarget & { nth: number };

export function normalizeSemanticTarget(target: SemanticTarget): NormalizedSemanticTarget {
  return {
    ...target,
    nth: Math.max(1, Math.floor(Number(target.nth ?? 1))),
  };
}

export function semanticLocatorExpression(target: NormalizedSemanticTarget): string {
  return target.kind === "role"
    ? `page.getByRole(${JSON.stringify(target.role)}, ${
        target.name ? `{ name: ${JSON.stringify(target.name)}, exact: false }` : "undefined"
      })`
    : target.kind === "text"
      ? `page.getByText(${JSON.stringify(target.text)}, { exact: false })`
      : target.kind === "label"
        ? `page.getByLabel(${JSON.stringify(target.label)}, { exact: false })`
        : target.kind === "placeholder"
          ? `page.getByPlaceholder(${JSON.stringify(target.placeholder)}, { exact: false })`
          : `page.getByTestId(${JSON.stringify((target as { kind: "testid"; testid: string; nth: number }).testid)})`;
}

export type RunEventTargetKind = "ref" | "selector" | "semantic" | "none";

export type RunEvent = {
  ts: string;
  command: string;
  sessionName: string | null;
  pageId: string | null;
  navigationId: string | null;
  targetKind: RunEventTargetKind;
  [key: string]: unknown;
};

export function buildRunEvent(
  command: string,
  sessionName: string | undefined,
  page: Record<string, unknown> | undefined,
  details: Record<string, unknown>,
  targetKind: RunEventTargetKind = "none",
): RunEvent {
  return {
    ts: new Date().toISOString(),
    command,
    sessionName: sessionName ?? null,
    pageId: typeof page?.pageId === "string" ? page.pageId : null,
    navigationId: typeof page?.navigationId === "string" ? page.navigationId : null,
    targetKind,
    ...details,
  };
}

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

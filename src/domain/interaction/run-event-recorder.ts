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

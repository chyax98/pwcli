import { appendFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function ensureRunDir(sessionName?: string) {
  const base = resolve(".pwcli", "runs");
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${sessionName ?? "no-session"}`;
  const runDir = join(base, runId);
  await mkdir(runDir, { recursive: true });
  return { runId, runDir };
}

export async function appendRunEvent(runDir: string, event: unknown) {
  await appendFile(join(runDir, "events.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}

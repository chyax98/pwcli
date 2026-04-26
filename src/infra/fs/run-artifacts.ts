import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
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

export async function listRunDirs() {
  const base = resolve(".pwcli", "runs");
  try {
    const entries = await readdir(base, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

export async function readRunEvents(runId: string) {
  const file = join(resolve(".pwcli", "runs"), runId, "events.jsonl");
  const text = await readFile(file, "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

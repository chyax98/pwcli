import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type ControlStateRecord = {
  sessionName: string;
  state: "cli" | "human";
  actor: string;
  reason?: string | null;
  updatedAt: string;
};

function controlStateDir() {
  return resolve(".pwcli", "control");
}

function controlStatePath(sessionName: string) {
  return resolve(controlStateDir(), `${sessionName}.json`);
}

export async function writeControlState(record: ControlStateRecord) {
  await mkdir(controlStateDir(), { recursive: true });
  await writeFile(controlStatePath(record.sessionName), JSON.stringify(record, null, 2), "utf8");
}

export async function readControlState(sessionName: string): Promise<ControlStateRecord | null> {
  try {
    const text = await readFile(controlStatePath(sessionName), "utf8");
    return JSON.parse(text) as ControlStateRecord;
  } catch {
    return null;
  }
}

export async function clearControlState(sessionName: string) {
  await rm(controlStatePath(sessionName), { force: true });
}

function encodeSegment(value: string | null | undefined) {
  return encodeURIComponent(value ?? "");
}

export async function assertSessionAutomationControl(
  sessionName: string | undefined,
  command: string,
) {
  if (!sessionName) return;
  const current = await readControlState(sessionName);
  if (!current || current.state !== "human") return;
  throw new Error(
    `SESSION_HUMAN_CONTROLLED:${sessionName}:${encodeSegment(current.actor)}:${encodeSegment(
      current.reason ?? "",
    )}:${encodeSegment(command)}`,
  );
}

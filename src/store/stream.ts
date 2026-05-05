import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type StreamSessionRecord = {
  sessionName: string;
  pid: number;
  url: string;
  port: number;
  startedAt: string;
};

function streamDir() {
  return resolve(".pwcli", "streams");
}

function streamPath(sessionName: string) {
  return resolve(streamDir(), `${sessionName}.json`);
}

export async function writeStreamRecord(record: StreamSessionRecord) {
  await mkdir(streamDir(), { recursive: true });
  await writeFile(streamPath(record.sessionName), JSON.stringify(record, null, 2), "utf8");
}

export async function readStreamRecord(sessionName: string): Promise<StreamSessionRecord | null> {
  try {
    const text = await readFile(streamPath(sessionName), "utf8");
    return JSON.parse(text) as StreamSessionRecord;
  } catch {
    return null;
  }
}

export async function removeStreamRecord(sessionName: string) {
  await rm(streamPath(sessionName), { force: true });
}

export async function hasStreamRecord(sessionName: string) {
  try {
    await stat(streamPath(sessionName));
    return true;
  } catch {
    return false;
  }
}

import { type ChildProcess, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand } from "citty";
import { readStreamRecord, removeStreamRecord } from "#store/stream.js";
import { bool, type CliArgs, print, printError, session, withCliError } from "./_helpers.js";

const OBSERVE_MS = 1200;
const streamServerPath = resolve(dirname(fileURLToPath(import.meta.url)), "../stream-server.js");

async function observe(child: ChildProcess) {
  return await new Promise<Error | null>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.off("error", onError);
        child.off("exit", onExit);
        resolve(null);
      }
    }, OBSERVE_MS);
    const onError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(error);
    };
    const onExit = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(new Error("stream server exited during startup"));
    };
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

async function isHealthy(url: string) {
  try {
    const response = await fetch(new URL("/_health", url));
    return response.ok;
  } catch {
    return false;
  }
}

export const streamStartCommand = defineCommand({
  meta: {
    name: "start",
    description:
      "Purpose: start a local read-only preview stream for one session.\nExamples:\n  pw stream start -s task-a\n  pw stream start -s task-a --port 4110\nNotes: use this for human observation; CLI remains the automation control path.",
  },
  args: {
    session: {
      type: "string",
      alias: "s",
      description: "Target managed session",
      valueHint: "name",
    },
    output: { type: "string", description: "Output format: text|json", default: "text" },
    port: { type: "string", description: "Port override (default: random)", valueHint: "n" },
    "dry-run": { type: "boolean", description: "Validate command without launching" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    const sessionName = session(a);
    if (bool(a["dry-run"])) {
      print("stream start", { data: { sessionName, launchable: true } }, a);
      return;
    }
    try {
      const child = spawn(
        process.execPath,
        [streamServerPath, sessionName, typeof a.port === "string" ? a.port : "0"],
        {
          detached: true,
          stdio: "ignore",
          cwd: process.cwd(),
        },
      );
      const startupError = await observe(child);
      if (startupError) {
        printError("stream start", a, {
          code: "STREAM_START_FAILED",
          message: startupError.message,
        });
        return;
      }
      child.unref();
      for (let i = 0; i < 20; i += 1) {
        const record = await readStreamRecord(sessionName);
        if (record && (await isHealthy(record.url))) {
          print("stream start", { data: { started: true, ...record } }, a);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      printError("stream start", a, {
        code: "STREAM_START_TIMEOUT",
        message: "stream server did not become healthy in time",
      });
    } catch (error) {
      withCliError("stream start", a, error, "stream start failed");
    }
  },
});

export const streamStatusCommand = defineCommand({
  meta: {
    name: "status",
    description:
      "Purpose: show local preview stream status for a session.\nExamples:\n  pw stream status -s task-a\nNotes: status reports the registered stream URL and health.",
  },
  args: {
    session: {
      type: "string",
      alias: "s",
      description: "Target managed session",
      valueHint: "name",
    },
    output: { type: "string", description: "Output format: text|json", default: "text" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    const record = await readStreamRecord(session(a));
    if (!record) {
      printError("stream status", a, {
        code: "STREAM_NOT_RUNNING",
        message: "no local preview stream is registered for this session",
      });
      return;
    }
    print("stream status", { data: { ...record, healthy: await isHealthy(record.url) } }, a);
  },
});

export const streamStopCommand = defineCommand({
  meta: {
    name: "stop",
    description:
      "Purpose: stop the local preview stream for a session.\nExamples:\n  pw stream stop -s task-a\nNotes: stopping preview does not close the browser session.",
  },
  args: {
    session: {
      type: "string",
      alias: "s",
      description: "Target managed session",
      valueHint: "name",
    },
    output: { type: "string", description: "Output format: text|json", default: "text" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    const record = await readStreamRecord(session(a));
    if (!record) {
      printError("stream stop", a, {
        code: "STREAM_NOT_RUNNING",
        message: "no local preview stream is registered for this session",
      });
      return;
    }
    try {
      if (record.pid) process.kill(record.pid, "SIGTERM");
    } catch {
      // ignore stale pid
    }
    await removeStreamRecord(record.sessionName);
    print("stream stop", { data: { stopped: true, sessionName: record.sessionName } }, a);
  },
});

export default defineCommand({
  meta: {
    name: "stream",
    description:
      "Purpose: manage a local read-only preview stream for an active session.\nExamples:\n  pw stream start -s task-a\n  pw stream status -s task-a\nNotes: stream is for human observation; it does not replace CLI actions, facts, waits, or diagnostics.",
  },
  subCommands: {
    start: streamStartCommand,
    status: streamStatusCommand,
    stop: streamStopCommand,
  },
});

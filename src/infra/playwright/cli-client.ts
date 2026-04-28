import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const playwrightCoreRoot = dirname(require.resolve("playwright-core/package.json"));

const sessionModule = require(join(playwrightCoreRoot, "lib/tools/cli-client/session.js"));
const registryModule = require(join(playwrightCoreRoot, "lib/tools/cli-client/registry.js"));

const { Session } = sessionModule;
const { Registry, createClientInfo, resolveSessionName } = registryModule;

export const DEFAULT_SESSION_NAME = "default";
export const MAX_SESSION_NAME_LENGTH = 16;

type ManagedSessionConfig = {
  name?: string;
  socketPath: string;
  version?: string;
  workspaceDir?: string;
  cli?: {
    persistent?: boolean;
  };
  browser?: {
    launchOptions?: {
      headless?: boolean;
    };
    userDataDir?: string;
  };
};

type ManagedSessionEntry = {
  file: string;
  daemonDir: string;
  config: ManagedSessionConfig;
};

function normalizeSessionName(name?: string) {
  return resolveSessionName(name ?? DEFAULT_SESSION_NAME);
}

export function validateSessionName(name?: string) {
  const sessionName = normalizeSessionName(name);
  if (sessionName.length > MAX_SESSION_NAME_LENGTH) {
    throw new Error(`SESSION_NAME_TOO_LONG:${sessionName}:${MAX_SESSION_NAME_LENGTH}`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionName)) {
    throw new Error(`SESSION_NAME_INVALID:${sessionName}`);
  }
  return sessionName;
}

async function loadRegistry() {
  return await Registry.load();
}

async function withSuppressedConsole<T>(fn: () => Promise<T>) {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

let playwrightOutputEnvLock: Promise<void> = Promise.resolve();

async function withPwcliPlaywrightOutput<T>(outputDir: string, fn: () => Promise<T>) {
  const previousLock = playwrightOutputEnvLock;
  let releaseLock!: () => void;
  playwrightOutputEnvLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;

  const previousOutputDir = process.env.PLAYWRIGHT_MCP_OUTPUT_DIR;
  process.env.PLAYWRIGHT_MCP_OUTPUT_DIR = outputDir;
  try {
    return await fn();
  } finally {
    if (previousOutputDir === undefined) {
      delete process.env.PLAYWRIGHT_MCP_OUTPUT_DIR;
    } else {
      process.env.PLAYWRIGHT_MCP_OUTPUT_DIR = previousOutputDir;
    }
    releaseLock();
  }
}

async function getSessionEntry(sessionName?: string) {
  const clientInfo = createClientInfo();
  const registry = await loadRegistry();
  const resolvedSessionName = validateSessionName(sessionName);
  const entry = registry.entry(clientInfo, resolvedSessionName) as ManagedSessionEntry | undefined;
  return {
    clientInfo,
    registry,
    sessionName: resolvedSessionName,
    entry,
  };
}

export async function getManagedSessionEntry(sessionName?: string) {
  const { sessionName: resolvedSessionName, entry } = await getSessionEntry(sessionName);
  if (!entry) {
    return null;
  }
  return {
    name: resolvedSessionName,
    file: entry.file,
    daemonDir: entry.daemonDir,
    config: entry.config,
  };
}

export async function listManagedSessions() {
  const clientInfo = createClientInfo();
  const registry = await loadRegistry();
  const entries = registry.entries(clientInfo);
  return await Promise.all(
    entries.map(async (entry) => {
      const session = new Session(entry);
      return {
        name: entry.config.name,
        socketPath: entry.config.socketPath,
        version: entry.config.version,
        workspaceDir: entry.config.workspaceDir,
        alive: await session.canConnect(),
      };
    }),
  );
}

export async function getManagedSessionStatus(sessionName?: string) {
  const { sessionName: resolvedSessionName, entry } = await getSessionEntry(sessionName);
  if (!entry) {
    return null;
  }

  const session = new Session(entry);
  const alive = await session.canConnect();

  return {
    name: resolvedSessionName,
    socketPath: entry.config.socketPath,
    version: entry.config.version,
    workspaceDir: entry.config.workspaceDir,
    alive,
  };
}

export async function ensureManagedSession(options?: {
  sessionName?: string;
  headed?: boolean;
  reset?: boolean;
  profile?: string;
  persistent?: boolean;
  endpoint?: string;
  createIfMissing?: boolean;
}) {
  const { clientInfo, registry, sessionName, entry } = await getSessionEntry(options?.sessionName);

  if (entry && options?.reset) {
    await new Session(entry).stop(true);
  }

  if (!entry && !options?.createIfMissing && !options?.reset) {
    throw new Error(`SESSION_NOT_FOUND:${sessionName}`);
  }

  const nextEntry =
    options?.reset || !entry
      ? await (async () => {
          await withPwcliPlaywrightOutput(
            resolve(clientInfo.workspaceDir ?? process.cwd(), ".pwcli", "playwright"),
            () => withSuppressedConsole(() =>
              Session.startDaemon(clientInfo, {
                _: ["open"],
                headed: Boolean(options?.headed),
                session: sessionName,
                ...(options?.profile ? { profile: options.profile } : {}),
                ...(options?.persistent ? { persistent: true } : {}),
                ...(options?.endpoint ? { endpoint: options.endpoint } : {}),
              }),
            ),
          );
          return await registry.loadEntry(clientInfo, sessionName);
        })()
      : entry;

  return {
    clientInfo,
    sessionName,
    session: new Session(nextEntry),
  };
}

export async function runManagedSessionCommand(
  args: Record<string, unknown>,
  options?: {
    sessionName?: string;
    headed?: boolean;
    reset?: boolean;
    profile?: string;
    persistent?: boolean;
    endpoint?: string;
    createIfMissing?: boolean;
  },
) {
  const { clientInfo, sessionName, session } = await ensureManagedSession(options);
  const text = await session.run(clientInfo, {
    ...args,
  });
  return {
    sessionName,
    text: text.text,
  };
}

export async function stopManagedSession(sessionName?: string) {
  const { entry } = await getSessionEntry(sessionName);
  if (!entry) {
    return false;
  }
  await new Session(entry).stop(true);
  return true;
}

export async function stopAllManagedSessions() {
  const sessions = await listManagedSessions();
  const results = [];

  for (const session of sessions) {
    const closed = await stopManagedSession(session.name).catch(() => false);
    results.push({
      name: session.name,
      alive: session.alive,
      closed,
    });
  }

  return {
    count: results.length,
    closedCount: results.filter((item) => item.closed).length,
    sessions: results,
  };
}

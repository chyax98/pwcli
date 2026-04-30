import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const playwrightCoreRoot = dirname(require.resolve("playwright-core/package.json"));

const sessionModule = require(join(playwrightCoreRoot, "lib/tools/cli-client/session.js"));
const registryModule = require(join(playwrightCoreRoot, "lib/tools/cli-client/registry.js"));
const serverRegistryModule = require(join(playwrightCoreRoot, "lib/serverRegistry.js"));

const { Session } = sessionModule;
const { Registry, createClientInfo, resolveSessionName } = registryModule;
const { serverRegistry } = serverRegistryModule;

export const DEFAULT_SESSION_NAME = "default";
export const MAX_SESSION_NAME_LENGTH = 16;
const SESSION_LOCK_TIMEOUT_MS = Number(process.env.PWCLI_SESSION_LOCK_TIMEOUT_MS ?? 120_000);
const SESSION_LOCK_STALE_MS = Number(process.env.PWCLI_SESSION_LOCK_STALE_MS ?? 600_000);

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

type PlaywrightBrowserServerDescriptor = {
  title?: string;
  playwrightVersion?: string;
  workspaceDir?: string;
  canConnect?: boolean;
  endpoint?: string;
  pipeName?: string;
  browser?: {
    guid?: string;
    browserName?: string;
    userDataDir?: string;
  };
};

export type AttachableBrowserServer = {
  id: string;
  title: string;
  browserName?: string;
  workspaceDir?: string;
  userDataDir?: string;
  endpoint?: string;
  pipeName?: string;
  canConnect: boolean;
  playwrightVersion?: string;
};

export type AttachableBrowserServerList = {
  supported: boolean;
  count: number;
  servers: AttachableBrowserServer[];
  limitation?: string;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid: unknown) {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readLockOwner(lockDir: string) {
  try {
    return JSON.parse(await readFile(join(lockDir, "owner.json"), "utf8")) as {
      pid?: number;
      token?: string;
      acquiredAt?: string;
    };
  } catch {
    return null;
  }
}

async function isStaleSessionLock(lockDir: string) {
  const owner = await readLockOwner(lockDir);
  if (owner?.pid && isProcessAlive(owner.pid)) {
    return false;
  }
  if (owner?.pid && !isProcessAlive(owner.pid)) {
    return true;
  }
  try {
    const info = await stat(lockDir);
    return Date.now() - info.mtimeMs > SESSION_LOCK_STALE_MS;
  } catch {
    return true;
  }
}

async function withSessionCommandLock<T>(
  workspaceDir: string | undefined,
  sessionName: string,
  fn: () => Promise<T>,
) {
  const root = resolve(workspaceDir ?? process.cwd(), ".pwcli", "locks");
  const lockDir = join(root, `${sessionName}.lock`);
  const token = randomUUID();
  const startedAt = Date.now();

  await mkdir(root, { recursive: true });

  while (true) {
    try {
      await mkdir(lockDir);
      await writeFile(
        join(lockDir, "owner.json"),
        JSON.stringify(
          {
            pid: process.pid,
            token,
            sessionName,
            acquiredAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      break;
    } catch (error) {
      const code = error && typeof error === "object" ? (error as { code?: string }).code : "";
      if (code !== "EEXIST") {
        throw error;
      }
      if (await isStaleSessionLock(lockDir)) {
        await rm(lockDir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - startedAt > SESSION_LOCK_TIMEOUT_MS) {
        throw new Error(`SESSION_BUSY:${sessionName}:${SESSION_LOCK_TIMEOUT_MS}`);
      }
      await sleep(50 + Math.floor(Math.random() * 100));
    }
  }

  try {
    return await fn();
  } finally {
    const owner = await readLockOwner(lockDir);
    if (owner?.token === token) {
      await rm(lockDir, { recursive: true, force: true });
    }
  }
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

export async function listAttachableBrowserServers(): Promise<AttachableBrowserServerList> {
  if (!serverRegistry || typeof serverRegistry.list !== "function") {
    return {
      supported: false,
      count: 0,
      servers: [],
      limitation: "Playwright server registry is not available in this playwright-core build.",
    };
  }

  const clientInfo = createClientInfo();
  const currentWorkspaceDir = clientInfo.workspaceDir ?? process.cwd();
  const entries = (await serverRegistry.list()) as Map<string, PlaywrightBrowserServerDescriptor[]>;
  const servers: AttachableBrowserServer[] = [];

  for (const [workspaceDir, descriptors] of entries) {
    if (workspaceDir && workspaceDir !== currentWorkspaceDir) {
      continue;
    }
    for (const descriptor of descriptors) {
      const title = descriptor.title ?? descriptor.browser?.guid ?? "unknown";
      servers.push({
        id: descriptor.browser?.guid ?? title,
        title,
        browserName: descriptor.browser?.browserName,
        workspaceDir: descriptor.workspaceDir ?? (workspaceDir || undefined),
        userDataDir: descriptor.browser?.userDataDir,
        endpoint: descriptor.endpoint,
        pipeName: descriptor.pipeName,
        canConnect: Boolean(descriptor.canConnect),
        playwrightVersion: descriptor.playwrightVersion,
      });
    }
  }

  return {
    supported: true,
    count: servers.length,
    servers,
  };
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
            () =>
              withSuppressedConsole(() =>
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
    timeoutMs?: number;
    timeoutMessage?: string;
    timeoutCode?: string;
  },
) {
  const { clientInfo, sessionName, session } = await ensureManagedSession(options);
  const text = await withSessionCommandLock(clientInfo.workspaceDir, sessionName, async () => {
    const run = session.run(clientInfo, {
      ...args,
    });
    return options?.timeoutMs
      ? await withManagedSessionTimeout(run, {
          timeoutMs: options.timeoutMs,
          timeoutMessage: options.timeoutMessage,
          timeoutCode: options.timeoutCode,
        })
      : await run;
  });
  return {
    sessionName,
    text: text.text,
  };
}

async function withManagedSessionTimeout<T>(
  operation: Promise<T>,
  options: {
    timeoutMs: number;
    timeoutMessage?: string;
    timeoutCode?: string;
  },
) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const code = options.timeoutCode ?? "MANAGED_COMMAND_TIMEOUT";
          const message = options.timeoutMessage ?? "managed session command timed out";
          reject(new Error(`${code}:${message}`));
        }, options.timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
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

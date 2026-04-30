import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
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
const SESSION_LOCK_TIMEOUT_MS = positiveDurationEnv("PWCLI_SESSION_LOCK_TIMEOUT_MS", 120_000);
const SESSION_LOCK_STALE_MS = positiveDurationEnv("PWCLI_SESSION_LOCK_STALE_MS", 600_000);
const SESSION_STARTUP_LOCK_TIMEOUT_MS = positiveDurationEnv(
  "PWCLI_SESSION_STARTUP_LOCK_TIMEOUT_MS",
  0,
);
const SESSION_STARTUP_LOCK_STALE_MS = positiveDurationEnv(
  "PWCLI_SESSION_STARTUP_LOCK_STALE_MS",
  600_000,
);
const SESSION_STARTUP_LOCK_HOLD_MS = positiveDurationEnv("PWCLI_SESSION_STARTUP_LOCK_HOLD_MS", 0);

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
      args?: string[];
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

type EnsureManagedSessionOptions = {
  sessionName?: string;
  headed?: boolean;
  reset?: boolean;
  profile?: string;
  persistent?: boolean;
  endpoint?: string;
  createIfMissing?: boolean;
  config?: string;
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

type SessionLockHandle = {
  lockDir: string;
  token: string;
};

function positiveDurationEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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

async function releaseSessionCommandLock(lockDir: string, token: string) {
  const owner = await readLockOwner(lockDir);
  if (owner?.token === token) {
    await rm(lockDir, { recursive: true, force: true });
  }
}

const heldSessionStartupLocks = new Map<string, SessionLockHandle>();
let sessionStartupCleanupRegistered = false;

function sessionStartupLockKey(workspaceDir: string | undefined, sessionName: string) {
  return `${resolve(workspaceDir ?? process.cwd())}:${sessionName}`;
}

function registerSessionStartupCleanup() {
  if (sessionStartupCleanupRegistered) {
    return;
  }
  sessionStartupCleanupRegistered = true;
  process.once("exit", () => {
    for (const { lockDir } of heldSessionStartupLocks.values()) {
      rmSync(lockDir, { recursive: true, force: true });
    }
    heldSessionStartupLocks.clear();
  });
}

async function isStaleSessionLock(lockDir: string, staleMs: number) {
  const owner = await readLockOwner(lockDir);
  if (owner?.pid && isProcessAlive(owner.pid)) {
    return false;
  }
  if (owner?.pid && !isProcessAlive(owner.pid)) {
    return true;
  }
  try {
    const info = await stat(lockDir);
    return Date.now() - info.mtimeMs > staleMs;
  } catch {
    return true;
  }
}

async function acquireSessionLock(options: {
  workspaceDir: string | undefined;
  sessionName: string;
  namespace: string;
  timeoutMs: number;
  staleMs: number;
}) {
  const root = resolve(options.workspaceDir ?? process.cwd(), ".pwcli", "locks", options.namespace);
  const lockDir = join(root, `${options.sessionName}.lock`);
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
            sessionName: options.sessionName,
            acquiredAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      return { lockDir, token };
    } catch (error) {
      const code = error && typeof error === "object" ? (error as { code?: string }).code : "";
      if (code !== "EEXIST") {
        throw error;
      }
      const owner = await readLockOwner(lockDir);
      if (owner?.pid === process.pid) {
        return { lockDir, token: owner.token ?? token };
      }
      if (await isStaleSessionLock(lockDir, options.staleMs)) {
        await rm(lockDir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - startedAt > options.timeoutMs) {
        throw new Error(`SESSION_BUSY:${options.sessionName}:${options.timeoutMs}`);
      }
      await sleep(50 + Math.floor(Math.random() * 100));
    }
  }
}

async function withSessionCommandLock<T>(
  workspaceDir: string | undefined,
  sessionName: string,
  fn: (lock: { releaseAfter(operation: Promise<unknown>): void }) => Promise<T>,
) {
  const { lockDir, token } = await acquireSessionLock({
    workspaceDir,
    sessionName,
    namespace: "commands",
    timeoutMs: SESSION_LOCK_TIMEOUT_MS,
    staleMs: SESSION_LOCK_STALE_MS,
  });
  let deferredRelease: Promise<unknown> | undefined;

  try {
    return await fn({
      releaseAfter(operation) {
        deferredRelease = operation;
      },
    });
  } finally {
    if (deferredRelease) {
      void deferredRelease
        .catch(() => {})
        .finally(() => releaseSessionCommandLock(lockDir, token).catch(() => {}));
    } else {
      await releaseSessionCommandLock(lockDir, token);
    }
  }
}

async function withSessionStartupLock<T>(
  workspaceDir: string | undefined,
  sessionName: string,
  active: boolean,
  fn: () => Promise<T>,
) {
  if (!active) {
    return await fn();
  }

  const key = sessionStartupLockKey(workspaceDir, sessionName);
  if (heldSessionStartupLocks.has(key)) {
    return await fn();
  }

  const handle = await acquireSessionLock({
    workspaceDir,
    sessionName,
    namespace: "startup",
    timeoutMs: SESSION_STARTUP_LOCK_TIMEOUT_MS,
    staleMs: SESSION_STARTUP_LOCK_STALE_MS,
  });
  heldSessionStartupLocks.set(key, handle);
  registerSessionStartupCleanup();

  if (SESSION_STARTUP_LOCK_HOLD_MS > 0) {
    await sleep(SESSION_STARTUP_LOCK_HOLD_MS);
  }

  return await fn();
}

async function stopSessionEntry(entry: ManagedSessionEntry) {
  const session = new Session(entry);
  await session.stop(true);
  if (typeof session.deleteSessionConfig === "function") {
    await session.deleteSessionConfig();
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

async function ensureManagedSessionUnlocked(options?: EnsureManagedSessionOptions) {
  const { clientInfo, registry, sessionName, entry } = await getSessionEntry(options?.sessionName);

  if (entry && options?.reset) {
    await stopSessionEntry(entry);
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
                  ...(options?.config ? { config: options.config } : {}),
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

export async function ensureManagedSession(options?: EnsureManagedSessionOptions) {
  const { clientInfo, sessionName } = await getSessionEntry(options?.sessionName);
  return await withSessionStartupLock(
    clientInfo.workspaceDir,
    sessionName,
    Boolean(options?.reset || options?.createIfMissing),
    async () =>
      await withSessionCommandLock(clientInfo.workspaceDir, sessionName, async () => {
        return await ensureManagedSessionUnlocked(options);
      }),
  );
}

export async function runManagedSessionCommand(
  args: Record<string, unknown>,
  options?: EnsureManagedSessionOptions & {
    timeoutMs?: number;
    timeoutMessage?: string;
    timeoutCode?: string;
  },
) {
  const { clientInfo, sessionName } = await getSessionEntry(options?.sessionName);
  return await withSessionStartupLock(
    clientInfo.workspaceDir,
    sessionName,
    Boolean(options?.reset || options?.createIfMissing),
    async () =>
      await withSessionCommandLock(clientInfo.workspaceDir, sessionName, async (lock) => {
        const ensured = await ensureManagedSessionUnlocked(options);
        const { clientInfo: ensuredClientInfo, sessionName: ensuredSessionName, session } =
          ensured;
        const run = session.run(ensuredClientInfo, {
          ...args,
        });
        const text = options?.timeoutMs
          ? await withManagedSessionTimeout(run, {
              timeoutMs: options.timeoutMs,
              timeoutMessage: options.timeoutMessage,
              timeoutCode: options.timeoutCode,
              onTimeout: () => lock.releaseAfter(run),
            })
          : await run;
        return {
          sessionName: ensuredSessionName,
          text: text.text,
        };
      }),
  );
}

async function withManagedSessionTimeout<T>(
  operation: Promise<T>,
  options: {
    timeoutMs: number;
    timeoutMessage?: string;
    timeoutCode?: string;
    onTimeout?: () => void;
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
          options.onTimeout?.();
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
  const {
    clientInfo,
    sessionName: resolvedSessionName,
    entry,
  } = await getSessionEntry(sessionName);
  if (!entry) {
    return false;
  }
  await withSessionStartupLock(clientInfo.workspaceDir, resolvedSessionName, true, async () => {
    await withSessionCommandLock(clientInfo.workspaceDir, resolvedSessionName, async () => {
      await stopSessionEntry(entry);
    });
  });
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

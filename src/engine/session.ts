import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { mkdir, readdir, readFile, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { assertActionAllowed } from "#store/action-policy.js";
import { writeBootstrapConfig } from "#store/config.js";
import { assertSessionAutomationControl } from "#store/control-state.js";
import { buildAllowedDomainState, isUrlAllowed, normalizeAllowedDomains } from "./domain-guard.js";
import {
  DIAGNOSTICS_STATE_KEY,
  isModalStateBlockedMessage,
  managedRunCode,
  maybeRawOutput,
} from "./shared.js";
import { pageIdRuntimePrelude } from "./workspace.js";

const require = createRequire(import.meta.url);
const playwrightCoreRoot = dirname(require.resolve("playwright-core/package.json"));
const pwcliRuntimeDir = resolve(".pwcli");

process.env.PLAYWRIGHT_DAEMON_SESSION_DIR ??= join(pwcliRuntimeDir, "playwright-daemon");
process.env.PLAYWRIGHT_SERVER_REGISTRY ??= join(pwcliRuntimeDir, "playwright-registry");

const sessionModule = require(join(playwrightCoreRoot, "lib/tools/cli-client/session.js"));
const registryModule = require(join(playwrightCoreRoot, "lib/tools/cli-client/registry.js"));
const serverRegistryModule = require(join(playwrightCoreRoot, "lib/serverRegistry.js"));
const socketConnectionModule = require(
  join(playwrightCoreRoot, "lib/tools/utils/socketConnection.js"),
);

const { Session } = sessionModule;
const { Registry, createClientInfo, resolveSessionName } = registryModule;
const { serverRegistry } = serverRegistryModule;
const { SocketConnection } = socketConnectionModule;

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

function validateSessionName(name?: string) {
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
  fn: () => Promise<T>,
) {
  const { lockDir, token } = await acquireSessionLock({
    workspaceDir,
    sessionName,
    namespace: "commands",
    timeoutMs: SESSION_LOCK_TIMEOUT_MS,
    staleMs: SESSION_LOCK_STALE_MS,
  });
  try {
    return await fn();
  } finally {
    await releaseSessionCommandLock(lockDir, token);
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
  if (await session.canConnect().catch(() => false)) {
    await session
      .run(createClientInfo(), {
        _: ["run-code", "async page => { await page.context().close(); return 'context-closed'; }"],
      })
      .catch(() => {});
  }
  await session.stop(true).catch(() => {});
  if (typeof session.deleteSessionConfig === "function") {
    await session.deleteSessionConfig();
  }
  // Clean up user data dirs and error logs for this session
  const dirEntries = await readdir(entry.daemonDir).catch(() => [] as string[]);
  const name = entry.config.name;
  const leftovers = dirEntries.filter(
    (f) => f.startsWith(`ud-${name}-`) || f === `${name}.err` || f.startsWith(`stale${name}.`),
  );
  await Promise.all(
    leftovers.map((f) => rm(join(entry.daemonDir, f), { recursive: true }).catch(() => {})),
  );
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
    entries.map(async (entry: ManagedSessionEntry) => {
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
    createIfMissing?: boolean;
  },
) {
  const { clientInfo, sessionName } = await getSessionEntry(options?.sessionName);
  return await withSessionStartupLock(
    clientInfo.workspaceDir,
    sessionName,
    Boolean(options?.reset || options?.createIfMissing),
    async () =>
      await withSessionCommandLock(clientInfo.workspaceDir, sessionName, async () => {
        const ensured = await ensureManagedSessionUnlocked(options);
        const { clientInfo: ensuredClientInfo, sessionName: ensuredSessionName, session } = ensured;
        const text = options?.timeoutMs
          ? await runSessionCommandWithTimeout(
              session,
              ensuredClientInfo,
              { ...args },
              {
                timeoutMs: options.timeoutMs,
                timeoutMessage: options.timeoutMessage,
                timeoutCode: options.timeoutCode,
              },
            )
          : await session.run(ensuredClientInfo, { ...args });
        return {
          sessionName: ensuredSessionName,
          text: text.text,
        };
      }),
  );
}

async function runSessionCommandWithTimeout(
  session: typeof Session,
  clientInfo: ReturnType<typeof createClientInfo>,
  args: Record<string, unknown>,
  options: {
    timeoutMs: number;
    timeoutMessage?: string;
    timeoutCode?: string;
  },
) {
  if (!session.isCompatible(clientInfo)) {
    throw new Error(`Client is v${clientInfo.version}, session '${session.name}' is v${session.config.version}. Run

  playwright-cli${session.name !== "default" ? ` -s=${session.name}` : ""} open

to restart the browser session.`);
  }

  const { socket } = await session._connect();
  if (!socket) {
    throw new Error(`Browser '${session.name}' is not open. Run

  playwright-cli${session.name !== "default" ? ` -s=${session.name}` : ""} open

to start the browser session.`);
  }

  const connection = new SocketConnection(socket);
  let settled = false;
  let timer: NodeJS.Timeout | undefined;

  try {
    const responsePromise = new Promise<unknown>((resolve, reject) => {
      connection.onmessage = (message: { id?: number; error?: string; result?: unknown }) => {
        if (!message.id) {
          return;
        }
        settled = true;
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.result);
        }
      };
      connection.onclose = () => {
        if (!settled) {
          reject(new Error("Session closed"));
        }
      };
      timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        const code = options.timeoutCode ?? "MANAGED_COMMAND_TIMEOUT";
        const message = options.timeoutMessage ?? "managed session command timed out";
        connection.close();
        reject(new Error(`${code}:${message}`));
      }, options.timeoutMs);
    });
    const message = {
      id: 1,
      method: "run",
      params: { args, cwd: process.cwd() },
    };
    await connection.send(message);
    return (await responsePromise) as { text: string };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    connection.close();
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
  // Try to remove the workspace directory if it's now empty
  await rmdir(entry.daemonDir).catch(() => {});
  return true;
}

export async function stopAllManagedSessions() {
  const registry = await loadRegistry();
  const allEntries: ManagedSessionEntry[] = [];
  for (const entries of registry.entryMap().values()) {
    allEntries.push(...entries);
  }

  const results = [];
  for (const entry of allEntries) {
    const session = new Session(entry);
    const alive = await session.canConnect().catch(() => false);
    try {
      await stopSessionEntry(entry);
      results.push({ name: entry.config.name, alive, closed: true });
    } catch {
      results.push({ name: entry.config.name, alive, closed: false });
    }
  }

  // Clean up workspace directories: remove known artifacts (.err, stale-*)
  // then remove the directory only if it becomes empty
  const daemonDirs = new Set(allEntries.map((e) => e.daemonDir));
  for (const dir of daemonDirs) {
    const files = await readdir(dir).catch(() => [] as string[]);
    const leftovers = files.filter(
      (f) => f.endsWith(".err") || f.startsWith("stale-") || f.endsWith(".session"),
    );
    await Promise.all(leftovers.map((f) => rm(join(dir, f)).catch(() => {})));
    await rmdir(dir).catch(() => {});
  }

  // Clean up stale browser descriptors from server registry (~/Library/Caches/ms-playwright/b/)
  // serverRegistry.list() auto-deletes descriptors that can't connect AND have no userDataDir,
  // but descriptors with userDataDir survive. Clean those up too since all sessions are closed.
  if (serverRegistry && typeof serverRegistry.list === "function") {
    try {
      const entriesByWorkspace = (await serverRegistry.list()) as Map<
        string,
        { file: string; canConnect: boolean }[]
      >;
      for (const [, descriptors] of entriesByWorkspace) {
        for (const desc of descriptors) {
          if (desc.canConnect) continue;
          const guid = desc.file?.split("/").pop();
          if (!guid) continue;
          if (typeof serverRegistry.deleteUserData === "function") {
            await serverRegistry.deleteUserData(guid).catch(() => {});
          } else if (typeof serverRegistry.delete === "function") {
            await serverRegistry.delete(guid).catch(() => {});
          }
        }
      }
    } catch {}
  }

  return {
    count: results.length,
    closedCount: results.filter((item) => item.closed).length,
    sessions: results,
  };
}

function findSection(text: string, header: string) {
  const marker = `### ${header}\n`;
  const start = text.indexOf(marker);
  if (start === -1) {
    return "";
  }
  const next = text.indexOf("\n### ", start + marker.length);
  return text.slice(start + marker.length, next === -1 ? text.length : next).trim();
}

export function parsePageSummary(text: string) {
  const section = findSection(text, "Page");
  if (!section) {
    return undefined;
  }

  const urlMatch = section.match(/- Page URL: (.*)/);
  const titleMatch = section.match(/- Page Title: (.*)/);

  return {
    url: urlMatch?.[1] ?? "",
    title: titleMatch?.[1] ?? "",
  };
}

export function parseSnapshotYaml(text: string) {
  const section = findSection(text, "Snapshot");
  const codeBlock = section.match(/```yaml\n([\s\S]*?)```/);
  return codeBlock?.[1]?.trim() ?? "";
}

export function parseResultText(text: string) {
  const section = findSection(text, "Result");
  if (!section) {
    return "";
  }
  return section.trim();
}

export function parseErrorText(text: string) {
  const section = findSection(text, "Error");
  if (!section) {
    return "";
  }
  return section.trim();
}

export function parseEventLines(text: string) {
  const section = findSection(text, "Events");
  if (!section) {
    return [];
  }
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseDownloadEvent(text: string) {
  const line = parseEventLines(text).find((entry) => entry.startsWith("- Downloaded file "));
  if (!line) {
    return null;
  }
  const match = line.match(/^- Downloaded file (.+?) to "(.+)"$/);
  if (!match) {
    return null;
  }
  return {
    suggestedFilename: match[1],
    outputPath: match[2],
  };
}

export function stripQuotes(value: string) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseJsonStringLiteral(value: string) {
  let current = value;
  for (let i = 0; i < 2; i += 1) {
    if (typeof current !== "string") {
      return current;
    }
    try {
      current = JSON.parse(current);
    } catch {
      return current;
    }
  }

  try {
    return JSON.parse(current);
  } catch {
    return current;
  }
}

export async function managedOpen(
  url: string,
  options?: {
    sessionName?: string;
    headed?: boolean;
    reset?: boolean;
    profile?: string;
    persistent?: boolean;
    endpoint?: string;
    config?: string;
    timeoutMs?: number;
    timeoutMessage?: string;
    timeoutCode?: string;
    createIfMissing?: boolean;
    enforceActionPolicy?: boolean;
  },
) {
  if (options?.sessionName && options.enforceActionPolicy !== false) {
    await assertActionAllowed("navigate", "open");
    await assertSessionAutomationControl(options.sessionName, "open");
    const allowlist = await managedRunCode({
      sessionName: options.sessionName,
      source: `async page => {
        const context = page.context();
        const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] || {};
        return state.environment?.allowedDomains || null;
      }`,
    }).catch(() => null);
    const domains = Array.isArray(allowlist?.data?.result?.allowedDomains)
      ? normalizeAllowedDomains(allowlist.data.result.allowedDomains as string[])
      : [];
    if (domains.length > 0 && !isUrlAllowed(url, domains)) {
      throw new Error(`DOMAIN_NOT_ALLOWED:open:${url}`);
    }
  }
  const result = await runManagedSessionCommand(
    {
      _: ["goto", url],
    },
    {
      sessionName: options?.sessionName,
      headed: options?.headed,
      reset: options?.reset ?? true,
      profile: options?.profile,
      persistent: options?.persistent,
      endpoint: options?.endpoint,
      config: options?.config,
      createIfMissing: options?.createIfMissing ?? true,
      ...(options?.timeoutMs
        ? {
            timeoutMs: options.timeoutMs,
            timeoutMessage: options.timeoutMessage,
            timeoutCode: options.timeoutCode,
          }
        : {}),
    },
  );

  const page = parsePageSummary(result.text);
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName }).catch(() => {});
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page,
    data: {
      navigated: true,
      ...(options?.profile ? { profile: options.profile } : {}),
      ...(options?.persistent ? { persistent: true } : {}),
      ...(options?.endpoint ? { endpoint: options.endpoint } : {}),
      ...(options?.config ? { config: options.config } : {}),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedResize(options: {
  sessionName?: string;
  width: number;
  height: number;
  view?: string;
  preset?: string;
}) {
  const result = await runManagedSessionCommand(
    {
      _: ["resize", String(options.width), String(options.height)],
    },
    {
      sessionName: options.sessionName,
    },
  );

  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      width: options.width,
      height: options.height,
      ...(options.view ? { view: options.view } : {}),
      ...(options.preset ? { preset: options.preset } : {}),
      resized: true,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedBootstrapApply(options: {
  sessionName?: string;
  initScripts?: string[];
  headersFile?: string;
}) {
  const initScripts = options.initScripts?.map((file) => resolve(file)) ?? [];
  let headers: Record<string, string> | undefined;
  let headersFile: string | undefined;

  if (options.headersFile) {
    headersFile = resolve(options.headersFile);
    const parsed = JSON.parse(await readFile(headersFile, "utf8")) as Record<string, unknown>;
    headers = Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value)]),
    );
  }

  const scriptContents = await Promise.all(initScripts.map((file) => readFile(file, "utf8")));
  const source = `async page => {
    const context = page.context();
    const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
    ${headers ? `await context.setExtraHTTPHeaders(${JSON.stringify(headers)});` : ""}
    ${scriptContents
      .map((content) => `await context.addInitScript({ content: ${JSON.stringify(content)} });`)
      .join("\n    ")}
    state.bootstrap = {
      applied: true,
      updatedAt: new Date().toISOString(),
      initScriptCount: ${initScripts.length},
      initScripts: ${JSON.stringify(initScripts)},
      headersApplied: ${headers ? "true" : "false"},
      ${headersFile ? `headersFile: ${JSON.stringify(headersFile)},` : ""}
    };
    return JSON.stringify({
      applied: true,
      initScriptCount: ${initScripts.length},
      ${headers ? `headersApplied: true,` : `headersApplied: false,`}
      bootstrap: state.bootstrap,
    });
  }`;

  const result = await managedRunCode({
    sessionName: options.sessionName,
    source,
  });

  await writeBootstrapConfig(options.sessionName, {
    initScripts,
    ...(headersFile ? { headersFile } : {}),
    appliedAt: new Date().toISOString(),
  });

  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      applied: true,
      initScriptCount: initScripts.length,
      initScripts,
      ...(headersFile ? { headersFile } : {}),
      ...(headers ? { headersApplied: true } : {}),
      ...parsed,
    },
  };
}

export async function managedAllowedDomainsSet(options: {
  sessionName?: string;
  domains: string[];
}) {
  const allowedDomains = normalizeAllowedDomains(options.domains);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.environment = state.environment || {};
      state.environment.allowedDomains = ${JSON.stringify(buildAllowedDomainState(allowedDomains))};
      return state.environment.allowedDomains;
    }`,
  });
  return {
    session: result.session,
    page: result.page,
    data: {
      allowedDomains,
      updated: true,
      ...(result.data.result as Record<string, unknown>),
    },
  };
}

export async function managedAllowedDomainsStatus(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] || {};
      return state.environment?.allowedDomains || { allowedDomains: [], updatedAt: null };
    }`,
  });
  return {
    session: result.session,
    page: result.page,
    data: result.data.result as Record<string, unknown>,
  };
}

export async function managedAllowedDomainsClear(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.environment = state.environment || {};
      delete state.environment.allowedDomains;
      return { allowedDomains: [], cleared: true, updatedAt: new Date().toISOString() };
    }`,
  });
  return {
    session: result.session,
    page: result.page,
    data: result.data.result as Record<string, unknown>,
  };
}

export async function managedEnsureDiagnosticsHooks(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${pageIdRuntimePrelude()}

      const sessionName = ${JSON.stringify(options?.sessionName ?? null)};
      state.consoleRecords = Array.isArray(state.consoleRecords) ? state.consoleRecords : [];
      state.networkRecords = Array.isArray(state.networkRecords) ? state.networkRecords : [];
      state.pageErrorRecords = Array.isArray(state.pageErrorRecords) ? state.pageErrorRecords : [];
      state.dialogRecords = Array.isArray(state.dialogRecords) ? state.dialogRecords : [];
      state.nextRequestSeq = Number.isInteger(state.nextRequestSeq) ? state.nextRequestSeq : 1;
      state.nextConsoleResourceSeq = Number.isInteger(state.nextConsoleResourceSeq) ? state.nextConsoleResourceSeq : 1;
      state.nextDialogSeq = Number.isInteger(state.nextDialogSeq) ? state.nextDialogSeq : 1;
      state.sseRecords = Array.isArray(state.sseRecords) ? state.sseRecords : [];
      state.nextSseSeq = Number.isInteger(state.nextSseSeq) ? state.nextSseSeq : 1;

      const now = () => new Date().toISOString();
      const keep = (list, entry, max = 200) => {
        list.push(entry);
        if (list.length > max)
          list.splice(0, list.length - max);
      };
      const clipSnippet = (value, max = 240) => {
        const text = String(value ?? '');
        return {
          snippet: text.length > max ? text.slice(0, max) + '...' : text,
          truncated: text.length > max,
        };
      };
      const FULL_BODY_LIMIT = 50000;
      const clipBody = (value) => {
        const text = String(value ?? '');
        return {
          body: text.length > FULL_BODY_LIMIT ? text.slice(0, FULL_BODY_LIMIT) + '...' : text,
          truncated: text.length > FULL_BODY_LIMIT,
        };
      };
      const isTextLikeContentType = (value) => {
        const contentType = String(value || '').toLowerCase();
        return Boolean(
          contentType &&
            (
              contentType.startsWith('text/') ||
              contentType.includes('json') ||
              contentType.includes('xml') ||
              contentType.includes('javascript') ||
              contentType.includes('x-www-form-urlencoded') ||
              contentType.includes('svg')
            )
        );
      };
      const classifyConsoleSource = (text, location) => {
        const value = String(text || '');
        const url = String(location?.url || '');
        if (/Failed to load resource|\\b4\\d\\d\\b|\\b5\\d\\d\\b/.test(value))
          return 'api';
        if (/React|Warning:|Each child in a list should have a unique/.test(value))
          return 'react';
        if (/Mixed Content|Content Security Policy|CORS|net::|ERR_|deprecated/i.test(value))
          return 'browser';
        return 'app';
      };
      const parseConsoleHttpStatus = (text) => {
        const match = String(text || '').match(/(?:status of|status code|\\b)([45]\\d\\d)\\b/i);
        return match ? Number(match[1]) : null;
      };
      const installPage = (p) => {
        ensurePageId(p);
        ensureNavigationId(p);
        if (p.__pwcliDiagnosticsInstalled)
          return;
        p.__pwcliDiagnosticsInstalled = true;
        p.on('framenavigated', frame => {
          if (frame === p.mainFrame())
            p.__pwcliNavigationId = 'nav-' + state.nextNavigationSeq++;
        });
        p.on('console', msg => {
          const location = typeof msg.location === 'function' ? msg.location() : undefined;
          const text = msg.text();
          const source = classifyConsoleSource(text, location);
          const httpStatus = parseConsoleHttpStatus(text);
          keep(state.consoleRecords, {
            kind: 'console',
            sessionName,
            timestamp: now(),
            pageId: ensurePageId(p),
            navigationId: ensureNavigationId(p),
            level: msg.type(),
            source,
            text,
            ...(httpStatus ? { httpStatus } : {}),
            ...(location?.url ? { location } : {}),
          });
          if (httpStatus && source === 'api') {
            keep(state.networkRecords, {
              kind: 'console-resource-error',
              sessionName,
              timestamp: now(),
              event: 'console-resource-error',
              requestId: 'console-' + state.nextConsoleResourceSeq++,
              pageId: ensurePageId(p),
              navigationId: ensureNavigationId(p),
              url: location?.url || '',
              method: '',
              status: httpStatus,
              resourceType: 'unknown',
              failureText: text,
              source: 'console',
              ...(location?.url ? { location } : {}),
            });
          }
        });
        p.on('request', req => {
          const requestId = req.__pwcliRequestId || ('req-' + state.nextRequestSeq++);
          req.__pwcliRequestId = requestId;
          const frame = typeof req.frame === 'function' ? req.frame() : null;
          const headers = typeof req.headers === 'function' ? req.headers() : {};
          const contentType = String(headers['content-type'] || '');
          const postData = typeof req.postData === 'function' ? req.postData() : null;
          const record = {
            kind: 'request',
            sessionName,
            timestamp: now(),
            event: 'request',
            requestId,
            pageId: ensurePageId(p),
            navigationId: ensureNavigationId(p),
            url: req.url(),
            method: req.method(),
            resourceType: req.resourceType(),
            isNavigationRequest: typeof req.isNavigationRequest === 'function' ? req.isNavigationRequest() : false,
            ...(contentType ? { requestContentType: contentType } : {}),
            ...(frame
              ? {
                  frame: {
                    url: frame.url(),
                    name: frame.name(),
                  },
                }
              : {}),
          };
          if (postData && isTextLikeContentType(contentType)) {
            const snippet = clipSnippet(postData);
            record.requestBodySnippet = snippet.snippet;
            record.requestBodyTruncated = snippet.truncated;
            const fullBody = clipBody(postData);
            record.requestBody = fullBody.body;
            record.requestBodyTruncatedAt50k = fullBody.truncated;
          }
          keep(state.networkRecords, record);
        });
        p.on('response', res => {
          const req = res.request();
          const requestId = req.__pwcliRequestId || ('req-' + state.nextRequestSeq++);
          req.__pwcliRequestId = requestId;
          const frame = typeof req.frame === 'function' ? req.frame() : null;
          const headers = typeof res.headers === 'function' ? res.headers() : {};
          const contentType = String(headers['content-type'] || '');
          const record = {
            kind: 'response',
            sessionName,
            timestamp: now(),
            event: 'response',
            requestId,
            pageId: ensurePageId(p),
            navigationId: ensureNavigationId(p),
            url: req.url(),
            method: req.method(),
            status: res.status(),
            ok: res.ok(),
            resourceType: req.resourceType(),
            ...(contentType ? { responseContentType: contentType } : {}),
            ...(frame
              ? {
                  frame: {
                    url: frame.url(),
                    name: frame.name(),
                  },
                }
              : {}),
          };
          keep(state.networkRecords, record);
          if (isTextLikeContentType(contentType) && typeof res.text === 'function') {
            Promise.resolve()
              .then(() => res.text())
              .then((text) => {
                const snippet = clipSnippet(text);
                record.responseBodySnippet = snippet.snippet;
                record.responseBodyTruncated = snippet.truncated;
                const fullBody = clipBody(text);
                record.responseBody = fullBody.body;
                record.responseBodyTruncatedAt50k = fullBody.truncated;
              })
              .catch((error) => {
                record.responseBodyReadError =
                  error instanceof Error ? error.message : String(error);
              });
          }
        });
        p.on('requestfailed', req => {
          const requestId = req.__pwcliRequestId || ('req-' + state.nextRequestSeq++);
          req.__pwcliRequestId = requestId;
          const frame = typeof req.frame === 'function' ? req.frame() : null;
          keep(state.networkRecords, {
            kind: 'requestfailed',
            sessionName,
            timestamp: now(),
            event: 'requestfailed',
            requestId,
            pageId: ensurePageId(p),
            navigationId: ensureNavigationId(p),
            url: req.url(),
            method: req.method(),
            resourceType: req.resourceType(),
            failureText: req.failure()?.errorText || '',
            ...(frame
              ? {
                  frame: {
                    url: frame.url(),
                    name: frame.name(),
                  },
                }
              : {}),
          });
        });
        p.on('pageerror', err => {
          keep(state.pageErrorRecords, {
            kind: 'pageerror',
            sessionName,
            timestamp: now(),
            pageId: ensurePageId(p),
            navigationId: ensureNavigationId(p),
            text: err?.message || String(err),
            stack: typeof err?.stack === 'string' ? err.stack : '',
          });
        });
        p.on('dialog', dialog => {
          const record = {
            kind: 'dialog',
            sessionName,
            dialogId: 'dialog-' + state.nextDialogSeq++,
            pageId: ensurePageId(p),
            timestamp: now(),
            navigationId: ensureNavigationId(p),
            open: true,
            type: dialog.type(),
            message: dialog.message(),
          };
          keep(state.dialogRecords, record, 50);
          state.dialog = record;
        });
      };

      for (const current of context.pages())
        installPage(current);

      if (!context.__pwcliContextDiagnosticsInstalled) {
        context.__pwcliContextDiagnosticsInstalled = true;
        context.on('page', newPage => installPage(newPage));
      }

      // SSE capture: expose a Node function the browser can call, then inject the EventSource patch.
      if (!context.__pwcliSsePatchInstalled) {
        context.__pwcliSsePatchInstalled = true;
        const _state = state;
        await context.exposeFunction('__pwcliSseEvent', (recordJson) => {
          try {
            const record = JSON.parse(String(recordJson));
            const sseRecords = Array.isArray(_state.sseRecords) ? _state.sseRecords : (_state.sseRecords = []);
            sseRecords.push(record);
            if (sseRecords.length > 200)
              sseRecords.splice(0, sseRecords.length - 200);
          } catch (_e) {
            // ignore malformed records
          }
        });
        await context.addInitScript(${JSON.stringify(`(function () {
  if (typeof EventSource === 'undefined' || window.__pwcliSsePatchInstalled) return;
  window.__pwcliSsePatchInstalled = true;
  var _OriginalEventSource = window.EventSource;
  function PatchedEventSource(url, init) {
    var es = new _OriginalEventSource(url, init);
    var urlStr = String(url);
    var now = function () { return new Date().toISOString(); };
    var push = function (record) {
      if (typeof window.__pwcliSseEvent === 'function')
        window.__pwcliSseEvent(JSON.stringify(record)).catch(function () {});
    };
    push({ kind: 'sse-connect', url: urlStr, status: 'connecting', timestamp: now() });
    es.addEventListener('open', function () {
      push({ kind: 'sse-connect', url: urlStr, status: 'open', timestamp: now() });
    });
    es.addEventListener('error', function () {
      push({ kind: 'sse-error', url: urlStr, eventType: '__error', timestamp: now(), readyState: es.readyState });
    });
    var _origAdd = es.addEventListener.bind(es);
    es.addEventListener = function (type, listener, options) {
      if (type !== 'open' && type !== 'error') {
        var wrapped = function (e) {
          var data = typeof e.data === 'string' ? (e.data.length > 500 ? e.data.slice(0, 500) + '...' : e.data) : null;
          push({ kind: 'sse-event', url: urlStr, eventType: type, data: data, id: e.lastEventId || null, timestamp: now() });
          if (typeof listener === 'function') listener.call(this, e);
        };
        _origAdd(type, wrapped, options);
      } else {
        _origAdd(type, listener, options);
      }
    };
    es.addEventListener('message', function (e) {
      var data = typeof e.data === 'string' ? (e.data.length > 500 ? e.data.slice(0, 500) + '...' : e.data) : null;
      push({ kind: 'sse-event', url: urlStr, eventType: 'message', data: data, id: e.lastEventId || null, timestamp: now() });
    });
    return es;
  }
  PatchedEventSource.prototype = _OriginalEventSource.prototype;
  PatchedEventSource.CONNECTING = _OriginalEventSource.CONNECTING;
  PatchedEventSource.OPEN = _OriginalEventSource.OPEN;
  PatchedEventSource.CLOSED = _OriginalEventSource.CLOSED;
  window.EventSource = PatchedEventSource;
})();`)});
      }

      return JSON.stringify({
        installed: true,
        pageIds: context.pages().map(current => ensurePageId(current)),
        consoleCount: state.consoleRecords.length,
        networkCount: state.networkRecords.length,
        sseCount: state.sseRecords.length,
      });
    }`,
  });
  return result.data.result;
}

export function sessionRoutingError(message: string) {
  if (isModalStateBlockedMessage(message)) {
    return {
      code: "MODAL_STATE_BLOCKED",
      message:
        "The current managed session is blocked by a modal dialog, so run-code-backed reads and actions are unavailable.",
      suggestions: [
        "Run: pw dialog accept --session <name>  or  pw dialog dismiss --session <name>  then retry",
        "Run `pw doctor --session <name>` to confirm the blocked state",
        "If the session cannot be recovered, run `pw session recreate <name>`",
      ],
      recovery: {
        kind: "dismiss-dialog" as const,
        commands: ["pw dialog dismiss --session <name>", "pw doctor --session <name>"],
      },
    };
  }

  if (message === "SESSION_REQUIRED") {
    return {
      code: "SESSION_REQUIRED",
      message: "This command requires --session <name>.",
      suggestions: [
        "Run `pw session create <name> --open <url>` first",
        "Retry with `--session <name>`",
      ],
    };
  }

  if (message.startsWith("SESSION_NOT_FOUND:")) {
    const name = message.slice("SESSION_NOT_FOUND:".length);
    return {
      code: "SESSION_NOT_FOUND",
      message: `Session '${name}' not found.`,
      suggestions: [
        "Run `pw session list` to inspect active sessions",
        "Create it with `pw session create <name> --open <url>`",
      ],
      recovery: {
        kind: "inspect" as const,
        commands: ["pw session list", "pw session create <name> --open <url>"],
      },
      details: { session: name },
    };
  }

  if (message.startsWith("SESSION_BUSY:")) {
    const [, name, timeoutMs] = message.split(":");
    return {
      code: "SESSION_BUSY",
      message: `Session '${name}' is still running another command.`,
      retryable: true,
      suggestions: [
        "Retry the same command after the in-flight command finishes",
        "Keep dependent commands on the same session sequential, or put stable steps in `pw batch`",
        "If the owner process is gone, retry after the lock is reclaimed automatically",
      ],
      recovery: {
        kind: "retry" as const,
        commands: ["pw session status <name>", "pw observe status --session <name>"],
      },
      details: { session: name, timeoutMs: Number(timeoutMs) },
    };
  }

  if (message.startsWith("SESSION_RECREATE_STARTUP_TIMEOUT:")) {
    return {
      code: "SESSION_RECREATE_STARTUP_TIMEOUT",
      message: message.slice("SESSION_RECREATE_STARTUP_TIMEOUT:".length),
      retryable: false,
      suggestions: [
        "DO NOT retry recreate for the same session name — it will not self-heal",
        "Run: pw session close --session <name> --force  then  pw session create <new-name>",
        "Or use a completely different session name to avoid the locked profile",
      ],
    };
  }

  if (message.startsWith("CHROME_PROFILE_NOT_FOUND")) {
    const [, profile] = message.split(":");
    return {
      code: "CHROME_PROFILE_NOT_FOUND",
      message: profile
        ? `Chrome profile '${profile}' was not found.`
        : "No local Chrome profiles were found.",
      suggestions: [
        "Run `pw profile list-chrome` to inspect available Chrome profiles",
        "Retry with `pw session create <name> --from-system-chrome --chrome-profile <directory-or-name> --open <url>`",
        "If Chrome is installed in a non-standard location, set PWCLI_CHROME_USER_DATA_DIR to the Chrome user data directory",
      ],
      recovery: {
        kind: "inspect" as const,
        commands: ["pw profile list-chrome"],
      },
      details: profile ? { profile } : undefined,
    };
  }

  if (message.startsWith("SESSION_NAME_TOO_LONG:")) {
    const [, name, limit] = message.split(":");
    return {
      code: "SESSION_NAME_TOO_LONG",
      message: `Session '${name}' is too long. Maximum length is ${limit} characters.`,
      suggestions: [
        "Use a short session name like dc-main, auth-a, q1, or bug-a",
        `Keep the session name at or below ${limit} characters`,
      ],
      recovery: {
        kind: "inspect" as const,
        commands: [] as string[],
      },
      details: { session: name, maxLength: Number(limit) },
    };
  }

  if (message.startsWith("SESSION_NAME_INVALID:")) {
    const name = message.slice("SESSION_NAME_INVALID:".length);
    return {
      code: "SESSION_NAME_INVALID",
      message: `Session '${name}' contains unsupported characters.`,
      suggestions: [
        "Use only letters, numbers, hyphen, or underscore",
        "Example valid names: dc-main, auth_a, q1, bug-1",
      ],
      recovery: {
        kind: "inspect" as const,
        commands: [] as string[],
      },
      details: { session: name },
    };
  }

  return null;
}

export async function requireExistingSession(sessionName: string) {
  const sessions = await listManagedSessions();
  const entry = sessions.find((item) => item.name === sessionName);
  if (!entry?.alive) {
    throw new Error(`SESSION_NOT_FOUND:${sessionName}`);
  }
  return entry;
}

export type SessionDefaults = {
  headed: boolean;
  trace: boolean;
  diagnosticsRecords: boolean;
  runArtifacts: boolean;
};

export const DEFAULT_SESSION_DEFAULTS: SessionDefaults = {
  headed: false,
  trace: true,
  diagnosticsRecords: true,
  runArtifacts: true,
};

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const playwrightCoreRoot = dirname(require.resolve("playwright-core/package.json"));

const sessionModule = require(join(playwrightCoreRoot, "lib/tools/cli-client/session.js"));
const registryModule = require(join(playwrightCoreRoot, "lib/tools/cli-client/registry.js"));

const { Session } = sessionModule;
const { Registry, createClientInfo, resolveSessionName } = registryModule;

export const DEFAULT_SESSION_NAME = "default";
const INTERNAL_SESSION_PREFIX = "pws-";
const INTERNAL_SESSION_HASH_LENGTH = 12;
const SESSION_ALIAS_VERSION = 1;

type ManagedSessionAlias = {
  aliasVersion: number;
  displayName: string;
  internalName: string;
};

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
  pwcli?: ManagedSessionAlias;
};

type ManagedSessionEntry = {
  file: string;
  daemonDir: string;
  config: ManagedSessionConfig;
};

function normalizeSessionName(name?: string) {
  return resolveSessionName(name ?? DEFAULT_SESSION_NAME);
}

function deriveInternalSessionName(name: string) {
  const hash = createHash("sha1").update(name).digest("hex");
  return `${INTERNAL_SESSION_PREFIX}${hash.slice(0, INTERNAL_SESSION_HASH_LENGTH)}`;
}

function getSessionDisplayName(entry: ManagedSessionEntry) {
  return entry.config.pwcli?.displayName ?? entry.config.name ?? DEFAULT_SESSION_NAME;
}

function getSessionInternalName(entry: ManagedSessionEntry) {
  return entry.config.pwcli?.internalName ?? entry.config.name ?? DEFAULT_SESSION_NAME;
}

async function readSessionEntryFile(
  daemonDir: string,
  sessionFileName: string,
): Promise<ManagedSessionEntry | null> {
  try {
    const file = join(daemonDir, sessionFileName);
    const text = await readFile(file, "utf8");
    const config = JSON.parse(text) as ManagedSessionConfig;
    return {
      file,
      daemonDir,
      config: {
        ...config,
        name: config.name ?? basename(sessionFileName, ".session"),
      },
    };
  } catch {
    return null;
  }
}

async function aliasSessionEntry(
  daemonDir: string,
  displayName: string,
  internalName: string,
): Promise<ManagedSessionEntry> {
  const entry = await readSessionEntryFile(daemonDir, `${internalName}.session`);
  if (!entry) {
    throw new Error(`Could not start the session "${displayName}"`);
  }

  const nextConfig: ManagedSessionConfig = {
    ...entry.config,
    name: displayName,
    pwcli: {
      aliasVersion: SESSION_ALIAS_VERSION,
      displayName,
      internalName,
    },
  };

  await writeFile(entry.file, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");

  return {
    ...entry,
    config: nextConfig,
  };
}

async function findSessionEntry(
  clientInfo: Awaited<ReturnType<typeof createClientInfo>>,
  registry: Awaited<ReturnType<typeof loadRegistry>>,
  displayName: string,
): Promise<ManagedSessionEntry | undefined> {
  const entry = registry.entry(clientInfo, displayName) as ManagedSessionEntry | undefined;
  if (entry) {
    return entry;
  }

  const internalName = deriveInternalSessionName(displayName);
  const aliasedEntry = registry
    .entries(clientInfo)
    .find((candidate) => getSessionInternalName(candidate as ManagedSessionEntry) === internalName) as
    | ManagedSessionEntry
    | undefined;
  if (aliasedEntry) {
    return aliasedEntry;
  }

  const rawInternalEntry = await readSessionEntryFile(
    clientInfo.daemonProfilesDir,
    `${internalName}.session`,
  );
  if (!rawInternalEntry) {
    return undefined;
  }
  return await aliasSessionEntry(clientInfo.daemonProfilesDir, displayName, internalName);
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

async function getSessionEntry(sessionName?: string) {
  const clientInfo = createClientInfo();
  const registry = await loadRegistry();
  const resolvedSessionName = normalizeSessionName(sessionName);
  const entry = await findSessionEntry(clientInfo, registry, resolvedSessionName);
  return {
    clientInfo,
    registry,
    sessionName: resolvedSessionName,
    entry,
  };
}

export async function getManagedSessionEntry(sessionName?: string) {
  const { entry } = await getSessionEntry(sessionName);
  if (!entry) {
    return null;
  }
  return {
    name: getSessionDisplayName(entry),
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
        name: getSessionDisplayName(entry as ManagedSessionEntry),
        socketPath: entry.config.socketPath,
        version: entry.config.version,
        workspaceDir: entry.config.workspaceDir,
        alive: await session.canConnect(),
      };
    }),
  );
}

export async function getManagedSessionStatus(sessionName?: string) {
  const { entry } = await getSessionEntry(sessionName);
  if (!entry) {
    return null;
  }

  const session = new Session(entry);
  const alive = await session.canConnect();

  return {
    name: getSessionDisplayName(entry),
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
  const { clientInfo, sessionName, entry } = await getSessionEntry(options?.sessionName);
  const internalSessionName = deriveInternalSessionName(sessionName);

  if (entry && options?.reset) {
    await new Session(entry).stop(true);
  }

  if (!entry && !options?.createIfMissing && !options?.reset) {
    throw new Error(`SESSION_NOT_FOUND:${sessionName}`);
  }

  const nextEntry =
    options?.reset || !entry
      ? await (async () => {
          await withSuppressedConsole(() =>
            Session.startDaemon(clientInfo, {
              _: ["open"],
              headed: Boolean(options?.headed),
              session: internalSessionName,
              ...(options?.profile ? { profile: options.profile } : {}),
              ...(options?.persistent ? { persistent: true } : {}),
              ...(options?.endpoint ? { endpoint: options.endpoint } : {}),
            }),
          );
          return await aliasSessionEntry(clientInfo.daemonProfilesDir, sessionName, internalSessionName);
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

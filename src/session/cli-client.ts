import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const playwrightCoreRoot = dirname(require.resolve('playwright-core/package.json'));

const sessionModule = require(join(playwrightCoreRoot, 'lib/tools/cli-client/session.js'));
const registryModule = require(join(playwrightCoreRoot, 'lib/tools/cli-client/registry.js'));

const { Session } = sessionModule;
const { Registry, createClientInfo, resolveSessionName } = registryModule;

export const DEFAULT_SESSION_NAME = 'default';

function normalizeSessionName(name?: string) {
  return resolveSessionName(name ?? DEFAULT_SESSION_NAME);
}

async function loadRegistry() {
  return await Registry.load();
}

async function withSuppressedConsole(fn: () => Promise<any>) {
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
  const entry = registry.entry(clientInfo, resolvedSessionName);
  return {
    clientInfo,
    registry,
    sessionName: resolvedSessionName,
    entry,
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
}) {
  const { clientInfo, registry, sessionName, entry } = await getSessionEntry(options?.sessionName);

  if (entry && options?.reset) {
    await new Session(entry).stop(true);
  }

  const nextEntry =
    options?.reset || !entry
      ? (await (async () => {
          await withSuppressedConsole(() =>
            Session.startDaemon(clientInfo, {
              _: ['open'],
              headed: Boolean(options?.headed),
              session: sessionName,
              ...(options?.profile ? { profile: options.profile } : {}),
              ...(options?.persistent ? { persistent: true } : {}),
              ...(options?.endpoint ? { endpoint: options.endpoint } : {}),
            }),
          );
          return await registry.loadEntry(clientInfo, sessionName);
        })())
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

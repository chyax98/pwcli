import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { managedRunCode } from "../code.js";
import { maybeRawOutput } from "../shared.js";

export type StateDiffOptions = {
  sessionName?: string;
  before?: string;
  after?: string;
};

type StateDiffSnapshotCookie = {
  name: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  sameSite: string;
  secure: boolean;
  valueDigest: string;
};

type StateDiffSnapshotStorage = {
  accessible: boolean;
  keys: string[];
};

type StateDiffSnapshotStore = {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexNames: string[];
  countEstimate: number;
};

type StateDiffSnapshotDatabase = {
  name: string;
  version: number;
  stores: StateDiffSnapshotStore[];
};

type StateDiffSnapshotIndexedDb = {
  status: "available" | "origin_unavailable" | "unsupported";
  databases: StateDiffSnapshotDatabase[];
};

export type StateDiffSnapshot = {
  version: 1;
  capturedAt: string;
  page: {
    origin: string;
    href: string;
    title: string;
  };
  cookies: StateDiffSnapshotCookie[];
  localStorage: StateDiffSnapshotStorage;
  sessionStorage: StateDiffSnapshotStorage;
  indexeddb: StateDiffSnapshotIndexedDb;
};

type StateDiffSnapshotPayload = {
  page: {
    origin?: unknown;
    href?: unknown;
    title?: unknown;
  };
  cookies?: unknown;
  localStorage?: {
    accessible?: unknown;
    keys?: unknown;
  };
  sessionStorage?: {
    accessible?: unknown;
    keys?: unknown;
  };
  indexeddb?: {
    status?: unknown;
    databases?: unknown;
  };
};

function digestValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeStateDiffSnapshotStore(value: unknown): StateDiffSnapshotStore | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : "";
  if (!name) {
    return null;
  }
  const keyPathValue = record.keyPath;
  const keyPath =
    typeof keyPathValue === "string"
      ? keyPathValue
      : Array.isArray(keyPathValue) && keyPathValue.every((item) => typeof item === "string")
        ? (keyPathValue as string[])
        : null;
  return {
    name,
    keyPath,
    autoIncrement: Boolean(record.autoIncrement),
    indexNames: normalizeStringArray(record.indexNames).sort(),
    countEstimate: Number(record.countEstimate ?? 0),
  };
}

function normalizeStateDiffSnapshotDatabase(value: unknown): StateDiffSnapshotDatabase | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : "";
  if (!name) {
    return null;
  }
  return {
    name,
    version: Number(record.version ?? 0),
    stores: Array.isArray(record.stores)
      ? record.stores
          .map((store) => normalizeStateDiffSnapshotStore(store))
          .filter((store): store is StateDiffSnapshotStore => Boolean(store))
          .sort((left, right) => left.name.localeCompare(right.name))
      : [],
  };
}

function normalizeStateDiffSnapshot(value: unknown): StateDiffSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("STATE_DIFF_SNAPSHOT_INVALID");
  }
  const record = value as Record<string, unknown>;
  if (record.version !== 1) {
    throw new Error("STATE_DIFF_SNAPSHOT_INVALID");
  }
  const page =
    record.page && typeof record.page === "object" && !Array.isArray(record.page)
      ? (record.page as Record<string, unknown>)
      : {};
  const cookies = Array.isArray(record.cookies)
    ? record.cookies
        .map((cookie) => {
          if (!cookie || typeof cookie !== "object" || Array.isArray(cookie)) {
            return null;
          }
          const item = cookie as Record<string, unknown>;
          const name = typeof item.name === "string" ? item.name : "";
          const domain = typeof item.domain === "string" ? item.domain : "";
          const path = typeof item.path === "string" ? item.path : "";
          const valueDigest = typeof item.valueDigest === "string" ? item.valueDigest : "";
          if (!name || !domain || !path || !valueDigest) {
            return null;
          }
          return {
            name,
            domain,
            path,
            expires: Number(item.expires ?? -1),
            httpOnly: Boolean(item.httpOnly),
            sameSite: typeof item.sameSite === "string" ? item.sameSite : "Lax",
            secure: Boolean(item.secure),
            valueDigest,
          } satisfies StateDiffSnapshotCookie;
        })
        .filter((cookie): cookie is StateDiffSnapshotCookie => Boolean(cookie))
        .sort((left, right) =>
          `${left.name}|${left.domain}|${left.path}`.localeCompare(
            `${right.name}|${right.domain}|${right.path}`,
          ),
        )
    : [];
  const localStorage =
    record.localStorage &&
    typeof record.localStorage === "object" &&
    !Array.isArray(record.localStorage)
      ? (record.localStorage as Record<string, unknown>)
      : {};
  const sessionStorage =
    record.sessionStorage &&
    typeof record.sessionStorage === "object" &&
    !Array.isArray(record.sessionStorage)
      ? (record.sessionStorage as Record<string, unknown>)
      : {};
  const indexeddb =
    record.indexeddb && typeof record.indexeddb === "object" && !Array.isArray(record.indexeddb)
      ? (record.indexeddb as Record<string, unknown>)
      : {};
  const indexedDbStatus =
    indexeddb.status === "available" ||
    indexeddb.status === "origin_unavailable" ||
    indexeddb.status === "unsupported"
      ? (indexeddb.status as StateDiffSnapshotIndexedDb["status"])
      : "unsupported";

  return {
    version: 1,
    capturedAt:
      typeof record.capturedAt === "string" ? record.capturedAt : new Date(0).toISOString(),
    page: {
      origin: typeof page.origin === "string" ? page.origin : "",
      href: typeof page.href === "string" ? page.href : "",
      title: typeof page.title === "string" ? page.title : "",
    },
    cookies,
    localStorage: {
      accessible: Boolean(localStorage.accessible),
      keys: normalizeStringArray(localStorage.keys).sort(),
    },
    sessionStorage: {
      accessible: Boolean(sessionStorage.accessible),
      keys: normalizeStringArray(sessionStorage.keys).sort(),
    },
    indexeddb: {
      status: indexedDbStatus,
      databases: Array.isArray(indexeddb.databases)
        ? indexeddb.databases
            .map((database) => normalizeStateDiffSnapshotDatabase(database))
            .filter((database): database is StateDiffSnapshotDatabase => Boolean(database))
            .sort((left, right) => left.name.localeCompare(right.name))
        : [],
    },
  };
}

async function loadStateDiffSnapshot(path: string) {
  const resolved = resolve(path);
  const parsed = JSON.parse(await readFile(resolved, "utf8")) as unknown;
  return {
    path: resolved,
    snapshot: normalizeStateDiffSnapshot(parsed),
  };
}

async function writeStateDiffSnapshot(path: string, snapshot: StateDiffSnapshot) {
  const resolved = resolve(path);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, JSON.stringify(snapshot, null, 2), "utf8");
  return resolved;
}

function buildStateDiffSnapshotSource() {
  return `async page => {
    const currentUrl = page.url();
    const cookieScope = currentUrl && /^https?:/i.test(currentUrl) ? [currentUrl] : undefined;
    const cookies = await page.context().cookies(cookieScope).catch(() => []);
    const pageState = await page.evaluate(async () => {
      const origin = globalThis.location?.origin ?? '';
      const href = globalThis.location?.href ?? '';
      const title = globalThis.document?.title ?? '';
      const localStorageState = (() => {
        try {
          return {
            accessible: true,
            keys: Object.keys(localStorage).sort(),
          };
        } catch {
          return {
            accessible: false,
            keys: [],
          };
        }
      })();
      const sessionStorageState = (() => {
        try {
          return {
            accessible: true,
            keys: Object.keys(sessionStorage).sort(),
          };
        } catch {
          return {
            accessible: false,
            keys: [],
          };
        }
      })();

      if (!origin || origin === 'null') {
        return {
          page: { origin, href, title },
          localStorage: localStorageState,
          sessionStorage: sessionStorageState,
          indexeddb: {
            status: 'origin_unavailable',
            databases: [],
          },
        };
      }

      if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
        return {
          page: { origin, href, title },
          localStorage: localStorageState,
          sessionStorage: sessionStorageState,
          indexeddb: {
            status: 'unsupported',
            databases: [],
          },
        };
      }

      const openDatabase = (name) =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open(name);
          request.onerror = () => reject(request.error || new Error('indexeddb open failed'));
          request.onsuccess = () => resolve(request.result);
        });

      const requestValue = request =>
        new Promise((resolve, reject) => {
          request.onerror = () => reject(request.error || new Error('indexeddb request failed'));
          request.onsuccess = () => resolve(request.result);
        });

      const listed = await indexedDB.databases();
      const databases = [];
      for (const item of listed.filter(entry => typeof entry?.name === 'string' && entry.name.length > 0)) {
        const database = await openDatabase(item.name);
        try {
          const stores = [];
          for (const storeName of Array.from(database.objectStoreNames)) {
            const tx = database.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const countEstimate = Number(await requestValue(store.count()));
            stores.push({
              name: storeName,
              keyPath: store.keyPath ?? null,
              autoIncrement: store.autoIncrement,
              indexNames: Array.from(store.indexNames).sort(),
              countEstimate,
            });
          }
          databases.push({
            name: item.name,
            version: database.version,
            stores,
          });
        } finally {
          database.close();
        }
      }

      return {
        page: { origin, href, title },
        localStorage: localStorageState,
        sessionStorage: sessionStorageState,
        indexeddb: {
          status: 'available',
          databases,
        },
      };
    });

    return {
      cookies: cookies.map(cookie => ({
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite ?? 'Lax',
        secure: cookie.secure,
        value: cookie.value,
      })),
      ...pageState,
    };
  }`;
}

async function captureStateDiffSnapshot(sessionName?: string) {
  const result = await managedRunCode({
    sessionName,
    source: buildStateDiffSnapshotSource(),
  });
  const payload =
    typeof result.data.result === "object" && result.data.result
      ? (result.data.result as StateDiffSnapshotPayload)
      : null;
  const page =
    payload?.page && typeof payload.page === "object" && !Array.isArray(payload.page)
      ? payload.page
      : {};
  const localStorage =
    payload?.localStorage &&
    typeof payload.localStorage === "object" &&
    !Array.isArray(payload.localStorage)
      ? payload.localStorage
      : { accessible: false, keys: [] };
  const sessionStorage =
    payload?.sessionStorage &&
    typeof payload.sessionStorage === "object" &&
    !Array.isArray(payload.sessionStorage)
      ? payload.sessionStorage
      : { accessible: false, keys: [] };
  const indexeddb =
    payload?.indexeddb && typeof payload.indexeddb === "object" && !Array.isArray(payload.indexeddb)
      ? payload.indexeddb
      : { status: "unsupported", databases: [] };
  const cookies = Array.isArray(payload?.cookies)
    ? payload.cookies
        .map((cookie) => {
          if (!cookie || typeof cookie !== "object" || Array.isArray(cookie)) {
            return null;
          }
          const item = cookie as Record<string, unknown>;
          const name = typeof item.name === "string" ? item.name : "";
          const domain = typeof item.domain === "string" ? item.domain : "";
          const path = typeof item.path === "string" ? item.path : "";
          const value = typeof item.value === "string" ? item.value : "";
          if (!name || !domain || !path) {
            return null;
          }
          return {
            name,
            domain,
            path,
            expires: Number(item.expires ?? -1),
            httpOnly: Boolean(item.httpOnly),
            sameSite: typeof item.sameSite === "string" ? item.sameSite : "Lax",
            secure: Boolean(item.secure),
            valueDigest: digestValue(value),
          } satisfies StateDiffSnapshotCookie;
        })
        .filter((cookie): cookie is StateDiffSnapshotCookie => Boolean(cookie))
    : [];

  const snapshot = normalizeStateDiffSnapshot({
    version: 1,
    capturedAt: new Date().toISOString(),
    page: {
      origin: typeof page.origin === "string" ? page.origin : "",
      href: typeof page.href === "string" ? page.href : "",
      title: typeof page.title === "string" ? page.title : "",
    },
    cookies,
    localStorage,
    sessionStorage,
    indexeddb,
  });

  return {
    session: result.session,
    page: result.page,
    snapshot,
  };
}

function summarizeStateDiffSnapshot(snapshot: StateDiffSnapshot) {
  return {
    origin: snapshot.page.origin,
    href: snapshot.page.href,
    cookieCount: snapshot.cookies.length,
    localStorageKeyCount: snapshot.localStorage.keys.length,
    sessionStorageKeyCount: snapshot.sessionStorage.keys.length,
    indexeddbStatus: snapshot.indexeddb.status,
    indexeddbDatabaseCount: snapshot.indexeddb.databases.length,
  };
}

function diffStringSets(before: string[], after: string[]) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((item) => !beforeSet.has(item)),
    removed: before.filter((item) => !afterSet.has(item)),
  };
}

function cookieIdentity(cookie: Pick<StateDiffSnapshotCookie, "name" | "domain" | "path">) {
  return `${cookie.name}|${cookie.domain}|${cookie.path}`;
}

function diffCookies(before: StateDiffSnapshotCookie[], after: StateDiffSnapshotCookie[]) {
  const beforeMap = new Map(before.map((cookie) => [cookieIdentity(cookie), cookie]));
  const afterMap = new Map(after.map((cookie) => [cookieIdentity(cookie), cookie]));
  const added = after
    .filter((cookie) => !beforeMap.has(cookieIdentity(cookie)))
    .map(({ name, domain, path }) => ({ name, domain, path }));
  const removed = before
    .filter((cookie) => !afterMap.has(cookieIdentity(cookie)))
    .map(({ name, domain, path }) => ({ name, domain, path }));
  const changed = before
    .filter((cookie) => afterMap.has(cookieIdentity(cookie)))
    .map((cookie) => {
      const next = afterMap.get(cookieIdentity(cookie));
      if (!next) {
        return null;
      }
      const changedFields = [
        cookie.valueDigest !== next.valueDigest ? "value" : null,
        cookie.expires !== next.expires ? "expires" : null,
        cookie.httpOnly !== next.httpOnly ? "httpOnly" : null,
        cookie.sameSite !== next.sameSite ? "sameSite" : null,
        cookie.secure !== next.secure ? "secure" : null,
      ].filter((field): field is string => Boolean(field));
      return changedFields.length > 0
        ? {
            name: cookie.name,
            domain: cookie.domain,
            path: cookie.path,
            changedFields,
          }
        : null;
    })
    .filter(
      (entry): entry is { name: string; domain: string; path: string; changedFields: string[] } =>
        Boolean(entry),
    );
  return {
    beforeCount: before.length,
    afterCount: after.length,
    added,
    removed,
    changed,
  };
}

function diffIndexedDb(before: StateDiffSnapshotIndexedDb, after: StateDiffSnapshotIndexedDb) {
  const beforeDbMap = new Map(before.databases.map((database) => [database.name, database]));
  const afterDbMap = new Map(after.databases.map((database) => [database.name, database]));
  const databasesAdded = after.databases
    .filter((database) => !beforeDbMap.has(database.name))
    .map((database) => database.name);
  const databasesRemoved = before.databases
    .filter((database) => !afterDbMap.has(database.name))
    .map((database) => database.name);
  const storesChanged: Array<{
    database: string;
    store: string;
    change: "added" | "removed" | "metadata_changed" | "count_changed";
    changedFields?: string[];
    beforeCountEstimate?: number;
    afterCountEstimate?: number;
  }> = [];

  for (const beforeDatabase of before.databases) {
    const afterDatabase = afterDbMap.get(beforeDatabase.name);
    if (!afterDatabase) {
      continue;
    }
    const beforeStoreMap = new Map(beforeDatabase.stores.map((store) => [store.name, store]));
    const afterStoreMap = new Map(afterDatabase.stores.map((store) => [store.name, store]));
    for (const afterStore of afterDatabase.stores) {
      if (!beforeStoreMap.has(afterStore.name)) {
        storesChanged.push({
          database: afterDatabase.name,
          store: afterStore.name,
          change: "added",
          afterCountEstimate: afterStore.countEstimate,
        });
      }
    }
    for (const beforeStore of beforeDatabase.stores) {
      const afterStore = afterStoreMap.get(beforeStore.name);
      if (!afterStore) {
        storesChanged.push({
          database: beforeDatabase.name,
          store: beforeStore.name,
          change: "removed",
          beforeCountEstimate: beforeStore.countEstimate,
        });
        continue;
      }
      const changedFields = [
        JSON.stringify(beforeStore.keyPath) !== JSON.stringify(afterStore.keyPath)
          ? "keyPath"
          : null,
        beforeStore.autoIncrement !== afterStore.autoIncrement ? "autoIncrement" : null,
        JSON.stringify(beforeStore.indexNames) !== JSON.stringify(afterStore.indexNames)
          ? "indexNames"
          : null,
      ].filter((field): field is string => Boolean(field));
      if (changedFields.length > 0) {
        storesChanged.push({
          database: beforeDatabase.name,
          store: beforeStore.name,
          change: "metadata_changed",
          changedFields,
          beforeCountEstimate: beforeStore.countEstimate,
          afterCountEstimate: afterStore.countEstimate,
        });
        continue;
      }
      if (beforeStore.countEstimate !== afterStore.countEstimate) {
        storesChanged.push({
          database: beforeDatabase.name,
          store: beforeStore.name,
          change: "count_changed",
          beforeCountEstimate: beforeStore.countEstimate,
          afterCountEstimate: afterStore.countEstimate,
        });
      }
    }
  }

  return {
    statusBefore: before.status,
    statusAfter: after.status,
    databasesAdded,
    databasesRemoved,
    storesChanged,
  };
}

function buildStateDiffResult(
  beforeSnapshot: StateDiffSnapshot,
  afterSnapshot: StateDiffSnapshot,
  sources: { before: string; after: string },
) {
  const localStorage = {
    beforeAccessible: beforeSnapshot.localStorage.accessible,
    afterAccessible: afterSnapshot.localStorage.accessible,
    beforeCount: beforeSnapshot.localStorage.keys.length,
    afterCount: afterSnapshot.localStorage.keys.length,
    ...diffStringSets(beforeSnapshot.localStorage.keys, afterSnapshot.localStorage.keys),
  };
  const sessionStorage = {
    beforeAccessible: beforeSnapshot.sessionStorage.accessible,
    afterAccessible: afterSnapshot.sessionStorage.accessible,
    beforeCount: beforeSnapshot.sessionStorage.keys.length,
    afterCount: afterSnapshot.sessionStorage.keys.length,
    ...diffStringSets(beforeSnapshot.sessionStorage.keys, afterSnapshot.sessionStorage.keys),
  };
  const cookies = diffCookies(beforeSnapshot.cookies, afterSnapshot.cookies);
  const indexeddb = diffIndexedDb(beforeSnapshot.indexeddb, afterSnapshot.indexeddb);
  const changedBuckets = [
    cookies.added.length > 0 || cookies.removed.length > 0 || cookies.changed.length > 0
      ? "cookies"
      : null,
    localStorage.added.length > 0 ||
    localStorage.removed.length > 0 ||
    localStorage.beforeAccessible !== localStorage.afterAccessible
      ? "localStorage"
      : null,
    sessionStorage.added.length > 0 ||
    sessionStorage.removed.length > 0 ||
    sessionStorage.beforeAccessible !== sessionStorage.afterAccessible
      ? "sessionStorage"
      : null,
    indexeddb.statusBefore !== indexeddb.statusAfter ||
    indexeddb.databasesAdded.length > 0 ||
    indexeddb.databasesRemoved.length > 0 ||
    indexeddb.storesChanged.length > 0
      ? "indexeddb"
      : null,
  ].filter((bucket): bucket is string => Boolean(bucket));

  return {
    summary: {
      changed: changedBuckets.length > 0,
      changedBuckets,
      beforeSource: sources.before,
      afterSource: sources.after,
    },
    page: {
      before: beforeSnapshot.page,
      after: afterSnapshot.page,
    },
    cookies,
    localStorage,
    sessionStorage,
    indexeddb,
  };
}

export async function managedStateDiff(options?: StateDiffOptions) {
  const beforePath = options?.before ? resolve(options.before) : undefined;
  const afterPath = options?.after ? resolve(options.after) : undefined;

  if (!beforePath) {
    throw new Error("STATE_DIFF_BEFORE_REQUIRED");
  }

  if (options?.sessionName) {
    let beforeSnapshot: StateDiffSnapshot | null = null;
    try {
      beforeSnapshot = (await loadStateDiffSnapshot(beforePath)).snapshot;
    } catch (error) {
      if (!(error instanceof Error) || !/ENOENT|no such file or directory/i.test(error.message)) {
        throw error instanceof Error && error.message === "STATE_DIFF_SNAPSHOT_INVALID"
          ? error
          : new Error("STATE_DIFF_SNAPSHOT_INVALID");
      }
    }

    const current = await captureStateDiffSnapshot(options.sessionName);
    if (!beforeSnapshot) {
      await writeStateDiffSnapshot(beforePath, current.snapshot);
      return {
        session: current.session,
        page: current.page,
        data: {
          baselineCreated: true,
          beforePath,
          snapshot: summarizeStateDiffSnapshot(current.snapshot),
        },
      };
    }

    if (afterPath) {
      await writeStateDiffSnapshot(afterPath, current.snapshot);
    }

    return {
      session: current.session,
      page: current.page,
      data: {
        beforePath,
        ...(afterPath ? { afterPath } : {}),
        ...buildStateDiffResult(beforeSnapshot, current.snapshot, {
          before: beforePath,
          after: afterPath ?? "current_session",
        }),
      },
    };
  }

  if (!afterPath) {
    throw new Error("STATE_DIFF_AFTER_REQUIRED");
  }

  const beforeSnapshot = await loadStateDiffSnapshot(beforePath).catch((error) => {
    throw error instanceof Error && error.message === "STATE_DIFF_SNAPSHOT_INVALID"
      ? error
      : new Error("STATE_DIFF_SNAPSHOT_INVALID");
  });
  const afterSnapshot = await loadStateDiffSnapshot(afterPath).catch((error) => {
    throw error instanceof Error && error.message === "STATE_DIFF_SNAPSHOT_INVALID"
      ? error
      : new Error("STATE_DIFF_SNAPSHOT_INVALID");
  });
  return {
    data: {
      beforePath,
      afterPath,
      ...buildStateDiffResult(beforeSnapshot.snapshot, afterSnapshot.snapshot, {
        before: beforePath,
        after: afterPath,
      }),
    },
  };
}

export async function managedStateSave(file?: string, options?: { sessionName?: string }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = options?.sessionName ? `-${options.sessionName}` : "";
  const defaultPath = resolve(".pwcli", "state", `storage-state-${stamp}${suffix}.json`);
  const path = resolve(file ?? defaultPath);
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const state = await page.context().storageState();
      return state;
    }`,
  });
  const state = result.data.result;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2), "utf8");

  return {
    session: result.session,
    page: result.page,
    data: {
      path,
      saved: true,
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function managedStateLoad(file: string, options?: { sessionName?: string }) {
  const path = resolve(file);
  const state = JSON.parse(await readFile(path, "utf8")) as unknown;
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      await page.context().setStorageState(${JSON.stringify(state)});
      const cookies = await page.context().cookies();
      return {
        loaded: true,
        cookieCount: cookies.length,
      };
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      path,
      loaded: true,
      ...(parsed.cookieCount !== undefined ? { cookieCount: Number(parsed.cookieCount) } : {}),
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

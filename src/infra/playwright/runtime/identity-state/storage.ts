import { managedRunCode } from "../code.js";
import { maybeRawOutput } from "../shared.js";

type IndexedDbExportOptions = {
  sessionName?: string;
  database?: string;
  store?: string;
  limit?: number;
  includeRecords?: boolean;
};

export async function managedCookiesList(options?: { sessionName?: string; domain?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const cookies = await page.context().cookies();
      const filtered = ${options?.domain ? `cookies.filter(cookie => cookie.domain === ${JSON.stringify(options.domain)} || cookie.domain.endsWith('.' + ${JSON.stringify(options.domain)}))` : "cookies"};
      return JSON.stringify({
        count: filtered.length,
        cookies: filtered,
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      count: Number(parsed.count ?? 0),
      cookies: Array.isArray(parsed.cookies) ? parsed.cookies : [],
      ...(options?.domain ? { domain: options.domain } : {}),
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function managedCookiesSet(options: {
  sessionName?: string;
  name: string;
  value: string;
  domain: string;
  path?: string;
}) {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await page.context().addCookies([
        {
          name: ${JSON.stringify(options.name)},
          value: ${JSON.stringify(options.value)},
          domain: ${JSON.stringify(options.domain)},
          path: ${JSON.stringify(options.path ?? "/")},
        },
      ]);
      const cookies = await page.context().cookies();
      const cookie = cookies.find(item => item.name === ${JSON.stringify(options.name)} && item.domain === ${JSON.stringify(options.domain)});
      return JSON.stringify({
        set: true,
        cookie: cookie || null,
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      set: true,
      cookie: parsed.cookie ?? null,
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function managedStorageRead(
  kind: "local" | "session",
  options?: { sessionName?: string },
) {
  const source =
    kind === "local"
      ? `async page => {
      return await page.evaluate(() => {
        try {
          return {
            kind: 'local',
            origin: globalThis.location?.origin ?? '',
            href: globalThis.location?.href ?? '',
            accessible: true,
            entries: Object.fromEntries(Object.entries(localStorage)),
          };
        } catch (error) {
          return {
            kind: 'local',
            origin: globalThis.location?.origin ?? '',
            href: globalThis.location?.href ?? '',
            accessible: false,
            error: error instanceof Error ? error.message : String(error),
            entries: {},
          };
        }
      });
    }`
      : `async page => {
      return await page.evaluate(() => {
        try {
          return {
            kind: 'session',
            origin: globalThis.location?.origin ?? '',
            href: globalThis.location?.href ?? '',
            accessible: true,
            entries: Object.fromEntries(Object.entries(sessionStorage)),
          };
        } catch (error) {
          return {
            kind: 'session',
            origin: globalThis.location?.origin ?? '',
            href: globalThis.location?.href ?? '',
            accessible: false,
            error: error instanceof Error ? error.message : String(error),
            entries: {},
          };
        }
      });
    }`;
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      kind,
      origin: parsed.origin ?? "",
      href: parsed.href ?? "",
      accessible: Boolean(parsed.accessible),
      entries:
        parsed.entries && typeof parsed.entries === "object" && !Array.isArray(parsed.entries)
          ? parsed.entries
          : {},
      ...(parsed.error ? { error: parsed.error } : {}),
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function managedStorageIndexedDbExport(options?: IndexedDbExportOptions) {
  const limit = Math.max(1, Math.floor(Number(options?.limit ?? 20)));
  const payload = JSON.stringify({
    databaseFilter: options?.database ?? null,
    storeFilter: options?.store ?? null,
    limit,
    includeRecords: Boolean(options?.includeRecords),
  });
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      return await page.evaluate(async (input) => {
        const origin = globalThis.location?.origin ?? '';
        const href = globalThis.location?.href ?? '';
        if (!origin || origin === 'null')
          throw new Error('INDEXEDDB_ORIGIN_UNAVAILABLE');
        if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function')
          throw new Error('INDEXEDDB_UNSUPPORTED');

        const toPreview = (value, depth = 0) => {
          if (value === null || value === undefined)
            return value;
          if (typeof value === 'string')
            return value.length > 200 ? value.slice(0, 200) + '…' : value;
          if (typeof value === 'number' || typeof value === 'boolean')
            return value;
          if (typeof value === 'bigint')
            return value.toString();
          if (value instanceof Date)
            return value.toISOString();
          if (value instanceof Blob)
            return { type: 'Blob', size: value.size, mimeType: value.type };
          if (value instanceof ArrayBuffer)
            return { type: 'ArrayBuffer', byteLength: value.byteLength };
          if (ArrayBuffer.isView(value))
            return {
              type: value.constructor?.name ?? 'TypedArray',
              byteLength: value.byteLength,
            };
          if (depth >= 3)
            return { type: 'Object', truncated: true };
          if (Array.isArray(value))
            return value.slice(0, 5).map(item => toPreview(item, depth + 1));
          if (typeof value === 'object') {
            const entries = Object.entries(value).slice(0, 10);
            return Object.fromEntries(entries.map(([key, nested]) => [key, toPreview(nested, depth + 1)]));
          }
          return String(value);
        };

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

        const sampleRecords = (store, recordLimit) =>
          new Promise((resolve, reject) => {
            const samples = [];
            const request = store.openCursor();
            request.onerror = () => reject(request.error || new Error('indexeddb cursor failed'));
            request.onsuccess = () => {
              const cursor = request.result;
              if (!cursor || samples.length >= recordLimit) {
                resolve(samples);
                return;
              }
              samples.push({ preview: toPreview(cursor.value) });
              cursor.continue();
            };
          });

        const listed = await indexedDB.databases();
        const visibleDatabases = listed
          .filter(item => typeof item?.name === 'string' && item.name.length > 0)
          .filter(item => !input.databaseFilter || item.name === input.databaseFilter);

        const databases = [];
        for (const item of visibleDatabases) {
          const database = await openDatabase(item.name);
          try {
            const storeNames = Array.from(database.objectStoreNames).filter(
              name => !input.storeFilter || name === input.storeFilter,
            );
            const stores = [];
            for (const storeName of storeNames) {
              const metaTx = database.transaction(storeName, 'readonly');
              const metaStore = metaTx.objectStore(storeName);
              const countEstimate = Number(await requestValue(metaStore.count()));
              const sampledRecords = input.includeRecords
                ? await sampleRecords(metaStore, input.limit)
                : undefined;
              stores.push({
                name: storeName,
                keyPath: metaStore.keyPath ?? null,
                autoIncrement: metaStore.autoIncrement,
                indexNames: Array.from(metaStore.indexNames),
                countEstimate,
                ...(sampledRecords ? { sampledRecords } : {}),
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
          kind: 'indexeddb',
          origin,
          href,
          databaseFilter: input.databaseFilter,
          storeFilter: input.storeFilter,
          includeRecords: Boolean(input.includeRecords),
          recordLimit: input.limit,
          databaseCount: databases.length,
          databases,
          limitedRecords: Boolean(input.includeRecords),
        };
      }, ${payload});
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      kind: "indexeddb",
      origin: typeof parsed.origin === "string" ? parsed.origin : "",
      href: typeof parsed.href === "string" ? parsed.href : "",
      databaseCount: Number(parsed.databaseCount ?? 0),
      databases: Array.isArray(parsed.databases) ? parsed.databases : [],
      ...(typeof parsed.databaseFilter === "string" ? { databaseFilter: parsed.databaseFilter } : {}),
      ...(typeof parsed.storeFilter === "string" ? { storeFilter: parsed.storeFilter } : {}),
      includeRecords: Boolean(parsed.includeRecords),
      recordLimit: Number(parsed.recordLimit ?? limit),
      limitedRecords: Boolean(parsed.limitedRecords),
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function managedStorageMutation(
  kind: "local" | "session",
  operation: "get" | "set" | "delete" | "clear",
  options?: { key?: string; sessionName?: string; value?: string },
) {
  if (operation !== "clear" && !options?.key) {
    throw new Error(`storage ${operation} requires a key`);
  }
  if (operation === "set" && options?.value === undefined) {
    throw new Error("storage set requires a value");
  }

  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      return await page.evaluate(() => {
        const kind = ${JSON.stringify(kind)};
        const operation = ${JSON.stringify(operation)};
        const key = ${JSON.stringify(options?.key ?? "")};
        const value = ${JSON.stringify(options?.value ?? "")};
        const origin = globalThis.location?.origin ?? "";
        const href = globalThis.location?.href ?? "";
        if (!origin || origin === "null") {
          throw new Error("STORAGE_ORIGIN_UNAVAILABLE");
        }
        const store = kind === "local" ? localStorage : sessionStorage;
        if (operation === "get") {
          return {
            kind,
            operation,
            origin,
            href,
            key,
            value: store.getItem(key),
          };
        }
        if (operation === "set") {
          store.setItem(key, value);
          return {
            kind,
            operation,
            origin,
            href,
            key,
            value: store.getItem(key),
            changed: true,
          };
        }
        if (operation === "delete") {
          const deleted = store.getItem(key) !== null;
          store.removeItem(key);
          return {
            kind,
            operation,
            origin,
            href,
            key,
            deleted,
          };
        }
        store.clear();
        return {
          kind,
          operation,
          origin,
          href,
          cleared: true,
        };
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      kind,
      operation,
      ...parsed,
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

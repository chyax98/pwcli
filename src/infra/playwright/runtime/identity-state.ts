import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { managedRunCode } from "./code.js";
import { maybeRawOutput } from "./shared.js";

type IndexedDbExportOptions = {
  sessionName?: string;
  database?: string;
  store?: string;
  limit?: number;
  includeRecords?: boolean;
};

type AuthProbeOptions = {
  sessionName?: string;
  url?: string;
};

type StateDiffOptions = {
  sessionName?: string;
  before?: string;
  after?: string;
};

type AuthProbeStatus = "authenticated" | "anonymous" | "uncertain";
type AuthProbeConfidence = "high" | "medium" | "low";
type AuthProbeBlockedState = "none" | "challenge" | "two_factor" | "interstitial" | "unknown";
type AuthProbeRecommendedAction =
  | "continue"
  | "save_state"
  | "inspect"
  | "reauth"
  | "human_handoff";

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

type StateDiffSnapshot = {
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
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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
    record.localStorage && typeof record.localStorage === "object" && !Array.isArray(record.localStorage)
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
    .filter((entry): entry is { name: string; domain: string; path: string; changedFields: string[] } =>
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

function diffIndexedDb(
  before: StateDiffSnapshotIndexedDb,
  after: StateDiffSnapshotIndexedDb,
) {
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
        JSON.stringify(beforeStore.keyPath) !== JSON.stringify(afterStore.keyPath) ? "keyPath" : null,
        beforeStore.autoIncrement !== afterStore.autoIncrement ? "autoIncrement" : null,
        JSON.stringify(beforeStore.indexNames) !== JSON.stringify(afterStore.indexNames) ? "indexNames" : null,
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

function buildAuthProbeSource(targetUrl?: string) {
  const keywordSets = {
    account: [
      "sign out",
      "log out",
      "logout",
      "my account",
      "account settings",
      "profile",
      "workspace",
      "dashboard",
    ],
    login: [
      "sign in",
      "log in",
      "login",
      "continue with",
      "forgot password",
      "password",
    ],
    challenge: [
      "verify you are human",
      "security check",
      "security challenge",
      "robot check",
      "captcha",
      "cloudflare",
      "access denied",
    ],
    twoFactor: [
      "two-factor",
      "2fa",
      "two step verification",
      "verification code",
      "one-time code",
      "authenticator app",
    ],
    interstitial: [
      "before you continue",
      "continue to site",
      "additional verification",
      "confirm your identity",
      "approve sign in",
      "forbidden",
      "not authorized",
    ],
  };
  return `async page => {
    const requestedUrl = ${JSON.stringify(targetUrl ?? null)};
    if (requestedUrl)
      await page.goto(requestedUrl, { waitUntil: 'domcontentloaded' });
    const keywordSets = ${JSON.stringify(keywordSets)};
    const currentUrl = page.url();
    const title = await page.title().catch(() => '');
    const pageInspection = await page.evaluate((input) => {
      const href = globalThis.location?.href ?? '';
      const origin = globalThis.location?.origin ?? '';
      const title = globalThis.document?.title ?? '';
      const bodyText = globalThis.document?.body?.innerText ?? '';
      const normalized = [title, href, bodyText].join('\\n').toLowerCase();
      const findHits = (values) => values.filter(value => normalized.includes(value.toLowerCase()));
      const selectorCount = (selector) => {
        try {
          return globalThis.document?.querySelectorAll(selector)?.length ?? 0;
        } catch {
          return 0;
        }
      };
      const localStorageKeys = (() => {
        try {
          return Object.keys(localStorage);
        } catch {
          return [];
        }
      })();
      const sessionStorageKeys = (() => {
        try {
          return Object.keys(sessionStorage);
        } catch {
          return [];
        }
      })();
      return {
        href,
        origin,
        title,
        loginKeywordHits: findHits(input.login),
        accountKeywordHits: findHits(input.account),
        challengeKeywordHits: findHits(input.challenge),
        twoFactorKeywordHits: findHits(input.twoFactor),
        interstitialKeywordHits: findHits(input.interstitial),
        passwordInputCount: selectorCount('input[type="password"], input[autocomplete*="password"], input[name*="pass" i], input[id*="pass" i]'),
        otpInputCount: selectorCount('input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="code" i], input[id*="otp" i], input[id*="code" i]'),
        accountUiCount: selectorCount('[aria-label*="account" i], [aria-label*="profile" i], [data-testid*="avatar" i], img[alt*="avatar" i], button[aria-label*="account" i], button[aria-label*="profile" i], [data-testid*="profile" i]'),
        loginActionCount: selectorCount('form input[type="password"], button[type="submit"], button[aria-label*="sign in" i], a[href*="login" i], a[href*="signin" i]'),
        localStorageKeys,
        sessionStorageKeys,
      };
    }, keywordSets);

    const cookieScope = currentUrl && /^https?:/i.test(currentUrl) ? [currentUrl] : undefined;
    const cookies = await page.context().cookies(cookieScope).catch(() => []);
    const interestingCookies = cookies
      .filter(cookie => /session|auth|token|sid|user|identity/i.test(cookie.name))
      .slice(0, 8)
      .map(cookie => ({
        name: cookie.name,
        domain: cookie.domain,
      }));

    const interestingLocalKeys = pageInspection.localStorageKeys
      .filter(key => /session|auth|token|user|tenant|workspace|profile/i.test(key))
      .slice(0, 8);
    const interestingSessionKeys = pageInspection.sessionStorageKeys
      .filter(key => /session|auth|token|user|tenant|workspace|profile|otp|code/i.test(key))
      .slice(0, 8);

    const isLoginRoute = /\\/login|\\/signin|\\/sign-in|\\/auth/i.test(pageInspection.href);
    const hasLoginForm = pageInspection.passwordInputCount > 0 || pageInspection.loginActionCount > 0;
    const hasAccountUi = pageInspection.accountUiCount > 0 || pageInspection.accountKeywordHits.length > 0;
    const hasStorageSignal =
      interestingCookies.length > 0 || interestingLocalKeys.length > 0 || interestingSessionKeys.length > 0;
    const blockedState =
      pageInspection.challengeKeywordHits.length > 0
        ? 'challenge'
        : pageInspection.twoFactorKeywordHits.length > 0 || pageInspection.otpInputCount > 0
          ? 'two_factor'
          : pageInspection.interstitialKeywordHits.length > 0
            ? 'interstitial'
            : 'none';

    const pageIdentitySignals = [
      {
        kind: 'login_form',
        matched: hasLoginForm || isLoginRoute,
        detail: hasLoginForm
          ? 'password input or login submission UI detected'
          : isLoginRoute
            ? 'current URL matches a login/auth route'
            : 'no login UI detected',
      },
      {
        kind: 'account_ui',
        matched: hasAccountUi,
        detail: hasAccountUi
          ? 'account/profile/logout markers detected on the page'
          : 'no account/profile/logout markers detected',
      },
    ];

    const protectedResourceSignals = [
      {
        kind: 'blocked_gate',
        matched: blockedState === 'none',
        detail:
          blockedState === 'none'
            ? 'no challenge, two-factor, or interstitial gate detected'
            : 'page appears blocked by a challenge or verification gate',
      },
      {
        kind: 'current_page_access',
        matched: !isLoginRoute && !hasLoginForm && blockedState === 'none',
        detail:
          !isLoginRoute && !hasLoginForm && blockedState === 'none'
            ? 'current page does not look like a login or verification entrypoint'
            : 'current page still looks like a login or verification entrypoint',
      },
    ];

    const storageSignals = [
      {
        kind: 'cookie',
        matched: interestingCookies.length > 0,
        detail:
          interestingCookies.length > 0
            ? 'auth/session-like cookies are present'
            : 'no auth/session-like cookies detected',
        matches: interestingCookies,
      },
      {
        kind: 'localStorage',
        matched: interestingLocalKeys.length > 0,
        detail:
          interestingLocalKeys.length > 0
            ? 'auth/session-like localStorage keys are present'
            : 'no auth/session-like localStorage keys detected',
        matches: interestingLocalKeys,
      },
      {
        kind: 'sessionStorage',
        matched: interestingSessionKeys.length > 0,
        detail:
          interestingSessionKeys.length > 0
            ? 'auth/session-like sessionStorage keys are present'
            : 'no auth/session-like sessionStorage keys detected',
        matches: interestingSessionKeys,
      },
    ];

    const matchedPageIdentitySignals = pageIdentitySignals.filter(signal => signal.matched).length;
    const matchedProtectedSignals = protectedResourceSignals.filter(signal => signal.matched).length;
    const matchedStorageSignals = storageSignals.filter(signal => signal.matched).length;

    let status = 'uncertain';
    let confidence = 'low';
    let recommendedAction = 'inspect';

    if (blockedState !== 'none') {
      status = 'uncertain';
      confidence = blockedState === 'unknown' ? 'low' : 'medium';
      recommendedAction = 'human_handoff';
    } else if (hasAccountUi && matchedProtectedSignals === 2 && hasStorageSignal) {
      status = 'authenticated';
      confidence = 'high';
      recommendedAction = 'continue';
    } else if (hasAccountUi && matchedProtectedSignals >= 1) {
      status = 'authenticated';
      confidence = hasStorageSignal ? 'medium' : 'low';
      recommendedAction = hasStorageSignal ? 'continue' : 'inspect';
    } else if ((hasLoginForm || isLoginRoute) && !hasStorageSignal) {
      status = 'anonymous';
      confidence = 'high';
      recommendedAction = 'reauth';
    } else if (hasLoginForm || isLoginRoute) {
      status = 'anonymous';
      confidence = 'medium';
      recommendedAction = 'reauth';
    } else if (hasStorageSignal) {
      status = 'uncertain';
      confidence = 'medium';
      recommendedAction = 'inspect';
    }

    return {
      status,
      confidence,
      blockedState,
      recommendedAction,
      signals: {
        pageIdentity: pageIdentitySignals,
        protectedResource: protectedResourceSignals,
        storage: storageSignals,
      },
      summary: {
        matchedPageIdentitySignals,
        matchedProtectedSignals,
        matchedStorageSignals,
      },
      hints: {
        requestedUrl,
        currentUrl: pageInspection.href,
        currentTitle: title,
        hasLoginForm,
        hasAccountUi,
        hasStorageSignal,
      },
    };
  }`;
}

function defaultStatePath(sessionName?: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = sessionName ? `-${sessionName}` : "";
  return resolve(".pwcli", "state", `storage-state-${stamp}${suffix}.json`);
}

export async function managedStateSave(file?: string, options?: { sessionName?: string }) {
  const path = resolve(file ?? defaultStatePath(options?.sessionName));
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
      if (
        !(error instanceof Error) ||
        !/ENOENT|no such file or directory/i.test(error.message)
      ) {
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

export async function managedAuthProbe(options?: AuthProbeOptions) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: buildAuthProbeSource(options?.url),
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  const signals =
    parsed.signals && typeof parsed.signals === "object" && !Array.isArray(parsed.signals)
      ? parsed.signals
      : {};
  const summary =
    parsed.summary && typeof parsed.summary === "object" && !Array.isArray(parsed.summary)
      ? parsed.summary
      : {};
  const hints =
    parsed.hints && typeof parsed.hints === "object" && !Array.isArray(parsed.hints)
      ? parsed.hints
      : {};

  const status =
    parsed.status === "authenticated" || parsed.status === "anonymous" || parsed.status === "uncertain"
      ? (parsed.status as AuthProbeStatus)
      : "uncertain";
  const confidence =
    parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
      ? (parsed.confidence as AuthProbeConfidence)
      : "low";
  const blockedState =
    parsed.blockedState === "none" ||
    parsed.blockedState === "challenge" ||
    parsed.blockedState === "two_factor" ||
    parsed.blockedState === "interstitial" ||
    parsed.blockedState === "unknown"
      ? (parsed.blockedState as AuthProbeBlockedState)
      : "unknown";
  const recommendedAction =
    parsed.recommendedAction === "continue" ||
    parsed.recommendedAction === "save_state" ||
    parsed.recommendedAction === "inspect" ||
    parsed.recommendedAction === "reauth" ||
    parsed.recommendedAction === "human_handoff"
      ? (parsed.recommendedAction as AuthProbeRecommendedAction)
      : "inspect";

  return {
    session: result.session,
    page: result.page,
    data: {
      status,
      confidence,
      blockedState,
      recommendedAction,
      signals: {
        pageIdentity: Array.isArray((signals as Record<string, unknown>).pageIdentity)
          ? (signals as Record<string, unknown>).pageIdentity
          : [],
        protectedResource: Array.isArray((signals as Record<string, unknown>).protectedResource)
          ? (signals as Record<string, unknown>).protectedResource
          : [],
        storage: Array.isArray((signals as Record<string, unknown>).storage)
          ? (signals as Record<string, unknown>).storage
          : [],
      },
      summary: {
        matchedPageIdentitySignals: Number(
          (summary as Record<string, unknown>).matchedPageIdentitySignals ?? 0,
        ),
        matchedProtectedSignals: Number(
          (summary as Record<string, unknown>).matchedProtectedSignals ?? 0,
        ),
        matchedStorageSignals: Number(
          (summary as Record<string, unknown>).matchedStorageSignals ?? 0,
        ),
      },
      hints,
      ...(typeof options?.url === "string" ? { requestedUrl: options.url } : {}),
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

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

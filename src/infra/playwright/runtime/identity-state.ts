import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { managedRunCode } from "./code.js";
import { maybeRawOutput } from "./shared.js";

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

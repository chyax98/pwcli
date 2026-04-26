import { runManagedSessionCommand } from "../cli-client.js";
import { parsePageSummary } from "../output-parsers.js";
import { managedRunCode } from "./code.js";
import { maybeRawOutput } from "./shared.js";

export async function managedStateSave(file?: string, options?: { sessionName?: string }) {
  const args = ["state-save"];
  if (file) {
    args.push(file);
  }
  const result = await runManagedSessionCommand(
    {
      _: args,
    },
    {
      sessionName: options?.sessionName,
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
      path: file,
      saved: true,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedStateLoad(file: string, options?: { sessionName?: string }) {
  const result = await runManagedSessionCommand(
    {
      _: ["state-load", file],
    },
    {
      sessionName: options?.sessionName,
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
      path: file,
      loaded: true,
      ...maybeRawOutput(result.text),
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

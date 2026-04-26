import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { runManagedSessionCommand } from "../session/cli-client.js";
import {
  parseDownloadEvent,
  parseErrorText,
  parseJsonStringLiteral,
  parsePageSummary,
  parseResultText,
  parseSnapshotYaml,
  stripQuotes,
} from "../session/output-parsers.js";

function maybeRawOutput(text: string) {
  return process.env.PWCLI_RAW_OUTPUT === "1" ? { output: text } : {};
}

const DIAGNOSTICS_STATE_KEY = "__pwcliDiagnostics";

function normalizeRef(ref: string) {
  return ref.startsWith("@") ? ref.slice(1) : ref;
}

async function managedEnsureDiagnosticsHooks(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      const sessionName = ${JSON.stringify(options?.sessionName ?? null)};
      state.consoleRecords = Array.isArray(state.consoleRecords) ? state.consoleRecords : [];
      state.networkRecords = Array.isArray(state.networkRecords) ? state.networkRecords : [];
      state.pageErrorRecords = Array.isArray(state.pageErrorRecords) ? state.pageErrorRecords : [];
      state.dialogRecords = Array.isArray(state.dialogRecords) ? state.dialogRecords : [];
      state.nextPageSeq = Number.isInteger(state.nextPageSeq) ? state.nextPageSeq : 1;
      state.nextRequestSeq = Number.isInteger(state.nextRequestSeq) ? state.nextRequestSeq : 1;
      state.nextDialogSeq = Number.isInteger(state.nextDialogSeq) ? state.nextDialogSeq : 1;
      state.nextNavigationSeq = Number.isInteger(state.nextNavigationSeq) ? state.nextNavigationSeq : 1;

      const now = () => new Date().toISOString();
      const keep = (list, entry, max = 200) => {
        list.push(entry);
        if (list.length > max)
          list.splice(0, list.length - max);
      };
      const ensurePageId = (p) => {
        if (!p.__pwcliPageId)
          p.__pwcliPageId = 'p' + state.nextPageSeq++;
        return p.__pwcliPageId;
      };
      const ensureNavigationId = (p) => {
        if (!p.__pwcliNavigationId)
          p.__pwcliNavigationId = 'nav-' + state.nextNavigationSeq++;
        return p.__pwcliNavigationId;
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
          keep(state.consoleRecords, {
            kind: 'console',
            sessionName,
            timestamp: now(),
            pageId: ensurePageId(p),
            navigationId: ensureNavigationId(p),
            level: msg.type(),
            text: msg.text(),
            ...(location?.url ? { location } : {}),
          });
        });
        p.on('request', req => {
          const requestId = req.__pwcliRequestId || ('req-' + state.nextRequestSeq++);
          req.__pwcliRequestId = requestId;
          const frame = typeof req.frame === 'function' ? req.frame() : null;
          keep(state.networkRecords, {
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
        p.on('response', res => {
          const req = res.request();
          const requestId = req.__pwcliRequestId || ('req-' + state.nextRequestSeq++);
          req.__pwcliRequestId = requestId;
          const frame = typeof req.frame === 'function' ? req.frame() : null;
          keep(state.networkRecords, {
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

      return JSON.stringify({
        installed: true,
        pageIds: context.pages().map(current => ensurePageId(current)),
        consoleCount: state.consoleRecords.length,
        networkCount: state.networkRecords.length,
      });
    }`,
  });
  return result.data.result;
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
  },
) {
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
      createIfMissing: true,
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
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedSnapshot(options?: { depth?: number; sessionName?: string }) {
  const args = ["snapshot"];
  if (options?.depth) {
    args.push(`--depth=${options.depth}`);
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
      mode: "ai",
      snapshot: parseSnapshotYaml(result.text),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedRunCode(options: {
  source?: string;
  file?: string;
  sessionName?: string;
}) {
  const args = ["run-code"];
  let source = options.source;
  let filename: string | undefined;
  if (options.file) {
    filename = resolve(options.file);
    source = await readFile(filename, "utf8");
  }
  if (source) {
    args.push(source);
  }
  const result = await runManagedSessionCommand(
    {
      _: args,
      ...(filename ? { filename } : {}),
    },
    {
      sessionName: options.sessionName,
    },
  );
  const errorText = parseErrorText(result.text);
  if (errorText) {
    throw new Error(errorText);
  }
  const resultText = parseResultText(result.text);
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    rawText: result.text,
    data: {
      resultText,
      result: parseJsonStringLiteral(resultText),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedClick(options: {
  ref?: string;
  selector?: string;
  button?: string;
  sessionName?: string;
}) {
  if (!options.ref && !options.selector) {
    throw new Error("click requires a ref or selector");
  }

  if (options.selector) {
    const button = options.button ? JSON.stringify({ button: options.button }) : "undefined";
    const result = await managedRunCode({
      sessionName: options.sessionName,
      source: `async page => {
        await page.locator(${JSON.stringify(options.selector)}).click(${button});
        return 'clicked';
      }`,
    });

    return {
      session: result.session,
      page: result.page,
      data: {
        selector: options.selector,
        ...(options.button ? { button: options.button } : {}),
        acted: true,
      },
    };
  }

  const ref = normalizeRef(options.ref ?? "");
  const args = ["click", ref];
  if (options.button) {
    args.push(options.button);
  }

  const result = await runManagedSessionCommand(
    {
      _: args,
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
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      acted: true,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedFill(options: {
  ref?: string;
  selector?: string;
  value: string;
  sessionName?: string;
}) {
  if (!options.ref && !options.selector) {
    throw new Error("fill requires a ref or selector");
  }

  if (options.selector) {
    const result = await managedRunCode({
      sessionName: options.sessionName,
      source: `async page => {
        await page.locator(${JSON.stringify(options.selector)}).fill(${JSON.stringify(options.value)});
        return 'filled';
      }`,
    });

    return {
      session: result.session,
      page: result.page,
      data: {
        selector: options.selector,
        value: options.value,
        filled: true,
      },
    };
  }

  const result = await runManagedSessionCommand(
    {
      _: ["fill", normalizeRef(options.ref ?? ""), options.value],
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
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      value: options.value,
      filled: true,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedType(options: {
  ref?: string;
  selector?: string;
  value: string;
  sessionName?: string;
}) {
  if (!options.ref && !options.selector) {
    const result = await runManagedSessionCommand(
      {
        _: ["type", options.value],
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
        value: options.value,
        typed: true,
        ...maybeRawOutput(result.text),
      },
    };
  }

  const target = options.ref ? normalizeRef(options.ref) : options.selector;
  const source = options.ref
    ? `async page => { await page.locator(${JSON.stringify(`aria-ref=${target}`)}).type(${JSON.stringify(options.value)}); return 'typed'; }`
    : `async page => { await page.locator(${JSON.stringify(options.selector)}).type(${JSON.stringify(options.value)}); return 'typed'; }`;

  const result = await managedRunCode({ source, sessionName: options.sessionName });
  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      value: options.value,
      typed: true,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedPress(key: string, options?: { sessionName?: string }) {
  const result = await runManagedSessionCommand(
    {
      _: ["press", key],
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
      key,
      pressed: true,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedScroll(options: {
  direction: "up" | "down" | "left" | "right";
  distance?: number;
  sessionName?: string;
}) {
  const distance = options.distance ?? 500;
  const delta = {
    up: [0, -distance],
    down: [0, distance],
    left: [-distance, 0],
    right: [distance, 0],
  }[options.direction];

  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await page.mouse.wheel(${delta[0]}, ${delta[1]});
      return JSON.stringify({ direction: ${JSON.stringify(options.direction)}, distance: ${distance} });
    }`,
  });

  return {
    session: result.session,
    page: result.page,
    data: {
      direction: options.direction,
      distance,
      scrolled: true,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

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

export async function managedScreenshot(options?: {
  ref?: string;
  selector?: string;
  path?: string;
  fullPage?: boolean;
  sessionName?: string;
}) {
  const target = options?.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : options?.selector
      ? `page.locator(${JSON.stringify(options.selector)})`
      : "page";
  const method = options?.ref || options?.selector ? "screenshot" : "screenshot";
  const source = `async page => {
    const target = ${target};
    await target.${method}(${JSON.stringify({
      ...(options?.path ? { path: options.path } : {}),
      ...(options?.fullPage && !options?.ref && !options?.selector ? { fullPage: true } : {}),
    })});
    return JSON.stringify({
      path: ${JSON.stringify(options?.path ?? "")},
      ${options?.ref ? `ref: ${JSON.stringify(normalizeRef(options.ref))},` : ""}
      ${options?.selector ? `selector: ${JSON.stringify(options.selector)},` : ""}
      ${options?.fullPage ? "fullPage: true," : ""}
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
      ...parsed,
      captured: true,
    },
  };
}

export async function managedTrace(action: "start" | "stop", options?: { sessionName?: string }) {
  const command = action === "start" ? "tracing-start" : "tracing-stop";
  const result = await runManagedSessionCommand(
    {
      _: [command],
    },
    {
      sessionName: options?.sessionName,
    },
  );
  const traceState = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.trace = {
        active: ${action === "start" ? "true" : "false"},
        supported: true,
        lastAction: ${JSON.stringify(action)},
        updatedAt: new Date().toISOString(),
      };
      return JSON.stringify(state.trace);
    }`,
  })
    .then((traceResult) => traceResult.data.result)
    .catch(() => undefined);

  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      action,
      started: action === "start" ? true : undefined,
      stopped: action === "stop" ? true : undefined,
      ...(traceState ? { trace: traceState } : {}),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedErrors(
  action: "recent" | "clear",
  options?: { sessionName?: string },
) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.pageErrorRecords = Array.isArray(state.pageErrorRecords) ? state.pageErrorRecords : [];
      const allErrors = state.pageErrorRecords;
      const clearedCount = Number.isInteger(state.pageErrorClearedCount) ? state.pageErrorClearedCount : 0;
      if (${JSON.stringify(action)} === 'clear') {
        state.pageErrorClearedCount = allErrors.length;
        return JSON.stringify({
          action: 'clear',
          cleared: true,
          totalErrors: allErrors.length,
          clearedCount: allErrors.length,
          visibleCount: 0,
          errors: [],
        });
      }
      const errors = allErrors.slice(clearedCount).map((error, index) => ({
        index: clearedCount + index + 1,
        ...error,
      }));
      return JSON.stringify({
        action: 'recent',
        clearedCount,
        totalErrors: allErrors.length,
        visibleCount: errors.length,
        errors,
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      action,
      summary: {
        total: Number(parsed.totalErrors ?? 0),
        visible: Number(parsed.visibleCount ?? 0),
        clearedCount: Number(parsed.clearedCount ?? 0),
      },
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    },
  };
}

export async function managedRoute(
  action: "add" | "remove",
  options: {
    pattern?: string;
    abort?: boolean;
    body?: string;
    status?: number;
    contentType?: string;
    sessionName?: string;
  },
) {
  if (action === "add" && !options.pattern) {
    throw new Error("route add requires a pattern");
  }

  const config = {
    abort: Boolean(options.abort),
    body: options.body,
    status: options.status,
    contentType: options.contentType,
  };
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source:
      action === "add"
        ? `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.routes = Array.isArray(state.routes) ? state.routes : [];
      const pattern = ${JSON.stringify(options.pattern)};
      const config = ${JSON.stringify(config)};
      await context.route(pattern, async route => {
        if (config.abort) {
          await route.abort();
          return;
        }
        if (config.body !== undefined || config.status !== undefined || config.contentType !== undefined) {
          const fulfillOptions = {
            status: config.status ?? 200,
            body: config.body ?? '',
          };
          if (config.contentType)
            fulfillOptions.contentType = config.contentType;
          await route.fulfill(fulfillOptions);
          return;
        }
        await route.continue();
      });
      const routeRecord = {
        pattern,
        mode: config.abort ? 'abort' : (config.body !== undefined || config.status !== undefined || config.contentType !== undefined) ? 'fulfill' : 'continue',
        addedAt: new Date().toISOString(),
      };
      if (config.status !== undefined)
        routeRecord.status = config.status;
      if (config.contentType)
        routeRecord.contentType = config.contentType;
      if (config.body !== undefined) {
        routeRecord.hasBody = true;
        routeRecord.bodyPreview = config.body.length > 120 ? config.body.slice(0, 120) + '...' : config.body;
      }
      state.routes.push(routeRecord);
      return JSON.stringify({
        action: 'add',
        added: true,
        route: routeRecord,
        routeCount: state.routes.length,
      });
    }`
        : `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      const pattern = ${JSON.stringify(options.pattern ?? null)};
      const existing = Array.isArray(state.routes) ? state.routes : [];
      if (pattern) {
        await context.unroute(pattern);
        state.routes = existing.filter(route => route.pattern !== pattern);
      } else {
        await context.unrouteAll({ behavior: 'ignoreErrors' });
        state.routes = [];
      }
      return JSON.stringify({
        action: 'remove',
        removedPattern: pattern,
        removedCount: pattern ? existing.length - state.routes.length : existing.length,
        routeCount: state.routes.length,
        routes: state.routes,
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      action,
      ...(action === "add" ? { added: true } : { removed: true }),
      ...(parsed.route ? { route: parsed.route } : {}),
      ...(parsed.removedPattern !== undefined ? { pattern: parsed.removedPattern } : {}),
      ...(parsed.removedCount !== undefined ? { removedCount: parsed.removedCount } : {}),
      routeCount: Number(parsed.routeCount ?? 0),
      ...(Array.isArray(parsed.routes) ? { routes: parsed.routes } : {}),
    },
  };
}

export async function managedHar(
  action: "start" | "stop",
  options?: { path?: string; sessionName?: string },
) {
  const limitation =
    "Current managed sessions do not expose HAR start/stop on an existing BrowserContext. Recreate the session with HAR recording once the substrate exists.";
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.har = {
        supported: false,
        active: false,
        lastAction: ${JSON.stringify(action)},
        limitation: ${JSON.stringify(limitation)},
        updatedAt: new Date().toISOString(),
      };
      if (${JSON.stringify(options?.path ?? null)})
        state.har.requestedPath = ${JSON.stringify(options?.path ?? null)};
      return JSON.stringify(state.har);
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      action,
      supported: false,
      limitation,
      ...(options?.path ? { requestedPath: resolve(options.path) } : {}),
      har: parsed,
    },
  };
}

export async function managedObserveStatus(options?: { sessionName?: string }) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      const pages = context.pages();
      state.consoleRecords = Array.isArray(state.consoleRecords) ? state.consoleRecords : [];
      state.networkRecords = Array.isArray(state.networkRecords) ? state.networkRecords : [];
      state.pageErrorRecords = Array.isArray(state.pageErrorRecords) ? state.pageErrorRecords : [];
      state.dialogRecords = Array.isArray(state.dialogRecords) ? state.dialogRecords : [];
      const clearedCount = Number.isInteger(state.pageErrorClearedCount) ? state.pageErrorClearedCount : 0;
      const visibleCount = Math.max(0, state.pageErrorRecords.length - clearedCount);
      const routes = Array.isArray(state.routes) ? state.routes : [];
      const trace = state.trace || { supported: true, active: false };
      const har = state.har || {
        supported: false,
        active: false,
        limitation: 'Current managed sessions do not expose HAR start/stop on an existing BrowserContext.',
      };
      const bootstrap = state.bootstrap || {
        applied: false,
        initScriptCount: 0,
        headersApplied: false,
      };
      const workspacePages = await Promise.all(pages.map(async item => ({
        pageId: item.__pwcliPageId || null,
        navigationId: item.__pwcliNavigationId || null,
        url: item.url(),
        title: await item.title().catch(() => ''),
        current: item === page,
        openerPageId: item.opener()?.__pwcliPageId || null,
      })));
      return JSON.stringify({
        page: {
          pageId: page.__pwcliPageId || null,
          navigationId: page.__pwcliNavigationId || null,
          url: page.url(),
          title: await page.title().catch(() => ''),
        },
        workspace: {
          pageCount: pages.length,
          currentPageId: page.__pwcliPageId || null,
          pages: workspacePages,
        },
        console: {
          total: state.consoleRecords.length,
          last: state.consoleRecords.at(-1) || null,
        },
        network: {
          total: state.networkRecords.length,
          requests: state.networkRecords.filter(record => record.event === 'request').length,
          responses: state.networkRecords.filter(record => record.event === 'response').length,
          failures: state.networkRecords.filter(record => record.event === 'requestfailed').length,
          last: state.networkRecords.at(-1) || null,
        },
        routes: {
          count: routes.length,
          items: routes,
        },
        dialogs: {
          count: state.dialogRecords.length,
          items: state.dialogRecords.slice(-20),
        },
        pageErrors: {
          total: state.pageErrorRecords.length,
          clearedCount,
          visibleCount,
          last: state.pageErrorRecords.at(-1) || null,
        },
        trace,
        har,
        bootstrap,
        stream: {
          supported: false,
          active: false,
          limitation: 'observe stream is not wired yet on the managed session substrate',
        },
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      status: parsed,
      workspace: parsed.workspace,
      console: parsed.console,
      network: parsed.network,
      routes: parsed.routes,
      dialogs: parsed.dialogs,
      pageErrors: parsed.pageErrors,
      trace: parsed.trace,
      har: parsed.har,
      bootstrap: parsed.bootstrap,
      stream: parsed.stream,
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

export async function managedUpload(options: {
  ref?: string;
  selector?: string;
  files: string[];
  sessionName?: string;
}) {
  const files = options.files.map((file) => JSON.stringify(resolve(file))).join(", ");
  const target = options.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : `page.locator(${JSON.stringify(options.selector)})`;
  if (!options.ref && !options.selector) {
    throw new Error("upload requires a ref or selector");
  }

  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await ${target}.setInputFiles([${files}]);
      return JSON.stringify({ uploaded: true });
    }`,
  });
  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      files: options.files.map((file) => resolve(file)),
      uploaded: true,
    },
  };
}

export async function managedDrag(options: {
  fromRef?: string;
  toRef?: string;
  fromSelector?: string;
  toSelector?: string;
  sessionName?: string;
}) {
  const source = options.fromRef
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.fromRef)}`)})`
    : `page.locator(${JSON.stringify(options.fromSelector)})`;
  const target = options.toRef
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.toRef)}`)})`
    : `page.locator(${JSON.stringify(options.toSelector)})`;

  if ((!options.fromRef && !options.fromSelector) || (!options.toRef && !options.toSelector)) {
    throw new Error("drag requires source and target");
  }

  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await ${source}.dragTo(${target});
      return JSON.stringify({ dragged: true });
    }`,
  });

  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.fromRef
        ? { fromRef: normalizeRef(options.fromRef) }
        : { fromSelector: options.fromSelector }),
      ...(options.toRef
        ? { toRef: normalizeRef(options.toRef) }
        : { toSelector: options.toSelector }),
      dragged: true,
    },
  };
}

export async function managedDownload(options: {
  ref?: string;
  selector?: string;
  path?: string;
  dir?: string;
  sessionName?: string;
}) {
  if (!options.ref && !options.selector) {
    throw new Error("download requires a ref or selector");
  }
  const target = options.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : `page.locator(${JSON.stringify(options.selector)})`;

  const dir = options.dir ? resolve(options.dir) : undefined;
  const exactPath = options.path ? resolve(options.path) : undefined;
  if (dir) {
    await mkdir(dir, { recursive: true });
  }
  if (exactPath) {
    await mkdir(dirname(exactPath), { recursive: true });
  }

  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await ${target}.click();
      return 'clicked';
    }`,
  });
  const downloadEvent = parseDownloadEvent(result.rawText ?? "");
  if (!downloadEvent) {
    throw new Error("No download event captured");
  }
  const sourcePath = resolve(downloadEvent.outputPath);
  const savedAs = dir ? join(dir, downloadEvent.suggestedFilename) : exactPath;
  if (savedAs) {
    await copyFile(sourcePath, savedAs);
  }

  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      ...(dir ? { dir } : {}),
      ...(exactPath ? { requestedPath: exactPath } : {}),
      suggestedFilename: downloadEvent.suggestedFilename,
      sourcePath,
      ...(savedAs ? { savedAs } : {}),
      downloaded: true,
    },
  };
}

export async function managedReadText(options?: {
  selector?: string;
  maxChars?: number;
  sessionName?: string;
}) {
  const source = options?.selector
    ? `async page => {
      const text = await page.locator(${JSON.stringify(options.selector)}).innerText().catch(() => '');
      return JSON.stringify({ source: 'selector', selector: ${JSON.stringify(options.selector)}, text });
    }`
    : `async page => {
      const text = await page.evaluate(() => document.body?.innerText ?? '');
      return JSON.stringify({ source: 'body-visible', text });
    }`;

  const result = await managedRunCode({ source, sessionName: options?.sessionName });
  const parsed = result.data.result || {};
  const rawText = parsed.text ?? "";
  const text =
    options?.maxChars !== undefined && rawText.length > options.maxChars
      ? rawText.slice(0, options.maxChars)
      : rawText;

  return {
    session: result.session,
    page: result.page,
    data: {
      ...parsed,
      text,
      truncated: text.length !== rawText.length,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedPageCurrent(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      return JSON.stringify({
        url: page.url(),
        title: await page.title(),
        pageCount: page.context().pages().length,
      });
    }`,
  });
  const parsed = result.data.result || {};
  return {
    session: result.session,
    page: {
      id: "p1",
      url: parsed.url ?? "",
      title: parsed.title ?? "",
      current: true,
    },
    data: {
      activePageId: "p1",
      pageCount: parsed.pageCount ?? 1,
      pages: [
        {
          id: "p1",
          url: parsed.url ?? "",
          title: parsed.title ?? "",
          current: true,
        },
      ],
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedPageList(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const pages = page.context().pages();
      const current = page;
      return JSON.stringify({
        pages: await Promise.all(pages.map(async (p, index) => ({
          id: 'p' + (index + 1),
          url: p.url(),
          title: await p.title().catch(() => ''),
          current: p === current,
        }))),
      });
    }`,
  });
  const parsed = result.data.result || {};
  const current = parsed.pages?.find((entry) => entry.current) ?? parsed.pages?.[0];

  return {
    session: result.session,
    page: current,
    data: {
      activePageId: current?.id ?? "p1",
      pageCount: parsed.pages?.length ?? 0,
      pages: parsed.pages ?? [],
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedPageFrames(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const frames = page.frames().map((frame, index) => ({
        index,
        url: frame.url(),
        name: frame.name(),
        main: frame === page.mainFrame(),
      }));
      return JSON.stringify({ frames });
    }`,
  });
  const parsed = result.data.result || {};
  return {
    session: result.session,
    page: result.page,
    data: {
      activePageId: "p1",
      frameCount: parsed.frames?.length ?? 0,
      frames: parsed.frames ?? [],
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedConsole(level?: string, options?: { sessionName?: string }) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] || {};
      const records = Array.isArray(state.consoleRecords) ? state.consoleRecords : [];
      const order = { error: 3, warning: 2, warn: 2, info: 1, log: 1, debug: 0 };
      const threshold = ${JSON.stringify(level ?? "info")};
      const thresholdRank = order[threshold] ?? 1;
      const filtered = records.filter(record => (order[record.level] ?? 1) >= thresholdRank);
      return JSON.stringify({
        total: filtered.length,
        errors: filtered.filter(record => record.level === 'error').length,
        warnings: filtered.filter(record => record.level === 'warning' || record.level === 'warn').length,
        sample: filtered.slice(-20),
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      summary: parsed,
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function managedNetwork(options?: { sessionName?: string }) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] || {};
      const records = Array.isArray(state.networkRecords) ? state.networkRecords : [];
      const sample = records.slice(-20);
      return JSON.stringify({
        total: records.length,
        sample,
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      summary: parsed,
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function managedWait(options: {
  target?: string;
  text?: string;
  selector?: string;
  networkidle?: boolean;
  request?: string;
  response?: string;
  method?: string;
  status?: string;
  sessionName?: string;
}) {
  let source = "";

  if (options.target && /^\d+$/.test(options.target)) {
    source = `async page => { await page.waitForTimeout(${Number(options.target)}); return 'delay'; }`;
  } else if (options.request) {
    source = `async page => {
      const request = await page.waitForRequest(request => {
        if (!request.url().includes(${JSON.stringify(options.request)}))
          return false;
        ${options.method ? `if (request.method() !== ${JSON.stringify(options.method.toUpperCase())}) return false;` : ""}
        return true;
      });
      return JSON.stringify({ kind: 'request', url: request.url(), method: request.method() });
    }`;
  } else if (options.response) {
    source = `async page => {
      const response = await page.waitForResponse(response => {
        if (!response.url().includes(${JSON.stringify(options.response)}))
          return false;
        ${options.method ? `if (response.request().method() !== ${JSON.stringify(options.method.toUpperCase())}) return false;` : ""}
        ${options.status ? `if (String(response.status()) !== ${JSON.stringify(options.status)}) return false;` : ""}
        return true;
      });
      return JSON.stringify({ kind: 'response', url: response.url(), method: response.request().method(), status: response.status() });
    }`;
  } else if (options.networkidle) {
    source = `async page => { await page.waitForLoadState('networkidle'); return 'networkidle'; }`;
  } else if (options.selector) {
    source = `async page => { await page.locator(${JSON.stringify(options.selector)}).waitFor(); return 'selector'; }`;
  } else if (options.text) {
    source = `async page => { await page.getByText(${JSON.stringify(options.text)}, { exact: true }).waitFor(); return 'text'; }`;
  } else if (options.target) {
    source = `async page => { await page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.target)}`)}).waitFor(); return 'ref'; }`;
  } else {
    throw new Error("wait requires a condition");
  }

  const result = await managedRunCode({ source, sessionName: options.sessionName });

  return {
    session: result.session,
    page: await managedPageCurrent({ sessionName: options.sessionName }).then(
      (pageResult) => pageResult.page,
    ),
    data: {
      condition:
        typeof result.data.result === "string"
          ? stripQuotes(result.data.result)
          : typeof result.data.result === "object" && result.data.result
            ? result.data.result
            : String(result.data.result ?? ""),
      matched: true,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

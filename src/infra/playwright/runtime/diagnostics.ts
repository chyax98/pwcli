import { resolve } from "node:path";
import { runManagedSessionCommand } from "../cli-client.js";
import { parsePageSummary } from "../output-parsers.js";
import { managedRunCode } from "./code.js";
import { managedWorkspaceProjection } from "./workspace.js";
import { DIAGNOSTICS_STATE_KEY, maybeRawOutput } from "./shared.js";
import { managedEnsureDiagnosticsHooks } from "./hooks.js";

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
  const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
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
      return JSON.stringify({
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
    session: projection.session,
    page: projection.page,
    data: {
      status: {
        page: projection.data.page,
        workspace: projection.data.workspace,
        dialogs: projection.data.dialogs,
        ...parsed,
      },
      workspace: projection.data.workspace,
      console: parsed.console,
      network: parsed.network,
      routes: parsed.routes,
      dialogs: projection.data.dialogs,
      pageErrors: parsed.pageErrors,
      trace: parsed.trace,
      har: parsed.har,
      bootstrap: parsed.bootstrap,
      stream: parsed.stream,
    },
  };
}

export async function managedConsole(
  level?: string,
  options?: { sessionName?: string; text?: string },
) {
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
      const textFilter = ${JSON.stringify(options?.text ?? "")};
      const filtered = records.filter(record => {
        if ((order[record.level] ?? 1) < thresholdRank)
          return false;
        if (textFilter && !String(record.text || '').includes(textFilter))
          return false;
        return true;
      });
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

export async function managedNetwork(options?: {
  sessionName?: string;
  requestId?: string;
  method?: string;
  status?: string;
  resourceType?: string;
  text?: string;
}) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] || {};
      const records = Array.isArray(state.networkRecords) ? state.networkRecords : [];
      const requestId = ${JSON.stringify(options?.requestId ?? "")};
      const methodFilter = ${JSON.stringify(options?.method?.toUpperCase() ?? "")};
      const statusFilter = ${JSON.stringify(options?.status ?? "")};
      const resourceTypeFilter = ${JSON.stringify(options?.resourceType ?? "")};
      const textFilter = ${JSON.stringify(options?.text ?? "")};
      const filtered = records.filter(record => {
        if (requestId && record.requestId !== requestId)
          return false;
        if (methodFilter && String(record.method || '').toUpperCase() !== methodFilter)
          return false;
        if (statusFilter && String(record.status ?? '') !== statusFilter)
          return false;
        if (resourceTypeFilter && String(record.resourceType || '') !== resourceTypeFilter)
          return false;
        if (textFilter) {
          const haystack = [record.url, record.failureText, record.method, record.resourceType].filter(Boolean).join(' ');
          if (!haystack.includes(textFilter))
            return false;
        }
        return true;
      });
      const sample = filtered.slice(-20);
      const detail = requestId ? filtered[filtered.length - 1] || null : null;
      return JSON.stringify({
        total: filtered.length,
        sample,
        detail,
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
      ...(parsed.detail ? { detail: parsed.detail } : {}),
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function captureDiagnosticsBaseline(sessionName?: string) {
  const status = await managedObserveStatus({ sessionName });
  return {
    consoleTotal: status.data.console?.total ?? 0,
    networkTotal: status.data.network?.total ?? 0,
    pageErrorTotal: status.data.pageErrors?.total ?? 0,
  };
}

export async function buildDiagnosticsDelta(
  sessionName: string | undefined,
  before: { consoleTotal: number; networkTotal: number; pageErrorTotal: number },
) {
  const status = await managedObserveStatus({ sessionName });
  return {
    consoleDelta: Math.max(0, (status.data.console?.total ?? 0) - before.consoleTotal),
    networkDelta: Math.max(0, (status.data.network?.total ?? 0) - before.networkTotal),
    pageErrorDelta: Math.max(0, (status.data.pageErrors?.total ?? 0) - before.pageErrorTotal),
    lastConsole: status.data.console?.last ?? null,
    lastNetwork: status.data.network?.last ?? null,
    lastPageError: status.data.pageErrors?.last ?? null,
  };
}

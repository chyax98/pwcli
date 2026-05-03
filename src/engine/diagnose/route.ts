import { managedRunCode, stateAccessPrelude } from "../shared.js";

export async function managedRoute(
  action: "add" | "remove" | "list",
  options: {
    pattern?: string;
    abort?: boolean;
    body?: string;
    status?: number;
    contentType?: string;
    headers?: Record<string, string>;
    mergeHeaders?: Record<string, string>;
    matchBody?: string;
    matchQuery?: Record<string, string>;
    matchHeaders?: Record<string, string>;
    matchJson?: unknown;
    injectHeaders?: Record<string, string>;
    patchJson?: unknown;
    patchText?: Record<string, string>;
    patchStatus?: number;
    method?: string;
    sessionName?: string;
  },
) {
  if (action === "add" && !options.pattern) {
    throw new Error("route add requires a pattern");
  }
  const hasFulfill =
    options.body !== undefined ||
    options.status !== undefined ||
    options.contentType !== undefined ||
    options.headers !== undefined;
  const hasPatch =
    options.patchJson !== undefined ||
    options.patchText !== undefined ||
    options.patchStatus !== undefined;
  if (action === "add" && options.injectHeaders && (options.abort || hasFulfill)) {
    throw new Error("route add inject mode cannot be combined with abort or fulfill options");
  }
  if (action === "add" && hasPatch && (options.abort || hasFulfill || options.injectHeaders)) {
    throw new Error(
      "route add response patch mode cannot be combined with abort, fulfill, or inject options",
    );
  }

  const config = {
    abort: Boolean(options.abort),
    body: options.body,
    status: options.status,
    contentType: options.contentType,
    headers: options.headers,
    mergeHeaders: options.mergeHeaders,
    matchBody: options.matchBody,
    matchQuery: options.matchQuery,
    matchHeaders: options.matchHeaders,
    matchJson: options.matchJson,
    injectHeaders: options.injectHeaders,
    patchJson: options.patchJson,
    patchText: options.patchText,
    patchStatus: options.patchStatus,
    method: options.method?.toUpperCase(),
  };
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source:
      action === "list"
        ? `async page => {
      ${stateAccessPrelude()}
      state.routes = Array.isArray(state.routes) ? state.routes : [];
      return JSON.stringify({
        action: 'list',
        routeCount: state.routes.length,
        routes: state.routes,
      });
    }`
        : action === "add"
          ? `async page => {
      ${stateAccessPrelude()}
      state.routes = Array.isArray(state.routes) ? state.routes : [];
      const pattern = ${JSON.stringify(options.pattern)};
      const config = ${JSON.stringify(config)};
      const applyMergePatch = (target, patch) => {
        if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
          return patch;
        }
        const base =
          target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
        for (const [key, value] of Object.entries(patch)) {
          if (value === null) {
            delete base[key];
            continue;
          }
          base[key] = applyMergePatch(base[key], value);
        }
        return base;
      };
      const containsSubset = (target, subset) => {
        if (subset === null || typeof subset !== 'object' || Array.isArray(subset))
          return JSON.stringify(target) === JSON.stringify(subset);
        if (target === null || typeof target !== 'object' || Array.isArray(target))
          return false;
        return Object.entries(subset).every(([key, value]) => containsSubset(target[key], value));
      };
      await context.route(pattern, async route => {
        const request = route.request();
        if (config.method && request.method().toUpperCase() !== config.method) {
          await route.fallback();
          return;
        }
        if (config.matchBody) {
          const postData = request.postData();
          if (typeof postData !== 'string' || !postData.includes(config.matchBody)) {
            await route.fallback();
            return;
          }
        }
        if (config.matchQuery) {
          const url = new URL(request.url());
          const queryMatched = Object.entries(config.matchQuery).every(([key, value]) => url.searchParams.get(key) === value);
          if (!queryMatched) {
            await route.fallback();
            return;
          }
        }
        if (config.matchHeaders) {
          const headers = await request.allHeaders();
          const headersMatched = Object.entries(config.matchHeaders).every(([key, value]) => String(headers[key] || '') === value);
          if (!headersMatched) {
            await route.fallback();
            return;
          }
        }
        if (config.matchJson !== undefined) {
          const postData = request.postData();
          if (typeof postData !== 'string') {
            await route.fallback();
            return;
          }
          let parsedBody;
          try {
            parsedBody = JSON.parse(postData);
          } catch {
            await route.fallback();
            return;
          }
          if (!containsSubset(parsedBody, config.matchJson)) {
            await route.fallback();
            return;
          }
        }
        if (config.injectHeaders) {
          const requestHeaders = await request.allHeaders();
          await route.continue({
            headers: {
              ...requestHeaders,
              ...config.injectHeaders,
            },
          });
          return;
        }
        if (config.abort) {
          await route.abort();
          return;
        }
        if (config.patchJson !== undefined || config.patchText !== undefined || config.patchStatus !== undefined) {
          const upstream = await route.fetch();
          const headers = { ...upstream.headers() };
          if (config.mergeHeaders)
            Object.assign(headers, config.mergeHeaders);
          delete headers['content-length'];
          const status = config.patchStatus ?? upstream.status();
          if (config.patchJson === undefined && config.patchText === undefined) {
            await route.fulfill({
              response: upstream,
              status,
              headers,
            });
            return;
          }
          const sourceText = await upstream.text();
          if (config.patchText !== undefined) {
            let patchedText = sourceText;
            for (const [from, to] of Object.entries(config.patchText)) {
              patchedText = patchedText.split(from).join(to);
            }
            await route.fulfill({
              response: upstream,
              status,
              headers,
              body: patchedText,
            });
            return;
          }
          const contentType = String(headers['content-type'] || '');
          if (!contentType.includes('application/json')) {
            throw new Error('route patch json mode requires an upstream application/json response');
          }
          const sourceJson = sourceText ? JSON.parse(sourceText) : null;
          const patchedJson = applyMergePatch(sourceJson, config.patchJson);
          headers['content-type'] = contentType || 'application/json; charset=utf-8';
          await route.fulfill({
            response: upstream,
            status,
            headers,
            body: JSON.stringify(patchedJson),
          });
          return;
        }
        if (config.body !== undefined || config.status !== undefined || config.contentType !== undefined || config.headers !== undefined) {
          const fulfillOptions = {
            status: config.status ?? 200,
            body: config.body ?? '',
          };
          if (config.contentType)
            fulfillOptions.contentType = config.contentType;
          if (config.headers)
            fulfillOptions.headers = config.headers;
          await route.fulfill(fulfillOptions);
          return;
        }
        await route.continue();
      });
      const routeRecord = {
        pattern,
        mode: config.abort
          ? 'abort'
          : config.injectHeaders
            ? 'inject-continue'
            : (config.patchJson !== undefined || config.patchText !== undefined || config.patchStatus !== undefined)
              ? 'patch-response'
              : (config.body !== undefined || config.status !== undefined || config.contentType !== undefined || config.headers !== undefined)
                ? 'fulfill'
                : 'continue',
        addedAt: new Date().toISOString(),
      };
      if (config.status !== undefined)
        routeRecord.status = config.status;
      if (config.patchStatus !== undefined)
        routeRecord.patchStatus = config.patchStatus;
      if (config.contentType)
        routeRecord.contentType = config.contentType;
      if (config.method)
        routeRecord.method = config.method;
      if (config.matchBody)
        routeRecord.matchBody = config.matchBody;
      if (config.matchQuery)
        routeRecord.matchQuery = config.matchQuery;
      if (config.matchHeaders)
        routeRecord.matchHeaders = config.matchHeaders;
      if (config.matchJson !== undefined)
        routeRecord.matchJson = config.matchJson;
      if (config.headers)
        routeRecord.headers = config.headers;
      if (config.mergeHeaders)
        routeRecord.mergeHeaders = config.mergeHeaders;
      if (config.injectHeaders)
        routeRecord.injectHeaders = config.injectHeaders;
      if (config.patchJson !== undefined)
        routeRecord.patchJson = config.patchJson;
      if (config.patchText !== undefined)
        routeRecord.patchText = config.patchText;
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
      ${stateAccessPrelude()}
      const pattern = ${JSON.stringify(options.pattern ?? null)};
      const existing = Array.isArray(state.routes) ? state.routes : [];
      if (pattern) {
        await context.unroute(pattern);
        if (typeof pattern === 'string' && pattern.startsWith('**/')) {
          await context.unroute(pattern.slice(2)).catch(() => {});
        }
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
      ...(action === "add" ? { added: true } : {}),
      ...(action === "remove" ? { removed: true } : {}),
      ...(parsed.route ? { route: parsed.route } : {}),
      ...(parsed.removedPattern !== undefined ? { pattern: parsed.removedPattern } : {}),
      ...(parsed.removedCount !== undefined ? { removedCount: parsed.removedCount } : {}),
      routeCount: Number(parsed.routeCount ?? 0),
      ...(Array.isArray(parsed.routes) ? { routes: parsed.routes } : {}),
    },
  };
}


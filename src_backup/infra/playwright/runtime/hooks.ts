import { managedRunCode } from "./code.js";
import { pageIdRuntimePrelude } from "./workspace.js";

export async function managedEnsureDiagnosticsHooks(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${pageIdRuntimePrelude()}

      const sessionName = ${JSON.stringify(options?.sessionName ?? null)};
      state.consoleRecords = Array.isArray(state.consoleRecords) ? state.consoleRecords : [];
      state.networkRecords = Array.isArray(state.networkRecords) ? state.networkRecords : [];
      state.pageErrorRecords = Array.isArray(state.pageErrorRecords) ? state.pageErrorRecords : [];
      state.dialogRecords = Array.isArray(state.dialogRecords) ? state.dialogRecords : [];
      state.nextRequestSeq = Number.isInteger(state.nextRequestSeq) ? state.nextRequestSeq : 1;
      state.nextConsoleResourceSeq = Number.isInteger(state.nextConsoleResourceSeq) ? state.nextConsoleResourceSeq : 1;
      state.nextDialogSeq = Number.isInteger(state.nextDialogSeq) ? state.nextDialogSeq : 1;
      state.sseRecords = Array.isArray(state.sseRecords) ? state.sseRecords : [];
      state.nextSseSeq = Number.isInteger(state.nextSseSeq) ? state.nextSseSeq : 1;

      const now = () => new Date().toISOString();
      const keep = (list, entry, max = 200) => {
        list.push(entry);
        if (list.length > max)
          list.splice(0, list.length - max);
      };
      const clipSnippet = (value, max = 240) => {
        const text = String(value ?? '');
        return {
          snippet: text.length > max ? text.slice(0, max) + '...' : text,
          truncated: text.length > max,
        };
      };
      const FULL_BODY_LIMIT = 50000;
      const clipBody = (value) => {
        const text = String(value ?? '');
        return {
          body: text.length > FULL_BODY_LIMIT ? text.slice(0, FULL_BODY_LIMIT) + '...' : text,
          truncated: text.length > FULL_BODY_LIMIT,
        };
      };
      const isTextLikeContentType = (value) => {
        const contentType = String(value || '').toLowerCase();
        return Boolean(
          contentType &&
            (
              contentType.startsWith('text/') ||
              contentType.includes('json') ||
              contentType.includes('xml') ||
              contentType.includes('javascript') ||
              contentType.includes('x-www-form-urlencoded') ||
              contentType.includes('svg')
            )
        );
      };
      const classifyConsoleSource = (text, location) => {
        const value = String(text || '');
        const url = String(location?.url || '');
        if (/Failed to load resource|\\b4\\d\\d\\b|\\b5\\d\\d\\b/.test(value))
          return 'api';
        if (/React|Warning:|Each child in a list should have a unique/.test(value))
          return 'react';
        if (/Mixed Content|Content Security Policy|CORS|net::|ERR_|deprecated/i.test(value))
          return 'browser';
        return 'app';
      };
      const parseConsoleHttpStatus = (text) => {
        const match = String(text || '').match(/(?:status of|status code|\\b)([45]\\d\\d)\\b/i);
        return match ? Number(match[1]) : null;
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
          const text = msg.text();
          const source = classifyConsoleSource(text, location);
          const httpStatus = parseConsoleHttpStatus(text);
          keep(state.consoleRecords, {
            kind: 'console',
            sessionName,
            timestamp: now(),
            pageId: ensurePageId(p),
            navigationId: ensureNavigationId(p),
            level: msg.type(),
            source,
            text,
            ...(httpStatus ? { httpStatus } : {}),
            ...(location?.url ? { location } : {}),
          });
          if (httpStatus && source === 'api') {
            keep(state.networkRecords, {
              kind: 'console-resource-error',
              sessionName,
              timestamp: now(),
              event: 'console-resource-error',
              requestId: 'console-' + state.nextConsoleResourceSeq++,
              pageId: ensurePageId(p),
              navigationId: ensureNavigationId(p),
              url: location?.url || '',
              method: '',
              status: httpStatus,
              resourceType: 'unknown',
              failureText: text,
              source: 'console',
              ...(location?.url ? { location } : {}),
            });
          }
        });
        p.on('request', req => {
          const requestId = req.__pwcliRequestId || ('req-' + state.nextRequestSeq++);
          req.__pwcliRequestId = requestId;
          const frame = typeof req.frame === 'function' ? req.frame() : null;
          const headers = typeof req.headers === 'function' ? req.headers() : {};
          const contentType = String(headers['content-type'] || '');
          const postData = typeof req.postData === 'function' ? req.postData() : null;
          const record = {
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
            ...(contentType ? { requestContentType: contentType } : {}),
            ...(frame
              ? {
                  frame: {
                    url: frame.url(),
                    name: frame.name(),
                  },
                }
              : {}),
          };
          if (postData && isTextLikeContentType(contentType)) {
            const snippet = clipSnippet(postData);
            record.requestBodySnippet = snippet.snippet;
            record.requestBodyTruncated = snippet.truncated;
            const fullBody = clipBody(postData);
            record.requestBody = fullBody.body;
            record.requestBodyTruncatedAt50k = fullBody.truncated;
          }
          keep(state.networkRecords, record);
        });
        p.on('response', res => {
          const req = res.request();
          const requestId = req.__pwcliRequestId || ('req-' + state.nextRequestSeq++);
          req.__pwcliRequestId = requestId;
          const frame = typeof req.frame === 'function' ? req.frame() : null;
          const headers = typeof res.headers === 'function' ? res.headers() : {};
          const contentType = String(headers['content-type'] || '');
          const record = {
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
            ...(contentType ? { responseContentType: contentType } : {}),
            ...(frame
              ? {
                  frame: {
                    url: frame.url(),
                    name: frame.name(),
                  },
                }
              : {}),
          };
          keep(state.networkRecords, record);
          if (isTextLikeContentType(contentType) && typeof res.text === 'function') {
            Promise.resolve()
              .then(() => res.text())
              .then((text) => {
                const snippet = clipSnippet(text);
                record.responseBodySnippet = snippet.snippet;
                record.responseBodyTruncated = snippet.truncated;
                const fullBody = clipBody(text);
                record.responseBody = fullBody.body;
                record.responseBodyTruncatedAt50k = fullBody.truncated;
              })
              .catch((error) => {
                record.responseBodyReadError =
                  error instanceof Error ? error.message : String(error);
              });
          }
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

      // SSE capture: expose a Node function the browser can call, then inject the EventSource patch.
      if (!context.__pwcliSsePatchInstalled) {
        context.__pwcliSsePatchInstalled = true;
        const _state = state;
        await context.exposeFunction('__pwcliSseEvent', (recordJson) => {
          try {
            const record = JSON.parse(String(recordJson));
            const sseRecords = Array.isArray(_state.sseRecords) ? _state.sseRecords : (_state.sseRecords = []);
            sseRecords.push(record);
            if (sseRecords.length > 200)
              sseRecords.splice(0, sseRecords.length - 200);
          } catch (_e) {
            // ignore malformed records
          }
        });
        await context.addInitScript(${JSON.stringify(`(function () {
  if (typeof EventSource === 'undefined' || window.__pwcliSsePatchInstalled) return;
  window.__pwcliSsePatchInstalled = true;
  var _OriginalEventSource = window.EventSource;
  function PatchedEventSource(url, init) {
    var es = new _OriginalEventSource(url, init);
    var urlStr = String(url);
    var now = function () { return new Date().toISOString(); };
    var push = function (record) {
      if (typeof window.__pwcliSseEvent === 'function')
        window.__pwcliSseEvent(JSON.stringify(record)).catch(function () {});
    };
    push({ kind: 'sse-connect', url: urlStr, status: 'connecting', timestamp: now() });
    es.addEventListener('open', function () {
      push({ kind: 'sse-connect', url: urlStr, status: 'open', timestamp: now() });
    });
    es.addEventListener('error', function () {
      push({ kind: 'sse-error', url: urlStr, eventType: '__error', timestamp: now(), readyState: es.readyState });
    });
    var _origAdd = es.addEventListener.bind(es);
    es.addEventListener = function (type, listener, options) {
      if (type !== 'open' && type !== 'error') {
        var wrapped = function (e) {
          var data = typeof e.data === 'string' ? (e.data.length > 500 ? e.data.slice(0, 500) + '...' : e.data) : null;
          push({ kind: 'sse-event', url: urlStr, eventType: type, data: data, id: e.lastEventId || null, timestamp: now() });
          if (typeof listener === 'function') listener.call(this, e);
        };
        _origAdd(type, wrapped, options);
      } else {
        _origAdd(type, listener, options);
      }
    };
    es.addEventListener('message', function (e) {
      var data = typeof e.data === 'string' ? (e.data.length > 500 ? e.data.slice(0, 500) + '...' : e.data) : null;
      push({ kind: 'sse-event', url: urlStr, eventType: 'message', data: data, id: e.lastEventId || null, timestamp: now() });
    });
    return es;
  }
  PatchedEventSource.prototype = _OriginalEventSource.prototype;
  PatchedEventSource.CONNECTING = _OriginalEventSource.CONNECTING;
  PatchedEventSource.OPEN = _OriginalEventSource.OPEN;
  PatchedEventSource.CLOSED = _OriginalEventSource.CLOSED;
  window.EventSource = PatchedEventSource;
})();`)});
      }

      return JSON.stringify({
        installed: true,
        pageIds: context.pages().map(current => ensurePageId(current)),
        consoleCount: state.consoleRecords.length,
        networkCount: state.networkRecords.length,
        sseCount: state.sseRecords.length,
      });
    }`,
  });
  return result.data.result;
}

import { managedRunCode } from "./code.js";
import { DIAGNOSTICS_STATE_KEY } from "./shared.js";
import { pageIdRuntimePrelude } from "./workspace.js";

export async function managedEnsureDiagnosticsHooks(options?: { sessionName?: string }) {
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
      state.nextRequestSeq = Number.isInteger(state.nextRequestSeq) ? state.nextRequestSeq : 1;
      state.nextConsoleResourceSeq = Number.isInteger(state.nextConsoleResourceSeq) ? state.nextConsoleResourceSeq : 1;
      state.nextDialogSeq = Number.isInteger(state.nextDialogSeq) ? state.nextDialogSeq : 1;

      ${pageIdRuntimePrelude()}

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
            const body = clipSnippet(postData);
            record.requestBodySnippet = body.snippet;
            record.requestBodyTruncated = body.truncated;
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
                const body = clipSnippet(text);
                record.responseBodySnippet = body.snippet;
                record.responseBodyTruncated = body.truncated;
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
